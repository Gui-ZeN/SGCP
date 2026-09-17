/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sincroniza o quadro de funcionários do CROMOS para o SGPC.
 *
 *   npm run sync:cromos            → ENSAIO (não grava nada, só mostra o que faria)
 *   npm run sync:cromos -- --gravar → grava
 *
 * Autenticação: usa a credencial do `gcloud` da máquina de quem roda
 * (`gcloud auth application-default login`). NÃO existe arquivo de chave, e é
 * de propósito: chave de conta de serviço em repositório é o vazamento mais
 * comum que existe. A contrapartida é que este script é manual — roda quando
 * alguém com acesso aos dois projetos o dispara.
 *
 * O SGPC ESPELHA, não fica dono: nome, função, sede, empresa e matrícula vêm do
 * Cromos e são sobrescritos a cada execução. O que é do SGPC — em especial o
 * `respondeA`, a hierarquia que o RH monta arrastando no organograma — fica
 * FORA do `updateMask` e sobrevive à sincronização.
 */
import { execSync } from 'node:child_process';

const CROMOS = 'https://firestore.googleapis.com/v1/projects/cromos-79124/databases/(default)/documents';
const SGPC = 'https://firestore.googleapis.com/v1/projects/project-312a1a63-026e-4dfa-91c/databases/ai-studio-2b395015-7429-44d1-83dd-233de9cd3c47/documents';
const GRAVAR = process.argv.includes('--gravar');

/**
 * Sigla da sede no Cromos → NOME da sede no catálogo do SGPC.
 *
 * Os dois cadastros não usam a mesma nomenclatura, e a sede decide a REGIÃO,
 * que é o que separa Colégio de Universidade no sistema — sede errada joga a
 * pessoa para a unidade errada e contamina indicador.
 *
 * DT1, DT2 e PDT viram uma Dionísio Torres só (decisão do RH em 17/09/2026).
 * `JY` fica de fora de propósito: 3 pessoas numa sigla que não existe no
 * catálogo do SGPC. Sigla nova aparece no relatório final como "SEM MAPA" —
 * ninguém é importado para uma sede inventada.
 */
const MAPA_SEDE = {
  PE: 'PARQUE ECOLÓGICO',
  DT1: 'DIONISIO TORRES',
  DT2: 'DIONISIO TORRES',
  PDT: 'DIONISIO TORRES',
  SP: 'SILVA PAULET',
  ALD: 'ALDEOTA',
  SUL1: 'SUL',
  SUL2: 'SUL 2',
  SUL3: 'SUL 3',
  BEN: 'BENFICA',
  DL: 'DOM LUÍS',
  BS: 'BARAO STUADART',
  PQL1: 'PARQUELANDIA 1',
  PQL2: 'PARQUELANDIA 2',
  PQL3: 'PARQUELANDIA 3',
  EUS: 'EUSEBIO',
  PSUL: 'PRE SUL',
  PNV: 'PRE NUNES',
  PJF: 'PRE JOVITA',
};

let cabecalho;
try {
  const token = execSync('gcloud auth application-default print-access-token', {
    encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  cabecalho = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
} catch {
  console.error('Não consegui obter credencial do gcloud.');
  console.error('Rode: gcloud auth application-default login');
  process.exit(1);
}

const txt = (d, campo) => d.fields?.[campo]?.stringValue || '';

async function lerTudo(colecao, base) {
  const docs = [];
  let pageToken = '';
  do {
    const url = `${base}/${colecao}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const resposta = await fetch(url, { headers: cabecalho });
    const json = await resposta.json();
    if (json.error) throw new Error(`${colecao}: ${json.error.message}`);
    docs.push(...(json.documents || []));
    pageToken = json.nextPageToken || '';
  } while (pageToken);
  return docs;
}

const colaboradores = await lerTudo('colaboradores', CROMOS);
const existentes = await lerTudo('funcionarios', SGPC);

const porOrigem = new Map(
  existentes.map(d => [txt(d, 'origemId'), d.name.split('/').pop()]).filter(([k]) => k)
);

const aCriar = [];
const aAtualizar = [];
const semMapa = {};

colaboradores.forEach(d => {
  const sigla = txt(d, 'sedeCanonica').toUpperCase().trim();
  const sede = MAPA_SEDE[sigla];
  if (!sede) { semMapa[sigla || '(vazia)'] = (semMapa[sigla || '(vazia)'] || 0) + 1; return; }

  const origemId = d.name.split('/').pop();
  const corpo = {
    nome: txt(d, 'nome'),
    cargo: txt(d, 'funcao'),
    sede,
    empresa: txt(d, 'empresa'),
    matricula: txt(d, 'matricula'),
    admissao: txt(d, 'admissao'),
    dataNascimento: txt(d, 'nascimento'),
    // Desligado no Cromos entra como inativo: sai do organograma sem perder o
    // histórico (é o mesmo `ativo` que os aniversários já usavam).
    ativo: !txt(d, 'desligamento'),
    origemSistema: 'cromos',
    origemId,
  };
  (porOrigem.has(origemId) ? aAtualizar : aCriar).push({ corpo, id: porOrigem.get(origemId) });
});

const contar = (lista, campo) => {
  const mapa = {};
  lista.forEach(x => { const v = x.corpo[campo] || '(vazio)'; mapa[v] = (mapa[v] || 0) + 1; });
  return Object.entries(mapa).sort((a, b) => b[1] - a[1]);
};

const todos = [...aCriar, ...aAtualizar];
console.log(`Cromos: ${colaboradores.length} colaboradores`);
console.log(`SGPC hoje: ${existentes.length} em funcionarios`);
console.log(`\nA CRIAR: ${aCriar.length}   A ATUALIZAR: ${aAtualizar.length}`);
console.log('\nPor sede do SGPC:');
contar(todos, 'sede').forEach(([s, n]) => console.log('  ', String(n).padStart(4), s));
console.log('\nPor cargo:');
contar(todos, 'cargo').forEach(([s, n]) => console.log('  ', String(n).padStart(4), s));
const inativos = todos.filter(x => !x.corpo.ativo).length;
if (inativos) console.log(`\nDesligados no Cromos (entram como inativos): ${inativos}`);
if (Object.keys(semMapa).length) {
  console.log('\nSEM MAPA — ficam de fora até a sigla ser mapeada em MAPA_SEDE:');
  Object.entries(semMapa).sort((a, b) => b[1] - a[1]).forEach(([s, n]) => console.log('  ', String(n).padStart(4), s));
}

if (!GRAVAR) {
  console.log('\n[ENSAIO] Nada gravado. Para executar: npm run sync:cromos -- --gravar');
  process.exit(0);
}

const paraCampos = corpo => ({
  fields: Object.fromEntries(Object.entries(corpo).map(([k, v]) => [
    k, typeof v === 'boolean' ? { booleanValue: v } : { stringValue: String(v ?? '') },
  ])),
});

let criados = 0, atualizados = 0, erros = 0;
for (const item of aCriar) {
  const r = await fetch(`${SGPC}/funcionarios`, {
    method: 'POST', headers: cabecalho, body: JSON.stringify(paraCampos(item.corpo)),
  });
  if (r.ok) criados++; else { erros++; if (erros <= 3) console.error(await r.text()); }
}
for (const item of aAtualizar) {
  // updateMask com os campos do Cromos e SÓ eles: `respondeA` não está na
  // lista, então o vínculo de hierarquia feito no organograma não é apagado.
  const mask = Object.keys(item.corpo).map(c => `updateMask.fieldPaths=${c}`).join('&');
  const r = await fetch(`${SGPC}/funcionarios/${item.id}?${mask}`, {
    method: 'PATCH', headers: cabecalho, body: JSON.stringify(paraCampos(item.corpo)),
  });
  if (r.ok) atualizados++; else { erros++; if (erros <= 3) console.error(await r.text()); }
}
console.log(`\nGravado: ${criados} criados, ${atualizados} atualizados, ${erros} erros.`);
if (erros) process.exit(1);
