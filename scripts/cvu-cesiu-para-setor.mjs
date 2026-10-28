/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CVU e CESIU deixam de ser SEDE e viram SETOR (pedido do RH da Universidade,
 * 28/10/2026), e entra o setor "Laboratório". Os dois ficam na ALDEOTA (o
 * código já assumia isso: UniversidadeSync.gs e treinamentoUniImport.ts).
 *
 *   node scripts/cvu-cesiu-para-setor.mjs            → ENSAIO (não grava)
 *   node scripts/cvu-cesiu-para-setor.mjs --gravar   → grava
 *
 * Decisões do Guilherme (28/10/2026):
 *  - vagas, seleções e experiência com sede CVU/CESIU passam a sede ALDEOTA e
 *    setor CVU/CESIU;
 *  - vaga e experiência guardam o setor de antes no fim das observações;
 *    seleção não tem observação — o setor de antes se perde (o cargo fica).
 *
 * ⚠️ A sede decide a unidade do registro (utils/unidade.ts): sede fora do
 * cadastro conta como Colégio. Por isso as sedes CVU/CESIU só são apagadas
 * DEPOIS que nenhum registro aponta para elas, e o script para se a ALDEOTA
 * não for da Universidade ou se algum registro não for da Universidade.
 * Cada gravação exige que o registro não tenha mudado desde a leitura.
 *
 * A saída só mostra contagens e códigos — nenhum nome.
 */
import { execSync } from 'node:child_process';

const PROJETO = 'projects/project-312a1a63-026e-4dfa-91c/databases/ai-studio-2b395015-7429-44d1-83dd-233de9cd3c47';
const BASE = `https://firestore.googleapis.com/v1/${PROJETO}/documents`;
const GRAVAR = process.argv.includes('--gravar');
const HOJE = '28/10/2026';

let cabecalho;
try {
  const token = execSync('gcloud auth application-default print-access-token', {
    encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  cabecalho = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
} catch {
  console.error('Sem credencial do gcloud. Rode: gcloud auth application-default login');
  process.exit(1);
}

const txt = (d, c) => d.fields?.[c]?.stringValue ?? '';
const idDe = d => d.name.split('/').pop();
const chave = s => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();

async function ler(colecao) {
  const docs = []; let p = '';
  do {
    const r = await fetch(`${BASE}/${colecao}?pageSize=300${p ? `&pageToken=${p}` : ''}`, { headers: cabecalho });
    const j = await r.json();
    if (j.error) throw new Error(`${colecao}: ${j.error.message}`);
    docs.push(...(j.documents || []));
    p = j.nextPageToken || '';
  } while (p);
  return docs;
}

async function commit(writes) {
  for (let i = 0; i < writes.length; i += 500) {
    const r = await fetch(`${BASE}:commit`, { method: 'POST', headers: cabecalho, body: JSON.stringify({ writes: writes.slice(i, i + 500) }) });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message);
  }
}

const NOVOS = { cvu: 'CVU', cesiu: 'CESIU' };

// ── conferências ──
const sedes = await ler('sedes');
const aldeota = sedes.find(s => chave(txt(s, 'nome')) === 'aldeota');
if (!aldeota || chave(txt(aldeota, 'regiao')) !== 'universidade') {
  console.error('PARADO: a sede ALDEOTA não existe ou não é da Universidade.');
  process.exit(1);
}
const sedesAlvo = sedes.filter(s => chave(txt(s, 'nome')) in NOVOS);
console.log('Sedes a apagar:', sedesAlvo.map(s => `${txt(s, 'nome')} (${idDe(s)}, região ${txt(s, 'regiao')})`).join(' · ') || 'nenhuma');

const setores = await ler('setores');
const existe = new Set(setores.map(s => chave(txt(s, 'nome'))));
const setoresNovos = ['CVU', 'CESIU', 'Laboratório'].filter(n => !existe.has(chave(n)));
console.log('Setores a criar:', setoresNovos.join(', ') || 'nenhum (já existem)');

// ── registros que apontam para as sedes ──
const writes = [];
let parar = false;
for (const colecao of ['vagas', 'selecoes', 'experiencia']) {
  const docs = (await ler(colecao)).filter(d => chave(txt(d, 'sede')) in NOVOS);
  const resumo = {};
  for (const d of docs) {
    const novo = NOVOS[chave(txt(d, 'sede'))];
    if (txt(d, 'escopo') !== 'universidade') {
      console.error(`PARADO: ${colecao}/${idDe(d)} não é da Universidade (escopo "${txt(d, 'escopo')}").`);
      parar = true;
    }
    const antes = txt(d, 'setor').trim();
    const campos = { sede: txt(aldeota, 'nome'), setor: novo };
    // Vaga e experiência guardam o setor de antes; seleção não tem observação.
    if (colecao !== 'selecoes' && antes && chave(antes) !== chave(novo)) {
      const obs = txt(d, 'observacoes');
      campos.observacoes = `${obs}${obs ? '\n' : ''}[${HOJE}] Setor anterior: ${antes} (${novo} passou de sede a setor).`;
    }
    const k = `${txt(d, 'sede')}/${antes || '(vazio)'} → ALDEOTA/${novo}`;
    resumo[k] = (resumo[k] || 0) + 1;
    writes.push({
      update: { name: d.name, fields: Object.fromEntries(Object.entries(campos).map(([c, v]) => [c, { stringValue: v }])) },
      updateMask: { fieldPaths: Object.keys(campos) },
      currentDocument: { updateTime: d.updateTime },
    });
  }
  console.log(`${colecao}: ${docs.length}`);
  for (const [k, n] of Object.entries(resumo)) console.log(`   ${n} x ${k}`);
}
if (parar) process.exit(1);

if (!GRAVAR) {
  console.log(`\nENSAIO — nada foi gravado (${writes.length} registros, ${setoresNovos.length} setores, ${sedesAlvo.length} sedes). Para gravar: --gravar`);
  process.exit(0);
}

// 1) setores novos; 2) registros; 3) só então apagar as sedes; 4) uma linha no log.
await commit(setoresNovos.map(nome => ({
  update: { name: `${PROJETO}/documents/setores/${chave(nome).replace(/[^a-z0-9]+/g, '-')}`, fields: { nome: { stringValue: nome } } },
  currentDocument: { exists: false },
})));
console.log('setores criados:', setoresNovos.length);
await commit(writes);
console.log('registros atualizados:', writes.length);
await commit(sedesAlvo.map(s => ({ delete: s.name, currentDocument: { updateTime: s.updateTime } })));
console.log('sedes apagadas:', sedesAlvo.length);
await commit([{
  update: {
    name: `${PROJETO}/documents/logs/cvu-cesiu-para-setor-${Date.now()}`,
    fields: {
      timestamp: { stringValue: new Date().toISOString() },
      usuario: { stringValue: 'sistema' },
      acao: { stringValue: 'ALTEROU' },
      modulo: { stringValue: 'Sedes' },
      regiao: { stringValue: '' },
      escopo: { stringValue: 'universidade' },
      detalhes: { stringValue: `CVU e CESIU passaram de sede a setor (sede ALDEOTA): ${writes.length} registro(s) atualizados, ${sedesAlvo.length} sede(s) removidas, setor(es) criados: ${setoresNovos.join(', ') || 'nenhum'}.` },
    },
  },
  currentDocument: { exists: false },
}]);
console.log('Pronto.');
