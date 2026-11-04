/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Vagas e integrações da UNIVERSIDADE gravadas com a sede "BENFICA", que no
 * cadastro é do Colégio: passam para "UNIBENFICA", a mesma conversão que a
 * importação da planilha da Universidade usa (Guilherme, 04/11/2026). Com a
 * sede errada, a experiência e a integração criadas ao concluir a vaga nasciam
 * no Colégio, expondo dado pessoal à outra unidade.
 *
 *   node scripts/benfica-para-unibenfica.mjs            → ENSAIO (não grava)
 *   node scripts/benfica-para-unibenfica.mjs --gravar   → grava
 *
 * Só mexe no campo `sede`. Registro do Colégio em BENFICA não entra. Para se
 * UNIBENFICA não for da Universidade. Cada gravação exige que o registro não
 * tenha mudado desde a leitura. A saída só mostra contagens — nenhum nome.
 */
import { execSync } from 'node:child_process';

const PROJETO = 'projects/project-312a1a63-026e-4dfa-91c/databases/ai-studio-2b395015-7429-44d1-83dd-233de9cd3c47';
const BASE = `https://firestore.googleapis.com/v1/${PROJETO}/documents`;
const GRAVAR = process.argv.includes('--gravar');

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
const chave = s => String(s || '').trim().toLowerCase();

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

const uni = (await ler('sedes')).find(s => chave(txt(s, 'nome')) === 'unibenfica');
if (!uni || chave(txt(uni, 'regiao')) !== 'universidade') {
  console.error('PARADO: a sede UNIBENFICA não existe ou não é da Universidade.');
  process.exit(1);
}

const writes = [];
for (const colecao of ['vagas', 'integracoes']) {
  const docs = (await ler(colecao)).filter(d => chave(txt(d, 'sede')) === 'benfica' && txt(d, 'escopo') === 'universidade');
  console.log(`${colecao}: ${docs.length}`);
  for (const d of docs) {
    writes.push({
      update: { name: d.name, fields: { sede: { stringValue: txt(uni, 'nome') } } },
      updateMask: { fieldPaths: ['sede'] },
      currentDocument: { updateTime: d.updateTime },
    });
  }
}

if (!GRAVAR) { console.log(`\nENSAIO — nada foi gravado (${writes.length} registros). Para gravar: --gravar`); process.exit(0); }

const log = {
  update: {
    name: `${PROJETO}/documents/logs/benfica-para-unibenfica-${Date.now()}`,
    fields: {
      timestamp: { stringValue: new Date().toISOString() }, usuario: { stringValue: 'sistema' }, acao: { stringValue: 'ALTEROU' },
      modulo: { stringValue: 'Vagas' }, regiao: { stringValue: '' }, escopo: { stringValue: 'universidade' },
      detalhes: { stringValue: `Sede BENFICA corrigida para UNIBENFICA em ${writes.length} registro(s) da Universidade (vagas e integrações).` },
    },
  },
  currentDocument: { exists: false },
};
const r = await fetch(`${BASE}:commit`, { method: 'POST', headers: cabecalho, body: JSON.stringify({ writes: [...writes, log] }) });
const j = await r.json();
if (j.error) throw new Error(j.error.message);
console.log(`Pronto: ${writes.length} registro(s) corrigidos.`);
