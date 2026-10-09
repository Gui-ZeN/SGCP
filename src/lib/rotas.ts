/**
 * Endereço de cada tela (#/vagas) e do que ela abre (#/vagas?vaga=124).
 *
 * Toda ligação entre telas passa por aqui: um código de vaga numa seleção, um
 * item do Início, um número dos Indicadores viram um link comum. O Voltar do
 * navegador volta para onde se estava, o F5 mantém a tela e o link pode ser
 * mandado para alguém. Antes cada atalho era um estado de "foco" à parte.
 */
export const ENDERECO_DA_ABA = {
  home: 'inicio',
  dashboard: 'indicadores',
  vagas: 'vagas',
  requisicoes: 'requisicoes',
  selecoesLista: 'selecoes',
  selecoes: 'resumo-do-dia',
  treinamentos: 'treinamentos',
  experiencias: 'experiencia',
  entrevistas: 'entrevistas',
  turnover: 'turnover',
  organograma: 'organograma',
  integracao: 'integracao',
  consultas: 'consultas',
  admin: 'admin',
} as const;

export type Aba = keyof typeof ENDERECO_DA_ABA;

/**
 * O que a tela abre: `vaga` (código), `selecao` (id), `dia` (AAAA-MM-DD),
 * `pessoa` (nome, na Experiência) e `novaSelecao` (id da vaga: abre o
 * formulário de nova seleção já com ela marcada).
 */
const PARAMETROS = ['vaga', 'selecao', 'dia', 'pessoa', 'novaSelecao'] as const;
export type ParametrosDaRota = Partial<Record<(typeof PARAMETROS)[number], string>>;

export interface Rota {
  aba: Aba;
  params: ParametrosDaRota;
}

export function lerRota(hash: string): Rota {
  const [caminho, consulta = ''] = hash.replace(/^#\/?/, '').split('?');
  const aba = (Object.keys(ENDERECO_DA_ABA) as Aba[]).find(a => ENDERECO_DA_ABA[a] === caminho) ?? 'home';
  const params: ParametrosDaRota = {};
  new URLSearchParams(consulta).forEach((valor, chave) => {
    if ((PARAMETROS as readonly string[]).includes(chave) && valor) params[chave as keyof ParametrosDaRota] = valor;
  });
  return { aba, params };
}

export function linkPara(aba: Aba, params: Partial<Record<keyof ParametrosDaRota, string | number | null | undefined>> = {}): string {
  const consulta = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor != null && valor !== '') consulta.set(chave, String(valor));
  }
  const q = consulta.toString();
  return `#/${ENDERECO_DA_ABA[aba]}${q ? `?${q}` : ''}`;
}
