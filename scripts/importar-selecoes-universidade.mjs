/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Importa a planilha "SELEÇÕES GERAIS" do RH da Universidade (aba GERAL, uma
 * convocação por linha) para `selecoes` + `candidatos`, com escopo
 * 'universidade' — base do Banco de candidatos (16/10/2026).
 *
 *   node scripts/importar-selecoes-universidade.mjs <planilha.xlsx>            → ENSAIO
 *   node scripts/importar-selecoes-universidade.mjs <planilha.xlsx> --gravar   → grava
 *
 * A LISTA DE NOMES MANDA: cada (data, cargo, sede) da aba GERAL vira uma
 * seleção, e os números (convocados, ausentes…) saem dos nomes — como as
 * seleções do Colégio lançadas no sistema (`numerosPelaLista`). A aba QUANTI
 * fica de fora: os dois somam quase o mesmo (10.333 × 10.242), e dois números
 * para o mesmo dia seriam duas verdades.
 *
 * Só cria: documento que já existe (o RH pode ter mexido) é pulado, nunca
 * sobrescrito. Ids determinísticos — rodar de novo não duplica.
 * O relatório só mostra contagens; nenhum nome sai daqui.
 */
import { execSync } from 'node:child_process';
import readXlsxFile from 'read-excel-file/node';

const BASE = 'https://firestore.googleapis.com/v1/projects/project-312a1a63-026e-4dfa-91c/databases/ai-studio-2b395015-7429-44d1-83dd-233de9cd3c47/documents';
const ARQ = process.argv.slice(2).find(a => !a.startsWith('--'));
const GRAVAR = process.argv.includes('--gravar');
// --sem-obs=12,45: linhas (numeração do Excel) cuja observação NÃO entra —
// para o RH tirar o que for de saúde ou antecedente (revisão de 16/10/2026).
const SEM_OBS = new Set((process.argv.find(a => a.startsWith('--sem-obs=')) || '').replace('--sem-obs=', '').split(',').map(Number).filter(Boolean));
// Termos que pedem olho humano antes de virar histórico permanente da pessoa.
const SENSIVEL = {
  'saúde': /atestad|doen[cç]|gravid|gr[aá]vida|\bcid\b|depress|ansiedad|laudo|tratamento|cirurg|psiqui|medica[cç]/i,
  'antecedente/polícia': /pol[ií]cia|antecedent|pres[oa]\b|pres[ií]dio|criminal|boletim|\bb\.?o\b|furto|roubo|droga/i,
  'comportamento': /n[aã]o chamar|indesejad|agress|briga|amea[cç]/i,
};
const sensiveis = {};
if (!ARQ) { console.error('Uso: node scripts/importar-selecoes-universidade.mjs <planilha.xlsx> [--gravar]'); process.exit(1); }

let H;
try {
  const token = execSync('gcloud auth application-default print-access-token', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
} catch { console.error('Sem credencial do gcloud. Rode: gcloud auth application-default login'); process.exit(1); }

const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const limpo = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const hash = s => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h.toString(36); };
const conta = {}; const mais = (k, n = 1) => { conta[k] = (conta[k] || 0) + n; };

// ── Sedes: as que faltam no catálogo da Universidade (decisão do dono, 16/10) ──
// Nome/sigla próprios onde o Colégio já usa o mesmo (CD = Centro de
// Distribuição, DT = Dionísio Torres): o sistema acha a sede por nome OU sigla.
const SEDES_NOVAS = [
  { nome: 'CD UNIVERSIDADE', sigla: 'UCD' },
  { nome: 'DIONISIO TORRES UNIVERSIDADE', sigla: 'UDT' },
  { nome: 'CEVET', sigla: 'CEVET' },
  { nome: 'CEO', sigla: 'CEO' },
  { nome: 'GERAL UNIVERSIDADE', sigla: 'UGE' },
];
const SEDE_DA_PLANILHA = {
  'pe': 'PARQUE ECOLÓGICO', 'aldeota': 'ALDEOTA', 'dl': 'DOM LUÍS', 'dom luis': 'DOM LUÍS',
  'eusebio': 'EUSEBIO', 'pql': 'PARQUELANDIA 3', 'parquelandia': 'PARQUELANDIA 3',
  'benfica': 'UNIBENFICA', 'cesiu': 'CESIU', 'cvu': 'CVU',
  'cd': 'CD UNIVERSIDADE', 'dt': 'DIONISIO TORRES UNIVERSIDADE', 'cevet': 'CEVET', 'ceo': 'CEO', 'geral': 'GERAL UNIVERSIDADE',
};
// "DL/PQL", "PE/Benfica"…: a primeira sede citada. Vazio ou ">": Geral.
const sedeDe = rotulo => {
  const partes = norm(rotulo).split('/').map(s => s.trim()).filter(Boolean);
  for (const p of partes) if (SEDE_DA_PLANILHA[p]) return { nome: SEDE_DA_PLANILHA[p], composta: partes.length > 1 };
  return { nome: 'GERAL UNIVERSIDADE', composta: false, semSede: true };
};

// ── Datas ──
// A planilha está em ordem cronológica (auditoria de 16/10/2026: 46
// regressões em 10.305 datas). Por isso a data inválida ou vazia HERDA a da
// linha de cima — "31/04/2025" está no meio de agosto de 2025, e virar
// 30/04 jogava 22 convocações 3 meses para trás. Data válida mas muito longe
// das vizinhas é só LISTADA (o RH confirma): pode ser erro, pode não ser.
const dataValida = (d, m, a) => { const x = new Date(Date.UTC(+a, +m - 1, +d)); return +a > 2000 && x.getUTCDate() === +d && x.getUTCMonth() === +m - 1; };
const lerData = v => {
  if (v instanceof Date && !isNaN(v)) {
    let y = v.getUTCFullYear();
    if (y > 2100) { y = 2026; mais('datas: ano 20269 → 2026'); }
    return `${String(v.getUTCDate()).padStart(2, '0')}/${String(v.getUTCMonth() + 1).padStart(2, '0')}/${y}`;
  }
  const dig = limpo(v).replace(/\D/g, '');
  if (dig.length === 8 && dataValida(dig.slice(0, 2), dig.slice(2, 4), dig.slice(4))) {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(limpo(v))) mais('datas: escrita sem uma barra ("15/072026") → lida');
    return `${dig.slice(0, 2)}/${dig.slice(2, 4)}/${dig.slice(4)}`;
  }
  return '';
};
const emDias = d => { const [dd, mm, aa] = d.split('/').map(Number); return Date.UTC(aa, mm - 1, dd) / 864e5; };

// ── Resultado e contratação: o vocabulário da planilha → o do sistema ──
const RESULTADO = {
  'ausente': 'ausente', 'fora do perfil': 'fora_perfil', 'fora de perfil': 'fora_perfil', 'nao recomendado': 'fora_perfil',
  'desistiu': 'desistiu', 'desistente': 'desistiu',
  'aprovado (a)': 'aprovado', 'aprovado': 'aprovado', 'aprovada': 'aprovado', 'banco de talentos': 'aprovado',
  'r. observacao': 'r_observacao', 'r. restricao': 'r_restricao', 'restricao com observacao': 'r_restricao',
  'recomendado com restricao': 'r_restricao', 'r. risco': 'risco',
  // "NR" = Não Recomendado (confirmado pelo dono, 16/10/2026).
  'nr': 'fora_perfil',
};
const contratacao = (resultadoTxt, colunaTxt) => {
  const c = norm(colunaTxt);
  if (/^(contratad|admitid|admissao)/.test(c)) return 'sim';
  if (c.startsWith('banco') || norm(resultadoTxt) === 'banco de talentos') return 'banco';
  return '';
};

// ── Leitura ──
const [geral] = await readXlsxFile(ARQ);
const linhas = geral.data.slice(1).map((r, i) => Object.assign(r, { linhaExcel: i + 2 })).filter(r => limpo(r[1]));
const hoje = new Date(); const hojeN = hoje.getFullYear() * 10000 + (hoje.getMonth() + 1) * 100 + hoje.getDate();
const ordem = d => { const [dd, mm, aa] = d.split('/').map(Number); return aa * 10000 + mm * 100 + dd; };

// 1ª passada: as datas, com herança da linha de cima e a lista das suspeitas.
const datas = linhas.map(r => lerData(r[0]));
const herdadas = [], suspeitas = [];
datas.forEach((d, i) => { if (!d && i > 0 && datas[i - 1]) { datas[i] = datas[i - 1]; herdadas.push(linhas[i].linhaExcel); } });
// Suspeita = longe da MEDIANA das 15 linhas de cada lado (erro vem em bloco:
// 6 linhas iguais de 26/06 no meio de agosto "conferem" umas com as outras).
datas.forEach((d, i) => {
  if (!d) return;
  const janela = [...datas.slice(Math.max(0, i - 15), i), ...datas.slice(i + 1, i + 16)].filter(Boolean).map(emDias).sort((p, q) => p - q);
  if (janela.length < 10) return;
  const mediana = janela[Math.floor(janela.length / 2)];
  if (Math.abs(emDias(d) - mediana) <= 40) return;
  // Corrigir pelo contexto (decisão do dono, 16/10/2026): o ano ou o mês da
  // vizinhança, se um dos dois põe a data perto dela. Senão, só listar.
  const [dd, mm, aa] = d.split('/');
  const m = new Date(mediana * 864e5);
  const tentativas = [[dd, mm, String(m.getUTCFullYear())], [dd, String(m.getUTCMonth() + 1).padStart(2, '0'), aa]]
    .filter(([x, y, z]) => dataValida(x, y, z)).map(t => t.join('/'));
  const certa = tentativas.find(t => Math.abs(emDias(t) - mediana) <= 40);
  suspeitas.push(`${linhas[i].linhaExcel} (${d}${certa ? ` → ${certa}` : ', mantida'})`);
  if (certa) { datas[i] = certa; mais('datas: corrigidas pelo contexto (ano ou mês da vizinhança)'); }
});
if (herdadas.length) mais('datas: inválida ou vazia → a da linha de cima', herdadas.length);

// Só o que é ANTERIOR ao uso do sistema pela Universidade (auditoria: a
// planilha tem outubro/2026, que o RH de lá já lança no SGPC — importar
// duplicaria 23 seleções e contaria em dobro). Corte: a 1ª seleção da
// Universidade que NÃO veio desta importação, ou --ate=DD/MM/AAAA.
const corte = await (async () => {
  const arg = (process.argv.find(a => a.startsWith('--ate=')) || '').replace('--ate=', '');
  if (arg) {
    // Formato errado dava NaN e o corte sumia calado (importava outubro de novo).
    const [d, m, a] = arg.split('/');
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(arg) || !dataValida(d, m, a)) { console.error(`--ate=${arg}: use DD/MM/AAAA. Abortado.`); process.exit(1); }
    return arg;
  }
  const r = await fetch(`${BASE}:runQuery`, { method: 'POST', headers: H, body: JSON.stringify({ structuredQuery: {
    from: [{ collectionId: 'selecoes' }], where: { fieldFilter: { field: { fieldPath: 'escopo' }, op: 'EQUAL', value: { stringValue: 'universidade' } } } } }) });
  const docs = (await r.json()).filter(x => x.document && !x.document.name.split('/').pop().startsWith('uni-sel-'));
  const ds = docs.map(x => x.document.fields?.data?.stringValue || '').filter(d => /^\d{2}\/\d{2}\/\d{4}$/.test(d));
  return ds.sort((p, q) => emDias(p) - emDias(q))[0] || '';
})();

const grupos = new Map();
for (const [i, r] of linhas.entries()) {
  const data = datas[i];
  if (!data) { mais('linhas ignoradas: sem data (nem na linha de cima)'); continue; }
  if (corte && emDias(data) >= emDias(corte)) { mais(`linhas de ${corte} em diante (já lançadas no sistema) → fora`); continue; }
  const sede = sedeDe(r[3]);
  if (sede.composta) mais('sede composta (DL/PQL…) → a 1ª citada');
  if (sede.semSede) mais(`sede vazia/irreconhecível → GERAL UNIVERSIDADE`);
  const cargo = limpo(r[2]);
  const chave = `${data}|${norm(cargo)}|${sede.nome}`;
  const g = grupos.get(chave) || grupos.set(chave, { data, sede: sede.nome, cargos: {}, setores: {}, gestores: {}, rhs: {}, nomes: [] }).get(chave);
  const voto = (m, v) => { v = limpo(v); if (v) m[v] = (m[v] || 0) + 1; };
  voto(g.cargos, cargo); voto(g.setores, r[4]); voto(g.gestores, r[5]); voto(g.rhs, r[6]);
  const resTxt = norm(r[7]);
  let resultado = RESULTADO[resTxt];
  if (!resultado) { resultado = 'convocado'; mais(`resultado sem correspondência → sem resultado: "${resTxt || '(vazio)'}"`); }
  const contratado = contratacao(r[7], r[8]);
  // O texto da coluna CONTRATADO/BANCO que não é só "contratado"/"banco" (datas,
  // "desistiu na admissão"…) e as OBSERVAÇÕES vão juntos para a observação.
  const extra = [limpo(r[8]), limpo(r[9]), limpo(r[10])].filter(t => t && !/^(contratad[oa]|banco|banco de talentos)$/i.test(t));
  let observacao = extra.join(' · ').slice(0, 300);
  for (const [tipo, re] of Object.entries(SENSIVEL)) if (re.test(observacao)) (sensiveis[tipo] = sensiveis[tipo] || []).push(r.linhaExcel);
  if (SEM_OBS.has(r.linhaExcel)) { observacao = ''; mais('observação retirada a pedido (--sem-obs)'); }
  g.nomes.push({ nome: limpo(r[1]), resultado, contratado, observacao });
}
const maisVotado = m => Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

const selecoes = [], candidatos = [];
for (const g of grupos.values()) {
  const cargo = maisVotado(g.cargos);
  const id = `uni-sel-${hash(`${g.data}|${norm(cargo)}|${g.sede}`)}`;
  const ausentes = g.nomes.filter(n => n.resultado === 'ausente').length;
  const pendentes = g.nomes.filter(n => n.resultado === 'convocado').length;
  selecoes.push({
    id, data: g.data, cargo, sede: g.sede, setor: maisVotado(g.setores), gestor: maisVotado(g.gestores), responsavel: maisVotado(g.rhs),
    origem: 'geral', convocados: g.nomes.length, ausentes, compareceram: g.nomes.length - ausentes - pendentes,
    desistiram: g.nomes.filter(n => n.resultado === 'desistiu').length, contratados: g.nomes.filter(n => n.contratado === 'sim').length,
    motivos: {},
    // Dia passado é REALIZADO mesmo com nome sem resultado: na planilha ele
    // simplesmente não foi anotado — "agendada" num dia de 2024 seria mentira.
    status: ordem(g.data) <= hojeN ? 'realizado' : 'agendado',
    numerosPelaLista: true, escopo: 'universidade', importadoDe: 'planilha SELEÇÕES GERAIS (Universidade)',
  });
  // Id pelo NOME (e quantas vezes ele já apareceu no dia), não pela posição:
  // o RH ainda mexe na planilha, e inserir uma linha mudava os ids e
  // duplicava na rodada seguinte (auditoria de 16/10/2026).
  const vezesNoDia = {};
  g.nomes.forEach(n => {
    const k = norm(n.nome); vezesNoDia[k] = (vezesNoDia[k] || 0) + 1;
    candidatos.push({
      id: `uni-cand-${hash(`${id}|${k}|${vezesNoDia[k]}`)}`, selecaoId: id, data: g.data, nome: n.nome,
      resultado: n.resultado, contratado: n.contratado, motivo: '', observacao: n.observacao, escopo: 'universidade',
    });
  });
}

// Ids com hash de 32 bits: confere colisão antes de gravar (uma colisão
// abortaria um lote no meio).
for (const lista of [selecoes, candidatos]) {
  const vistos = new Set();
  for (const x of lista) { if (vistos.has(x.id)) { console.error('Colisão de id: ' + x.id + ' — abortado.'); process.exit(1); } vistos.add(x.id); }
}

// ── Relatório ──
const pessoas = new Set(candidatos.map(c => norm(c.nome)));
const porRes = {}; for (const c of candidatos) porRes[c.resultado] = (porRes[c.resultado] || 0) + 1;
const porSede = {}; for (const s of selecoes) porSede[s.sede] = (porSede[s.sede] || 0) + s.convocados;
console.log(GRAVAR ? '── GRAVANDO ──' : '── ENSAIO (nada é gravado; use --gravar) ──');
console.log({ linhas: linhas.length, selecoes: selecoes.length, candidatos: candidatos.length, pessoasDistintas: pessoas.size,
  contratados: candidatos.filter(c => c.contratado === 'sim').length, noBanco: candidatos.filter(c => c.contratado === 'banco').length,
  selecoesAgendadas: selecoes.filter(s => s.status === 'agendado').length });
console.log('por resultado:', porRes);
console.log('convocações por sede:', porSede);
console.log('ajustes:', conta);
console.log('corte (importa só antes de):', corte || '(nenhum — importa tudo)');
console.log('datas herdadas da linha de cima (linhas do Excel):', herdadas.join(', ') || '—');
console.log('datas suspeitas, longe das vizinhas — confirmar com o RH (linhas do Excel):', suspeitas.join(', ') || '—');
console.log('observações para o RH revisar (número da linha no Excel; para tirar: --sem-obs=linha,linha):', sensiveis);

// ── Gravação ──
const valor = v => typeof v === 'number' ? { integerValue: String(v) } : typeof v === 'boolean' ? { booleanValue: v }
  : v && typeof v === 'object' ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, valor(x)])) } } : { stringValue: String(v ?? '') };
const campos = ({ id, ...o }) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, valor(v)]));
async function idsExistentes(colecao, prefixo) {
  const ids = new Set(); let p = '';
  do {
    const j = await (await fetch(`${BASE}/${colecao}?pageSize=300&mask.fieldPaths=escopo${p ? `&pageToken=${p}` : ''}`, { headers: H })).json();
    if (j.error) throw new Error(`${colecao}: ${j.error.message}`);
    for (const d of j.documents || []) { const id = d.name.split('/').pop(); if (id.startsWith(prefixo)) ids.add(id); }
    p = j.nextPageToken || '';
  } while (p);
  return ids;
}
async function commit(writes) {
  for (let i = 0; i < writes.length; i += 400) {
    const r = await fetch(`${BASE.replace(/\/documents$/, '/documents')}:commit`, { method: 'POST', headers: H, body: JSON.stringify({ writes: writes.slice(i, i + 400) }) });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message);
  }
}
const docName = (col, id) => `${BASE.replace('https://firestore.googleapis.com/v1/', '')}/${col}/${id}`;

const sedesAtuais = new Set();
{ const j = await (await fetch(`${BASE}/sedes?pageSize=300`, { headers: H })).json(); for (const d of j.documents || []) sedesAtuais.add(norm(d.fields?.nome?.stringValue)); }
const sedesACriar = SEDES_NOVAS.filter(s => !sedesAtuais.has(norm(s.nome)));
const jaSel = await idsExistentes('selecoes', 'uni-sel-');
const jaCand = await idsExistentes('candidatos', 'uni-cand-');
const novasSel = selecoes.filter(s => !jaSel.has(s.id)), novosCand = candidatos.filter(c => !jaCand.has(c.id));
console.log({ sedesACriar: sedesACriar.map(s => s.nome), selecoesNovas: novasSel.length, selecoesJaExistiam: selecoes.length - novasSel.length,
  candidatosNovos: novosCand.length, candidatosJaExistiam: candidatos.length - novosCand.length });

if (GRAVAR) {
  // Ordem: sedes → seleções → candidatos (a regra exige a seleção do candidato).
  await commit(sedesACriar.map(s => ({ update: { name: docName('sedes', `uni-sede-${hash(s.nome)}`), fields: campos({ ...s, regiao: 'Universidade' }) }, currentDocument: { exists: false } })));
  await commit(novasSel.map(s => ({ update: { name: docName('selecoes', s.id), fields: campos(s) }, currentDocument: { exists: false } })));
  await commit(novosCand.map(c => ({ update: { name: docName('candidatos', c.id), fields: campos(c) }, currentDocument: { exists: false } })));
  console.log(`Gravado: ${sedesACriar.length} sede(s), ${novasSel.length} seleção(ões), ${novosCand.length} candidato(s).`);
}

// ── --corrigir-resultados: um mapeamento novo (ex.: "NR" = Não Recomendado,
// 16/10/2026) aplicado ao que JÁ foi importado. Só mexe em convocação que
// ainda está "sem resultado" — se o RH já lançou outra coisa, vale o do RH.
// Depois refaz os números das seleções tocadas a partir dos nomes do banco.
if (process.argv.includes('--corrigir-resultados')) {
  const atuais = new Map(); let p = '';
  do {
    const j = await (await fetch(`${BASE}/candidatos?pageSize=300&mask.fieldPaths=resultado&mask.fieldPaths=selecaoId&mask.fieldPaths=contratado${p ? `&pageToken=${p}` : ''}`, { headers: H })).json();
    if (j.error) throw new Error(j.error.message);
    for (const d of j.documents || []) {
      const id = d.name.split('/').pop();
      if (id.startsWith('uni-cand-')) atuais.set(id, { resultado: d.fields?.resultado?.stringValue || '', selecaoId: d.fields?.selecaoId?.stringValue || '', contratado: d.fields?.contratado?.stringValue || '' });
    }
    p = j.nextPageToken || '';
  } while (p);
  const trocar = candidatos.filter(c => atuais.get(c.id)?.resultado === 'convocado' && c.resultado !== 'convocado');
  const tocadas = new Set(trocar.map(c => c.selecaoId));
  console.log({ resultadosACorrigir: trocar.length, porResultado: trocar.reduce((m, c) => (m[c.resultado] = (m[c.resultado] || 0) + 1, m), {}), selecoesARecalcular: tocadas.size });
  if (GRAVAR) {
    for (const c of trocar) atuais.get(c.id).resultado = c.resultado;
    await commit(trocar.map(c => ({ update: { name: docName('candidatos', c.id), fields: { resultado: { stringValue: c.resultado } } }, updateMask: { fieldPaths: ['resultado'] }, currentDocument: { exists: true } })));
    const recalc = [...tocadas].map(selId => {
      const nomes = [...atuais.values()].filter(x => x.selecaoId === selId);
      const ausentes = nomes.filter(n => n.resultado === 'ausente').length;
      const pendentes = nomes.filter(n => n.resultado === 'convocado').length;
      const f = { convocados: nomes.length, ausentes, compareceram: nomes.length - ausentes - pendentes,
        desistiram: nomes.filter(n => n.resultado === 'desistiu').length, contratados: nomes.filter(n => n.contratado === 'sim').length };
      return { update: { name: docName('selecoes', selId), fields: campos(f) }, updateMask: { fieldPaths: Object.keys(f) }, currentDocument: { exists: true } };
    });
    await commit(recalc);
    console.log(`Corrigido: ${trocar.length} resultado(s), ${recalc.length} seleção(ões) recalculada(s).`);
  }
}
