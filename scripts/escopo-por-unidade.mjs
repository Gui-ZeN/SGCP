/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Preenche `escopo` ('colegio' | 'universidade') nos documentos antigos das
 * coleções isoladas por unidade NO SERVIDOR (auditoria de segurança de
 * 14/10/2026), e `unidade` nos cadastros de usuário que ainda não têm.
 *
 *   node scripts/escopo-por-unidade.mjs            → ENSAIO (não grava)
 *   node scripts/escopo-por-unidade.mjs --gravar   → grava
 *
 * Sem isto, as regras novas escondem de quem não é Administrador todo registro
 * anterior a elas (documento sem `escopo` = só o Administrador lê).
 *
 *  - entrevistas: unidade da sede do campo `unidade` (nome ou sigla);
 *  - candidatos:  unidade da sede da SELEÇÃO do candidato;
 *  - usuarios:    unidade da sede do cadastro (só onde o campo falta).
 * Sede fora do catálogo conta como Colégio — a mesma regra da tela
 * (utils/unidade.ts › escopoDaSede). Só preenche o que FALTA: nada que já
 * tenha o campo é sobrescrito. Idempotente: pode rodar de novo (e deve, logo
 * depois de publicar o app, para pegar o que a versão antiga criou no meio).
 *
 * O relatório só mostra contagens — nenhum nome sai daqui.
 */
import { execSync } from 'node:child_process';

const BASE = 'https://firestore.googleapis.com/v1/projects/project-312a1a63-026e-4dfa-91c/databases/ai-studio-2b395015-7429-44d1-83dd-233de9cd3c47/documents';
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
const tem = (d, c) => d.fields?.[c] !== undefined;
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

async function gravarCampo(doc, campo, valor) {
  const url = `https://firestore.googleapis.com/v1/${doc.name}?updateMask.fieldPaths=${campo}&currentDocument.exists=true`;
  const r = await fetch(url, { method: 'PATCH', headers: cabecalho, body: JSON.stringify({ fields: { [campo]: { stringValue: valor } } }) });
  const j = await r.json();
  if (j.error) throw new Error(`${idDe(doc)}: ${j.error.message}`);
}

// ── catálogo de sedes → unidade (espelha utils/unidade.ts) ──
const sedes = await ler('sedes');
const chave = t => String(t || '').toLowerCase().trim();
const unidadeDaSede = rotulo => {
  const alvo = chave(rotulo);
  if (!alvo) return { escopo: 'colegio', conhecida: false };
  const s = sedes.find(x => chave(txt(x, 'nome')) === alvo || chave(txt(x, 'sigla')) === alvo);
  if (!s) return { escopo: 'colegio', conhecida: false };
  return { escopo: chave(txt(s, 'regiao')) === 'universidade' ? 'universidade' : 'colegio', conhecida: true };
};

const selecoes = new Map((await ler('selecoes')).map(d => [idDe(d), d]));

const planos = [];
const relatorio = {};
const conta = (col, k) => { relatorio[col] = relatorio[col] || {}; relatorio[col][k] = (relatorio[col][k] || 0) + 1; };

for (const d of await ler('entrevistas')) {
  if (tem(d, 'escopo')) { conta('entrevistas', 'já tinham'); continue; }
  const u = unidadeDaSede(txt(d, 'unidade'));
  conta('entrevistas', u.escopo);
  if (!u.conhecida) conta('entrevistas', '  (sede fora do catálogo → colegio)');
  planos.push({ doc: d, campo: 'escopo', valor: u.escopo });
}

for (const d of await ler('candidatos')) {
  if (tem(d, 'escopo')) { conta('candidatos', 'já tinham'); continue; }
  const sel = selecoes.get(txt(d, 'selecaoId'));
  const u = sel ? unidadeDaSede(txt(sel, 'sede')) : { escopo: 'colegio', conhecida: false };
  conta('candidatos', u.escopo);
  if (!sel) conta('candidatos', '  (seleção não encontrada → colegio)');
  else if (!u.conhecida) conta('candidatos', '  (sede da seleção fora do catálogo → colegio)');
  planos.push({ doc: d, campo: 'escopo', valor: u.escopo });
}

for (const d of await ler('usuarios')) {
  if (tem(d, 'unidade')) { conta('usuarios', 'já tinham'); continue; }
  const u = unidadeDaSede(txt(d, 'sede'));
  conta('usuarios', u.escopo);
  planos.push({ doc: d, campo: 'unidade', valor: u.escopo });
}

console.log(GRAVAR ? '── GRAVANDO ──' : '── ENSAIO (nada é gravado; use --gravar) ──');
for (const [col, r] of Object.entries(relatorio)) {
  console.log(`\n${col}`);
  for (const [k, n] of Object.entries(r)) console.log(`  ${k}: ${n}`);
}
console.log(`\nA preencher: ${planos.length} documento(s).`);

if (GRAVAR) {
  let feitos = 0;
  for (const p of planos) { await gravarCampo(p.doc, p.campo, p.valor); feitos++; }
  console.log(`Gravados: ${feitos}.`);
}
