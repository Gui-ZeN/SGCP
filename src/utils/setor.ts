/**
 * Padronização de SETOR das vagas contra o cadastro (Painel Admin → Setores).
 *
 * Histórico: o form de vaga usava uma lista fixa no código, com duplicatas
 * ("Infra"/"Infraestrutura", "MKT"/"Marketing", "Almoxarifado"/"Almoxarifado
 * geral"). Agora a fonte é o cadastro — então valores antigos podem não ter
 * correspondência. Estas funções são PURAS: dizem o que casa, o que não casa e
 * para onde cada valor legado deveria ir. Quem manda é sempre o CADASTRO.
 */

/** Chave de comparação: sem acento, minúscula, espaços colapsados. */
export function chaveSetor(valor?: string): string {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Apelidos conhecidos: chave legada → candidatos canônicos (em ordem de
 * preferência). Só vira sugestão se o candidato EXISTIR no cadastro.
 */
export const APELIDOS_SETOR: Record<string, string[]> = {
  'mkt': ['Marketing', 'Comunicação Digital'],
  'infra': ['Infraestrutura'],
  'almoxarifado geral': ['Almoxarifado'],
  'ti': ['TI', 'Tecnologia da Informação'],
  'redes': ['Redes', 'TI'],
  'com digital': ['Comunicação Digital'],
  'comunicacao': ['Comunicação Digital'],
  'juridico': ['Jurídico'],
  'pedagogico': ['Pedagógico'],
  'coordenacao': ['Coordenação'],
  'secretaria': ['Secretaria'],
};

/**
 * Resolve o valor de setor de uma vaga para o nome EXATO do cadastro.
 * Retorna null quando não há correspondência (a vaga ficaria "órfã").
 */
export function resolverSetor(valor: string | undefined, cadastrados: string[]): string | null {
  const alvo = chaveSetor(valor);
  if (!alvo) return null;

  // 1) casamento direto (ignora acento/caixa) → devolve o nome canônico do cadastro
  const direto = cadastrados.find(c => chaveSetor(c) === alvo);
  if (direto) return direto;

  // 2) apelido conhecido → primeiro candidato que exista no cadastro
  for (const candidato of APELIDOS_SETOR[alvo] || []) {
    const achado = cadastrados.find(c => chaveSetor(c) === chaveSetor(candidato));
    if (achado) return achado;
  }

  return null;
}

export interface DivergenciaSetor {
  valor: string;          // como está na vaga hoje
  qtd: number;            // quantas vagas usam
  sugestao: string | null; // para onde iria (null = sem correspondência)
}

export interface DiagnosticoSetores {
  totalVagas: number;
  okExato: number;              // já batem exatamente com o cadastro
  divergentes: DivergenciaSetor[]; // precisam de ajuste (com ou sem sugestão)
  semSetor: number;             // vagas com o campo vazio
}

/** Compara os setores em uso nas vagas com o cadastro. */
export function diagnosticarSetores(
  vagas: { setor?: string }[],
  cadastrados: string[]
): DiagnosticoSetores {
  const contagem = new Map<string, number>();
  let okExato = 0;
  let semSetor = 0;

  for (const v of vagas) {
    const bruto = String(v.setor || '').trim();
    if (!bruto) { semSetor++; continue; }
    // exato = idêntico a um item do cadastro (aí não há nada a fazer)
    if (cadastrados.some(c => c === bruto)) { okExato++; continue; }
    contagem.set(bruto, (contagem.get(bruto) || 0) + 1);
  }

  const divergentes = [...contagem.entries()]
    .map(([valor, qtd]) => ({ valor, qtd, sugestao: resolverSetor(valor, cadastrados) }))
    .sort((a, b) => b.qtd - a.qtd || a.valor.localeCompare(b.valor, 'pt-BR'));

  return { totalVagas: vagas.length, okExato, divergentes, semSetor };
}

/** Pares de setores cadastrados que parecem duplicados (para revisão humana). */
export function duplicadosProvaveis(cadastrados: string[]): [string, string][] {
  const pares: [string, string][] = [];
  for (let i = 0; i < cadastrados.length; i++) {
    for (let j = i + 1; j < cadastrados.length; j++) {
      const a = chaveSetor(cadastrados[i]);
      const b = chaveSetor(cadastrados[j]);
      if (!a || !b) continue;
      const apelido =
        (APELIDOS_SETOR[a] || []).some(c => chaveSetor(c) === b) ||
        (APELIDOS_SETOR[b] || []).some(c => chaveSetor(c) === a);
      // mesma raiz (um é prefixo do outro, ex.: "Almoxarifado" / "Almoxarifado geral")
      const prefixo = a !== b && (a.startsWith(b + ' ') || b.startsWith(a + ' '));
      if (a === b || apelido || prefixo) pares.push([cadastrados[i], cadastrados[j]]);
    }
  }
  return pares;
}
