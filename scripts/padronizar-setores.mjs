/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Padroniza o campo `setor` em todo o banco.
 *
 *   npm run setores:padronizar              → ENSAIO (não grava)
 *   npm run setores:padronizar -- --gravar  → grava
 *
 * Medido em 17/09/2026: 2.780 registros e mais de 120 nomes distintos para um
 * catálogo de 24. Três problemas diferentes, tratados separadamente:
 *
 *  1. MESMO nome com grafia diferente (Som/SOM, Pedagogico/Pedagógico,
 *     "Secretaria de cursos"/"Secretaria de Cursos"). Regra automática: nomes
 *     que normalizam igual viram um só. Vence o nome do CATÁLOGO; se nenhum
 *     estiver no catálogo, vence o mais usado.
 *  2. Nomes diferentes para a mesma área (Infra/INFRA → Infraestrutura, 712
 *     registros). Não dá para deduzir — vem da lista explícita abaixo,
 *     decidida pelo RH.
 *  3. SEDE preenchida no lugar do setor (Dom Luís, Aldeota, Eusébio…, ~410
 *     registros). O campo é ESVAZIADO: vazio é melhor que errado, e o valor
 *     continua na coluna `sede` do próprio registro.
 *
 * Nunca esvazia um nome que também é setor legítimo do catálogo — "Construtora"
 * e "D. Valéria" são sede E setor ao mesmo tempo.
 */
import { execSync } from 'node:child_process';

const BASE = 'https://firestore.googleapis.com/v1/projects/project-312a1a63-026e-4dfa-91c/databases/ai-studio-2b395015-7429-44d1-83dd-233de9cd3c47/documents';
const GRAVAR = process.argv.includes('--gravar');
const COLECOES = ['vagas', 'funcionarios', 'organograma', 'integracoes', 'experiencia'];

/** Fusões que o dado não revela — decisão de nomenclatura do RH. */
const FUSOES = {
  'infra': 'Infraestrutura',
  'adm infra': 'Infraestrutura',
};

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
const norma = t => String(t || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[.\-_/]/g, ' ').replace(/\s+/g, ' ').trim();

async function ler(colecao) {
  const docs = []; let p = '';
  do {
    const r = await fetch(`${BASE}/${colecao}?pageSize=300${p ? `&pageToken=${p}` : ''}`, { headers: cabecalho });
    const j = await r.json();
    if (j.error) throw new Error(`${colecao}: ${j.error.message}`);
    docs.push(...(j.documents || [])); p = j.nextPageToken || '';
  } while (p);
  return docs;
}

const catalogoSetores = (await ler('setores')).map(d => txt(d, 'nome')).filter(Boolean);
const catalogoSedes = (await ler('sedes')).map(d => ({ nome: txt(d, 'nome'), sigla: txt(d, 'sigla') }));

const setorDoCatalogo = new Map(catalogoSetores.map(n => [norma(n), n]));
const ehSede = valor => {
  const k = norma(valor);
  if (setorDoCatalogo.has(k)) return false; // Construtora e D. Valéria são os dois
  return catalogoSedes.some(s => norma(s.nome) === k || (s.sigla && norma(s.sigla) === k));
};

// 1. Levanta o uso de cada nome
const registros = [];
for (const colecao of COLECOES) {
  (await ler(colecao)).forEach(d => {
    const setor = txt(d, 'setor').trim();
    if (setor) registros.push({ colecao, id: d.name.split('/').pop(), setor });
  });
}
const uso = new Map();
registros.forEach(r => uso.set(r.setor, (uso.get(r.setor) || 0) + 1));

// 2. Vencedor de cada grupo que normaliza igual
const grupos = new Map();
[...uso.keys()].forEach(nome => {
  const k = norma(nome);
  grupos.set(k, [...(grupos.get(k) || []), nome]);
});
const vencedor = new Map();
grupos.forEach((nomes, k) => {
  const doCatalogo = setorDoCatalogo.get(k);
  vencedor.set(k, doCatalogo || nomes.sort((a, b) => (uso.get(b) - uso.get(a)) || a.localeCompare(b))[0]);
});

// 3. Decide o destino de cada registro
const planoRenomear = new Map(); // "de -> para" → quantos
const planoLimpar = new Map();
const alteracoes = [];
registros.forEach(r => {
  if (ehSede(r.setor)) {
    planoLimpar.set(r.setor, (planoLimpar.get(r.setor) || 0) + 1);
    alteracoes.push({ ...r, novo: '' });
    return;
  }
  const alvo = FUSOES[norma(r.setor)] || vencedor.get(norma(r.setor));
  if (alvo && alvo !== r.setor) {
    const chave = `${r.setor} → ${alvo}`;
    planoRenomear.set(chave, (planoRenomear.get(chave) || 0) + 1);
    alteracoes.push({ ...r, novo: alvo });
  }
});

console.log(`Registros com setor preenchido: ${registros.length}`);
console.log(`Nomes distintos hoje: ${uso.size}`);
console.log(`\nRENOMEAR (${[...planoRenomear.values()].reduce((a, b) => a + b, 0)} registros):`);
[...planoRenomear.entries()].sort((a, b) => b[1] - a[1])
  .forEach(([k, n]) => console.log(`  ${String(n).padStart(4)}  ${k}`));
console.log(`\nESVAZIAR — sede no campo setor (${[...planoLimpar.values()].reduce((a, b) => a + b, 0)} registros):`);
[...planoLimpar.entries()].sort((a, b) => b[1] - a[1])
  .forEach(([k, n]) => console.log(`  ${String(n).padStart(4)}  ${k}`));

const depois = new Set(registros.map(r => {
  if (ehSede(r.setor)) return null;
  return FUSOES[norma(r.setor)] || vencedor.get(norma(r.setor)) || r.setor;
}).filter(Boolean));
console.log(`\nNomes distintos depois: ${depois.size} (de ${uso.size})`);

if (!GRAVAR) {
  console.log('\n[ENSAIO] Nada gravado. Para executar: npm run setores:padronizar -- --gravar');
  process.exit(0);
}

let ok = 0, erros = 0;
for (const a of alteracoes) {
  const r = await fetch(`${BASE}/${a.colecao}/${a.id}?updateMask.fieldPaths=setor`, {
    method: 'PATCH', headers: cabecalho,
    body: JSON.stringify({ fields: { setor: { stringValue: a.novo } } }),
  });
  if (r.ok) ok++; else { erros++; if (erros <= 3) console.error(await r.text()); }
}
console.log(`\nGravado: ${ok} registros atualizados, ${erros} erros.`);
if (erros) process.exit(1);
