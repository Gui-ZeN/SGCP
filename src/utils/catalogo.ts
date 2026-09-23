/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Catálogos que SUGEREM, nunca travam: o RH declara o nome do cargo e do
 * setor; o cadastro só evita que a mesma coisa nasça com três grafias.
 */

/** "Auxiliar de Cantina" e "auxiliar de cantína " são o mesmo nome. */
export function normalizarNome(s: string): string {
  return (s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Sugestões para o nome da vaga: o cadastro de cargos MAIS os nomes já usados
 * em vagas. O cadastro sozinho não bastava — em 23/09/2026 tinha 16 cargos,
 * contra 170 nomes diferentes nas vagas do Colégio ("Auxiliar de Serviços
 * Gerais" em 46 delas e fora do cadastro).
 *
 * Uma grafia por nome: a do cadastro, se houver; senão a mais usada nas vagas.
 */
export function sugestoesDeCargo(cadastro: string[], usados: string[]): string[] {
  const escolhida = new Map<string, string>();
  for (const c of cadastro) {
    const k = normalizarNome(c);
    if (k && !escolhida.has(k)) escolhida.set(k, c.trim());
  }

  const contagem = new Map<string, Map<string, number>>();
  for (const u of usados) {
    const k = normalizarNome(u);
    if (!k || escolhida.has(k)) continue;
    const grafias = contagem.get(k) || new Map<string, number>();
    grafias.set(u.trim(), (grafias.get(u.trim()) || 0) + 1);
    contagem.set(k, grafias);
  }
  for (const [k, grafias] of contagem) {
    escolhida.set(k, [...grafias.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))[0][0]);
  }

  return [...escolhida.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** O setor já cadastrado com esse nome (ignorando caixa e acento), se houver. */
export function setorExistente(setores: string[], nome: string): string | undefined {
  const k = normalizarNome(nome);
  return setores.find(s => normalizarNome(s) === k);
}
