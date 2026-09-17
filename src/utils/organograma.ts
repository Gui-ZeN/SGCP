/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Organograma gerado a partir do NÍVEL DO CARGO.
 *
 * O RH cadastra pessoa + cargo; o nível mora no catálogo de cargos (Diretor 1,
 * Coordenador 2, Supervisor 3…), então ninguém digita hierarquia por pessoa —
 * é definido uma vez por cargo e vale para todo mundo que o ocupa.
 *
 * O QUE O NÍVEL RESOLVE E O QUE NÃO RESOLVE
 * Nível dá a ALTURA de cada caixa, não a linha entre elas. Num setor com um
 * coordenador e cinco analistas, a ligação é óbvia — os analistas respondem ao
 * único coordenador acima. Com DOIS coordenadores no mesmo setor, nenhuma regra
 * de nível diz a qual deles cada analista responde: são dois desenhos
 * igualmente compatíveis com os mesmos dados.
 *
 * Aqui isso não vira chute. Quando há um único superior possível, a linha sai
 * sozinha; quando há mais de um, a pessoa fica como raiz e entra em
 * `ambiguidades`, para a tela pedir a definição só onde ela é necessária. Um
 * organograma que inventa a linha é pior que um que admite não saber: ninguém
 * confere o que parece pronto.
 */

export interface PessoaOrganograma {
  id: string;
  nome: string;
  cargo?: string;
  sede?: string;
  setor?: string;
  /** Superior definido à mão. Vence o nível — existe para desempatar. */
  respondeA?: string;
  ativo?: boolean;
}

export interface NoOrganograma {
  pessoa: PessoaOrganograma;
  nivel: number;
  filhos: NoOrganograma[];
}

export interface Ambiguidade {
  pessoa: PessoaOrganograma;
  /** Superiores possíveis — mesma distância hierárquica, sem desempate. */
  candidatos: PessoaOrganograma[];
  /**
   * Onde a pessoa foi pendurada: o chefe comum de todos os candidatos, quando
   * existe um só. `undefined` = ficou como raiz, sem lugar dedutível.
   */
  penduradaEm?: PessoaOrganograma;
}

export interface Organograma {
  raizes: NoOrganograma[];
  ambiguidades: Ambiguidade[];
  /** Cadastrados cujo cargo não tem nível definido no catálogo. */
  semNivel: PessoaOrganograma[];
  /** Total de pessoas desenhadas na árvore. */
  total: number;
}

const texto = (v?: string) =>
  String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Monta a árvore.
 *
 * @param pessoas    cadastrados (já escopados por unidade/sede pela tela)
 * @param nivelDoCargo nome do cargo (normalizado) → nível; 1 é o topo
 */
export function montarOrganograma(
  pessoas: PessoaOrganograma[],
  nivelDoCargo: Map<string, number>
): Organograma {
  const ativos = pessoas.filter(p => p.ativo !== false);

  const nivelDe = (p: PessoaOrganograma) => nivelDoCargo.get(texto(p.cargo));
  const semNivel = ativos.filter(p => nivelDe(p) === undefined);
  const comNivel = ativos.filter(p => nivelDe(p) !== undefined);

  const porId = new Map(comNivel.map(p => [p.id, p]));
  const ambiguidades: Ambiguidade[] = [];
  const paiDe = new Map<string, string>();

  comNivel.forEach(pessoa => {
    const nivel = nivelDe(pessoa)!;

    // Definição manual vence — é o desempate que a tela grava.
    if (pessoa.respondeA && porId.has(pessoa.respondeA) && pessoa.respondeA !== pessoa.id) {
      paiDe.set(pessoa.id, pessoa.respondeA);
      return;
    }

    // Candidatos: o nível MAIS PRÓXIMO acima. Procura primeiro no mesmo setor;
    // só abre para a sede inteira se o setor não tiver ninguém acima — um
    // coordenador de Cantina responde a um diretor que não é da Cantina.
    const acima = comNivel.filter(o => o.id !== pessoa.id && nivelDe(o)! < nivel);
    const doSetor = acima.filter(
      o => texto(o.sede) === texto(pessoa.sede) && texto(o.setor) === texto(pessoa.setor)
    );
    const daSede = acima.filter(o => texto(o.sede) === texto(pessoa.sede));
    // Três anéis, do mais próximo ao mais largo: mesmo setor → mesma sede →
    // todo o recorte recebido (a região, quando a tela agrupa por região).
    // O terceiro anel existe porque a coordenação é REGIONAL: em Dionísio
    // Torres o coordenador fica lotado numa sede e responde pelas outras, e sem
    // ele o quadro inteiro ficava solto — medido, 126 caixas no topo contra 36.
    const escopo = doSetor.length ? doSetor : (daSede.length ? daSede : acima);
    if (!escopo.length) return; // ninguém acima: é topo

    const maisProximo = Math.max(...escopo.map(o => nivelDe(o)!));
    const candidatos = escopo.filter(o => nivelDe(o)! === maisProximo);

    if (candidatos.length === 1) { paiDe.set(pessoa.id, candidatos[0].id); return; }
    ambiguidades.push({ pessoa, candidatos });
  });

  /**
   * Ambíguo NÃO vira caixa solta: sobe para o chefe comum dos candidatos.
   *
   * No quadro real da infraestrutura — 1 coordenador, 10 supervisores, 5 TME,
   * 36 ASG — cada ASG tem 5 TME possíveis e cada TME tem 10 supervisores
   * possíveis. Deixando cada um como raiz, a tela virava 42 caixas soltas em
   * vez de um organograma. Como todos os candidatos respondem ao mesmo
   * coordenador, a pessoa entra ali: é a afirmação mais forte que os dados
   * sustentam ("está sob a coordenação de X"), sem inventar a linha fina
   * ("responde ao supervisor Y") que ninguém sabe.
   *
   * Roda depois do laço porque depende dos vínculos dos candidatos já
   * resolvidos — o pai do TME só existe após o TME ser ligado.
   *
   * ORDENADO POR NÍVEL, e isso não é detalhe: a ambiguidade encadeia. O ASG
   * depende do TME ter achado o chefe dele, que depende do supervisor. Numa
   * passada na ordem crua, quem viesse antes do próprio candidato ficava sem
   * chefe comum e caía como raiz solta — medido no quadro real de Dionísio
   * Torres: 27 caixas no topo onde o certo era 1.
   */
  [...ambiguidades].sort((a, b) => nivelDe(a.pessoa)! - nivelDe(b.pessoa)!).forEach(amb => {
    const paisDosCandidatos = new Set(
      amb.candidatos.map(c => paiDe.get(c.id)).filter((x): x is string => !!x)
    );
    if (paisDosCandidatos.size !== 1) return;
    const comum = [...paisDosCandidatos][0];
    if (comum === amb.pessoa.id) return;
    paiDe.set(amb.pessoa.id, comum);
    amb.penduradaEm = porId.get(comum);
  });

  // Ciclo só é possível via `respondeA` manual (A responde a B, B responde a A).
  // Detecta sobre uma CÓPIA e só então remove: apagar durante a varredura
  // quebraria uma ponta só, e a outra sobreviveria — o desenho sairia válido
  // com um vencedor escolhido pela ordem de iteração, escondendo o erro de
  // cadastro. Todos os envolvidos viram raiz, onde dá para ver que estão soltos.
  const original = new Map(paiDe);
  const emCiclo = new Set<string>();
  original.forEach((_, id) => {
    const caminho: string[] = [];
    let atual: string | undefined = id;
    while (atual && !caminho.includes(atual)) {
      caminho.push(atual);
      atual = original.get(atual);
    }
    if (atual) caminho.slice(caminho.indexOf(atual)).forEach(x => emCiclo.add(x));
  });
  emCiclo.forEach(id => paiDe.delete(id));

  const nos = new Map<string, NoOrganograma>(
    comNivel.map(p => [p.id, { pessoa: p, nivel: nivelDe(p)!, filhos: [] }])
  );

  const raizes: NoOrganograma[] = [];
  comNivel.forEach(p => {
    const no = nos.get(p.id)!;
    const pai = paiDe.get(p.id);
    if (pai && nos.has(pai)) nos.get(pai)!.filhos.push(no);
    else raizes.push(no);
  });

  const ordenar = (lista: NoOrganograma[]) => {
    lista.sort((a, b) =>
      a.nivel - b.nivel || a.pessoa.nome.localeCompare(b.pessoa.nome, 'pt-BR'));
    lista.forEach(n => ordenar(n.filhos));
  };
  ordenar(raizes);

  return { raizes, ambiguidades, semNivel, total: comNivel.length };
}

/** Quantos níveis a árvore tem de profundidade — usado no rodapé da tela. */
export function profundidade(nos: NoOrganograma[]): number {
  return nos.reduce((max, n) => Math.max(max, 1 + profundidade(n.filhos)), 0);
}
