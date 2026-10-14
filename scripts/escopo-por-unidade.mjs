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
 *  - usuarios:    unidade da sede do cadastro (só onde o campo falta);
 *  - logs:        a unidade do registro (consulta, entrevista, candidato);
 *                 senão a `regiao` do log; senão a de quem agiu; sem prova
 *                 nenhuma, fica sem (só o Administrador lê).
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

// Unidade de cada registro (já gravada ou a gravar), para os logs cruzarem.
// Nome de colaborador que aparece nas duas unidades fica ambíguo (null).
const escopoDaEntrevistaPorNome = new Map();
const escopoDoCandidato = new Map();

for (const d of await ler('entrevistas')) {
  let escopo = txt(d, 'escopo');
  if (escopo) conta('entrevistas', 'já tinham');
  else {
    const u = unidadeDaSede(txt(d, 'unidade'));
    escopo = u.escopo;
    conta('entrevistas', u.escopo);
    if (!u.conhecida) conta('entrevistas', '  (sede fora do catálogo → colegio)');
    planos.push({ doc: d, campo: 'escopo', valor: u.escopo });
  }
  const nome = chave(txt(d, 'colaborador'));
  if (nome) escopoDaEntrevistaPorNome.set(nome,
    escopoDaEntrevistaPorNome.has(nome) && escopoDaEntrevistaPorNome.get(nome) !== escopo ? null : escopo);
}

for (const d of await ler('candidatos')) {
  let escopo = txt(d, 'escopo');
  if (escopo) conta('candidatos', 'já tinham');
  else {
    const sel = selecoes.get(txt(d, 'selecaoId'));
    const u = sel ? unidadeDaSede(txt(sel, 'sede')) : { escopo: 'colegio', conhecida: false };
    escopo = u.escopo;
    conta('candidatos', u.escopo);
    if (!sel) conta('candidatos', '  (seleção não encontrada → colegio)');
    else if (!u.conhecida) conta('candidatos', '  (sede da seleção fora do catálogo → colegio)');
    planos.push({ doc: d, campo: 'escopo', valor: u.escopo });
  }
  escopoDoCandidato.set(idDe(d), escopo);
}

const usuarios = await ler('usuarios');
for (const d of usuarios) {
  if (tem(d, 'unidade')) { conta('usuarios', 'já tinham'); continue; }
  const u = unidadeDaSede(txt(d, 'sede'));
  conta('usuarios', u.escopo);
  planos.push({ doc: d, campo: 'unidade', valor: u.escopo });
}

// Fase 3: as demais coleções operacionais, pela sede do próprio registro (o
// mesmo campo que a tela usa para escopar cada uma). `null` = fica sem escopo
// (só o Administrador lê).
const pelaSede = campo => d => unidadeDaSede(txt(d, campo));
const organograma = await ler('organograma');
const noPorId = new Map(organograma.map(d => [idDe(d), d]));
// Caixa sem sede herda a do superior (é o que o formulário sugere ao criar).
const sedeDoNo = (d, vistos = new Set()) => {
  if (txt(d, 'sede') || vistos.has(idDe(d))) return txt(d, 'sede');
  vistos.add(idDe(d));
  const chefe = noPorId.get(txt(d, 'respondeA'));
  return chefe ? sedeDoNo(chefe, vistos) : '';
};
const COLECOES = [
  ['treinamentos', pelaSede('unidade')],
  ['experiencia', pelaSede('sede')],
  ['selecoes', pelaSede('sede')],
  ['atividades', pelaSede('sede')],
  ['funcionarios', pelaSede('sede')],
  ['integracoes', pelaSede('sede')],
  ['vagas', d => txt(d, 'origem') === 'planilha-universidade' ? { escopo: 'universidade', conhecida: true } : unidadeDaSede(txt(d, 'sede'))],
  // Turnover não tem sede: a unidade é o próprio campo. Sem ele é o legado
  // consolidado (as duas somadas) — só o Administrador vê, como na tela.
  ['turnover', d => ['colegio', 'universidade'].includes(txt(d, 'unidade')) ? { escopo: txt(d, 'unidade'), conhecida: true } : null],
  ['organograma', d => unidadeDaSede(sedeDoNo(d))],
];
for (const [colecao, escopoDe] of COLECOES) {
  for (const d of colecao === 'organograma' ? organograma : await ler(colecao)) {
    if (tem(d, 'escopo')) { conta(colecao, 'já tinham'); continue; }
    const u = escopoDe(d);
    if (!u) { conta(colecao, 'sem unidade → fica só para o Administrador'); continue; }
    conta(colecao, u.escopo);
    if (!u.conhecida) conta(colecao, '  (sede vazia ou fora do catálogo → colegio)');
    planos.push({ doc: d, campo: 'escopo', valor: u.escopo });
  }
}

// Diário ("Meu dia"): a unidade de quem o escreveu. Dono sem cadastro → fica
// sem (só o Administrador lê).
const unidadePorEmail = new Map(usuarios.map(d => [chave(txt(d, 'email') || idDe(d)), txt(d, 'unidade')]));
for (const d of await ler('diario')) {
  if (tem(d, 'escopo')) { conta('diario', 'já tinham'); continue; }
  const u = unidadePorEmail.get(chave(txt(d, 'email')));
  if (!u) { conta('diario', 'dono sem cadastro → só o Administrador'); continue; }
  conta('diario', u);
  planos.push({ doc: d, campo: 'escopo', valor: u });
}

// Contador único dos números (#) de vaga e treinamento — src/lib/contador.ts.
// Nasce (ou sobe) no maior número existente; nunca desce.
const numero = d => Number(d.fields?.codigo?.integerValue ?? d.fields?.codigo?.doubleValue ?? 0) || 0;
for (const colecao of ['vagas', 'treinamentos']) {
  const maior = Math.max(0, ...(await ler(colecao)).map(numero));
  const j = await (await fetch(`${BASE}/contadores/${colecao}`, { headers: cabecalho })).json();
  const atual = j.fields ? Number(j.fields.ultimo?.integerValue ?? 0) : -1;
  if (atual >= maior) { conta('contadores', `${colecao}: já está em ${atual}`); continue; }
  conta('contadores', `${colecao}: ${atual < 0 ? 'criar' : 'subir'} em ${maior}`);
  planos.push({ contador: colecao, valor: maior });
}

// logs (fase 2), do mais forte ao mais fraco:
//  1. a unidade do REGISTRO: consultas são do Colégio; entrevista pelo nome do
//     colaborador (ref ou texto); candidato pelo id em `ref.candidato`;
//  2. a `regiao` carimbada no log (o critério do filtro antigo da tela);
//  3. a unidade do cadastro de quem agiu.
// Sem nenhum dos três, o log fica SEM escopo — só o Administrador lê (modo
// fechado), em vez de cair no Colégio sem prova.
const unidadeDoAutor = new Map(usuarios.map(d => [chave(txt(d, 'email') || idDe(d)),
  txt(d, 'unidade') || unidadeDaSede(txt(d, 'sede')).escopo]));
const doRef = (d, c) => d.fields?.ref?.mapValue?.fields?.[c]?.stringValue ?? '';
const doRegistro = d => {
  const modulo = txt(d, 'modulo');
  if (modulo === 'Consultas') return 'colegio';
  if (modulo === 'Entrevistas') {
    const nome = chave(doRef(d, 'colaborador') || (txt(d, 'detalhes').match(/de "([^"]+)"/) || [])[1]);
    return escopoDaEntrevistaPorNome.get(nome) || null;
  }
  if (modulo === 'Candidatos') return escopoDoCandidato.get(doRef(d, 'candidato')) || null;
  return null;
};
for (const d of await ler('logs')) {
  if (tem(d, 'escopo')) { conta('logs', 'já tinham'); continue; }
  const regiao = chave(txt(d, 'regiao'));
  const autor = unidadeDoAutor.get(chave(txt(d, 'usuario')));
  let escopo = doRegistro(d), motivo = 'pelo registro';
  if (!escopo && regiao) { escopo = regiao === 'universidade' ? 'universidade' : 'colegio'; motivo = 'pela região'; }
  if (!escopo && autor) { escopo = autor === 'universidade' ? 'universidade' : 'colegio'; motivo = 'pelo autor'; }
  if (!escopo) { conta('logs', 'sem prova → fica só para o Administrador'); continue; }
  conta('logs', `${escopo} (${motivo})`);
  planos.push({ doc: d, campo: 'escopo', valor: escopo });
}

console.log(GRAVAR ? '── GRAVANDO ──' : '── ENSAIO (nada é gravado; use --gravar) ──');
for (const [col, r] of Object.entries(relatorio)) {
  console.log(`\n${col}`);
  for (const [k, n] of Object.entries(r)) console.log(`  ${k}: ${n}`);
}
console.log(`\nA preencher: ${planos.length} documento(s).`);

if (GRAVAR) {
  let feitos = 0;
  for (const p of planos) {
    if (p.contador) {
      const r = await fetch(`${BASE}/contadores/${p.contador}?updateMask.fieldPaths=ultimo`, {
        method: 'PATCH', headers: cabecalho, body: JSON.stringify({ fields: { ultimo: { integerValue: String(p.valor) } } }),
      });
      const j = await r.json();
      if (j.error) throw new Error(`contadores/${p.contador}: ${j.error.message}`);
    } else await gravarCampo(p.doc, p.campo, p.valor);
    feitos++;
  }
  console.log(`Gravados: ${feitos}.`);
}
