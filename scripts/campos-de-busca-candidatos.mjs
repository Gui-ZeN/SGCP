/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Preenche os campos de BUSCA dos candidatos (19/10/2026): `dataISO`
 * (AAAA-MM-DD de `data`) e `nomeNorm` (o nome sem acento, minúsculo). É por
 * eles que o app passou a ler a coleção por partes — ver
 * src/utils/janelaCandidatos.ts. Candidato sem os campos não aparece na lista
 * ao vivo nem no Banco de candidatos.
 *
 *   node scripts/campos-de-busca-candidatos.mjs            → ENSAIO (não grava)
 *   node scripts/campos-de-busca-candidatos.mjs --gravar   → grava
 *
 * Só grava o que está diferente do esperado (idempotente). Rodar de novo logo
 * depois de publicar o app: abas abertas na versão antiga ainda gravam sem os
 * campos até recarregar.
 *
 * O relatório só mostra contagens — nenhum nome sai daqui.
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
const idDe = d => d.name.split('/').pop();

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

// Espelham src/utils/catalogo.ts › normalizarNome e janelaCandidatos.ts › dataISODe.
const normalizarNome = s => (s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
const dataISODe = d => { const m = String(d || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
const corte = (() => { const h = new Date(); const d = new Date(h.getFullYear(), h.getMonth(), h.getDate() - 60); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();

const selecoes = new Map((await ler('selecoes')).map(d => [idDe(d), d]));
const candidatos = await ler('candidatos');

const planos = [];
const conta = { total: candidatos.length, semData: 0, divergente: 0, semSelecao: 0, naJanela: {}, porAno: {}, semEscopo: 0 };
for (const c of candidatos) {
  // A data que vale é a do DIA DE SELEÇÃO (é por ela que a tela decide se a
  // seleção está na janela ao vivo); a do candidato só quando a seleção não
  // existe. Antes de 19/10/2026 remarcar a seleção não mudava a do candidato.
  const sel = selecoes.get(txt(c, 'selecaoId'));
  const daSelecao = dataISODe(txt(sel || {}, 'data'));
  const doCandidato = dataISODe(txt(c, 'data'));
  if (!sel) conta.semSelecao++;
  if (daSelecao && doCandidato && daSelecao !== doCandidato) conta.divergente++;
  const dataISO = daSelecao || doCandidato;
  if (!dataISO) conta.semData++;
  const nomeNorm = normalizarNome(txt(c, 'nome'));
  const escopo = txt(c, 'escopo') || '(sem escopo)';
  if (escopo === '(sem escopo)') conta.semEscopo++;
  if (dataISO >= corte) conta.naJanela[escopo] = (conta.naJanela[escopo] || 0) + 1;
  else { const k = `${escopo} ${dataISO.slice(0, 4) || '(sem data)'}`; conta.porAno[k] = (conta.porAno[k] || 0) + 1; }
  const campos = {};
  if (txt(c, 'dataISO') !== dataISO || c.fields?.dataISO === undefined) campos.dataISO = dataISO;
  if (txt(c, 'nomeNorm') !== nomeNorm || c.fields?.nomeNorm === undefined) campos.nomeNorm = nomeNorm;
  if (Object.keys(campos).length) planos.push({ doc: c, campos });
}

console.log(`Candidatos: ${conta.total}`);
console.log(`A gravar: ${planos.length} (dataISO: ${planos.filter(p => 'dataISO' in p.campos).length}, nomeNorm: ${planos.filter(p => 'nomeNorm' in p.campos).length})`);
console.log(`Data do candidato ≠ da seleção (vale a da seleção): ${conta.divergente} · sem seleção: ${conta.semSelecao} · sem data nenhuma: ${conta.semData} · sem escopo: ${conta.semEscopo}`);
console.log(`Na janela ao vivo (desde ${corte}) — o que cada aba lê ao abrir:`, conta.naJanela);
console.log('Antes da janela, por unidade e ano — o que a aba Candidatos lê ao escolher o ano:', conta.porAno);

if (!GRAVAR) {
  console.log('\nENSAIO — nada foi gravado. Para gravar: --gravar');
  process.exit(0);
}

// Em lotes de 500 (o limite do commit), só os campos que mudam, só em documento que existe.
let feitos = 0;
for (let i = 0; i < planos.length; i += 500) {
  const writes = planos.slice(i, i + 500).map(({ doc, campos }) => ({
    update: { name: doc.name, fields: Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, { stringValue: v }])) },
    updateMask: { fieldPaths: Object.keys(campos) },
    currentDocument: { exists: true },
  }));
  const r = await fetch(`${BASE}:commit`, { method: 'POST', headers: cabecalho, body: JSON.stringify({ writes }) });
  const j = await r.json();
  if (j.error) throw new Error(`lote ${i / 500 + 1}: ${j.error.message}`);
  feitos += writes.length;
  console.log(`  gravados ${feitos}/${planos.length}`);
}
console.log('Pronto.');
