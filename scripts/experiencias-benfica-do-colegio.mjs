/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 4 experiências de pessoas da Universidade ficaram gravadas no Colégio (vaga
 * com a sede BENFICA, corrigida em scripts/benfica-para-unibenfica.mjs), e o
 * Colégio conseguia lê-las. Decisão do Guilherme (04/11/2026):
 *  - 3 foram recriadas à mão pelo RH da Universidade: apaga a do Colégio;
 *  - 1 só existe no Colégio: passa para a Universidade (+45/+75).
 *
 *   node scripts/experiencias-benfica-do-colegio.mjs            → ENSAIO (não grava)
 *   node scripts/experiencias-benfica-do-colegio.mjs --gravar   → grava
 *
 * Só age se cada registro ainda estiver como foi conferido (Colégio, BENFICA) e
 * se a cópia na Universidade ainda existir, e cada gravação exige que o registro
 * não tenha mudado desde a leitura. A saída não mostra nomes.
 */
import { execSync } from 'node:child_process';

const PROJETO = 'projects/project-312a1a63-026e-4dfa-91c/databases/ai-studio-2b395015-7429-44d1-83dd-233de9cd3c47';
const BASE = `https://firestore.googleapis.com/v1/${PROJETO}/documents`;
const GRAVAR = process.argv.includes('--gravar');
const APAGAR = { // do Colégio → cópia na Universidade
  '3WVhVP9GqTWKi9t90FGD': 'ULZGMYFkzMEMGio5CJm0',
  'My5KTZ6Jyfma7JEyU3w0': 'SnVITmratiVmQQFRkhDN',
  'EnvubBh3PS8lda9a9Asp': '9qS6njqnTUSU3CZAvioM',
};
const MOVER = 'yrm2kuQGHxVqBIh2fqwl';

const token = execSync('gcloud auth application-default print-access-token', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const cabecalho = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const ler = async id => {
  const j = await (await fetch(`${BASE}/experiencia/${id}`, { headers: cabecalho })).json();
  if (j.error) throw new Error(`${id}: ${j.error.message}`);
  return j;
};
const txt = (d, c) => d.fields?.[c]?.stringValue ?? '';
const noColegio = d => txt(d, 'escopo') === 'colegio' && txt(d, 'sede') === 'BENFICA';
const parar = m => { console.error(`PARADO, nada gravado: ${m}`); process.exit(1); };
const utc = s => { const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : null; };
const br = t => { const d = new Date(t); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`; };

const writes = [];
for (const [id, copia] of Object.entries(APAGAR)) {
  const d = await ler(id), c = await ler(copia);
  if (!noColegio(d)) parar(`${id} não está mais no Colégio em BENFICA.`);
  if (txt(c, 'escopo') !== 'universidade') parar(`a cópia ${copia} não é da Universidade.`);
  if (txt(c, 'colaborador').trim().toLowerCase() !== txt(d, 'colaborador').trim().toLowerCase()) parar(`${copia} não é a mesma pessoa de ${id}.`);
  if (txt(d, 'observacoes')) parar(`${id} tem observação, que se perderia.`);
  writes.push({ delete: d.name, currentDocument: { updateTime: d.updateTime } });
  console.log(`apagar ${id} (cópia ${copia}: ${txt(c, 'status')})`);
}
const m = await ler(MOVER);
if (!noColegio(m)) parar(`${MOVER} não está mais no Colégio em BENFICA.`);
const adm = utc(txt(m, 'dataAdmissao'));
if (adm === null) parar(`${MOVER} sem admissão legível.`);
const DIA = 864e5, t1 = br(adm + 45 * DIA), t2 = br(adm + 75 * DIA);
const campos = { escopo: 'universidade', sede: 'UNIBENFICA', termino1: t1, termino2: t2 };
writes.push({
  update: { name: m.name, fields: Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, { stringValue: v }])) },
  updateMask: { fieldPaths: Object.keys(campos) },
  currentDocument: { updateTime: m.updateTime },
});
console.log(`mover ${MOVER}: ${txt(m, 'status')}, prazos ${txt(m, 'termino1')} ${txt(m, 'termino2')} → ${t1} ${t2}`);

if (!GRAVAR) { console.log('\nENSAIO — nada foi gravado. Para gravar: --gravar'); process.exit(0); }

writes.push({
  update: {
    name: `${PROJETO}/documents/logs/experiencias-benfica-do-colegio-${Date.now()}`,
    fields: {
      timestamp: { stringValue: new Date().toISOString() }, usuario: { stringValue: 'sistema' }, acao: { stringValue: 'ALTEROU' },
      modulo: { stringValue: 'Experiências' }, regiao: { stringValue: '' }, escopo: { stringValue: 'universidade' },
      detalhes: { stringValue: 'Experiências da Universidade gravadas no Colégio (sede BENFICA): 3 duplicadas apagadas, mantida a cópia da Universidade; 1 movida para a Universidade.' },
    },
  },
  currentDocument: { exists: false },
});
const r = await fetch(`${BASE}:commit`, { method: 'POST', headers: cabecalho, body: JSON.stringify({ writes }) });
const j = await r.json();
if (j.error) throw new Error(j.error.message);
console.log('Pronto: 3 apagadas e 1 movida, numa gravação só.');
