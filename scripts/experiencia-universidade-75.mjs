/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * A Universidade faz experiência de 45/75 dias e o Colégio de 45/90 (Guilherme,
 * 04/11/2026), mas o sistema gravava 90 para todos: os registros da Universidade
 * criados nele ficaram com o 2º prazo 15 dias depois do real. Este script põe
 * esses registros na conta da planilha da Universidade: admissão + 45 e + 75.
 *
 *   node scripts/experiencia-universidade-75.mjs            → ENSAIO (não grava)
 *   node scripts/experiencia-universidade-75.mjs --gravar   → grava
 *
 * Só mexe em quem é da Universidade e está EXATAMENTE em +44 e (+89 ou +74, da
 * 1ª passada deste script) — quem veio da planilha (+45/+75) e prazo alterado à
 * mão ficam como estão. Cada gravação exige que o registro não tenha mudado.
 *
 * A saída só mostra contagens — nenhum nome.
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
const utc = s => { const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : null; };
const br = t => { const d = new Date(t); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`; };
const DIA = 864e5;
const agora = new Date();
const hoje = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate());

const docs = []; let p = '';
do {
  const r = await fetch(`${BASE}/experiencia?pageSize=300${p ? `&pageToken=${p}` : ''}`, { headers: cabecalho });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  docs.push(...(j.documents || []));
  p = j.nextPageToken || '';
} while (p);

const writes = [], resumo = {};
let prorrogadosVencidos = 0, emAnaliseCom75Vencido = 0;
for (const d of docs) {
  if (txt(d, 'escopo') !== 'universidade') continue;
  const adm = utc(txt(d, 'dataAdmissao')), t1 = utc(txt(d, 'termino1')), t2 = utc(txt(d, 'termino2'));
  if (adm === null || t1 === null || t2 === null) continue;
  if ((t1 - adm) / DIA !== 44 || ![89, 74].includes((t2 - adm) / DIA)) continue;
  const novo = adm + 75 * DIA, status = txt(d, 'status');
  resumo[status] = (resumo[status] || 0) + 1;
  if (status === 'PRORROGADO' && novo < hoje) prorrogadosVencidos++;
  if (status === 'EM_ANALISE' && novo < hoje) emAnaliseCom75Vencido++;
  writes.push({
    update: { name: d.name, fields: { termino1: { stringValue: br(adm + 45 * DIA) }, termino2: { stringValue: br(novo) } } },
    updateMask: { fieldPaths: ['termino1', 'termino2'] },
    currentDocument: { updateTime: d.updateTime },
  });
}

console.log(`Experiências: ${docs.length} · da Universidade fora da conta da planilha, a corrigir: ${writes.length}`, resumo);
console.log(`Em andamento com o 75º dia JÁ PASSADO: ${prorrogadosVencidos} prorrogado(s), ${emAnaliseCom75Vencido} em análise.`);

if (!GRAVAR) { console.log('\nENSAIO — nada foi gravado. Para gravar: --gravar'); process.exit(0); }

for (let i = 0; i < writes.length; i += 500) {
  const r = await fetch(`${BASE}:commit`, { method: 'POST', headers: cabecalho, body: JSON.stringify({ writes: writes.slice(i, i + 500) }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
}
const log = await fetch(`${BASE}:commit`, { method: 'POST', headers: cabecalho, body: JSON.stringify({ writes: [{
  update: {
    name: `${PROJETO}/documents/logs/experiencia-universidade-75-${Date.now()}`,
    fields: {
      timestamp: { stringValue: new Date().toISOString() }, usuario: { stringValue: 'sistema' }, acao: { stringValue: 'ALTEROU' },
      modulo: { stringValue: 'Experiências' }, regiao: { stringValue: '' }, escopo: { stringValue: 'universidade' },
      detalhes: { stringValue: `Prazos da experiência da Universidade acertados para admissão + 45 e + 75 em ${writes.length} registro(s).` },
    },
  },
  currentDocument: { exists: false },
}] }) });
const jl = await log.json();
if (jl.error) throw new Error(jl.error.message);
console.log(`Pronto: ${writes.length} registro(s) corrigidos.`);
