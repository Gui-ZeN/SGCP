/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Árvore do organograma a partir do vínculo DECLARADO.
 *
 * A versão anterior deduzia a hierarquia do nível do cargo, e estava errada de
 * origem: nível dá a altura da caixa, não a linha entre elas. No quadro real
 * (399 pessoas, 3 coordenadores, 22 supervisores) isso deixava 36 caixas soltas
 * no topo e 233 pessoas penduradas onde o sistema "achou" — um desenho que
 * parece pronto e ninguém confere.
 *
 * Aqui cada nó diz a quem responde, e ponto. Quem monta é o RH, de cima para
 * baixo. O quadro de funcionários entra só como SUGESTÃO de nome ao escolher o
 * cargo — não como fonte da estrutura.
 */

export interface NoOrganograma {
  id: string;
  nome: string;
  cargo?: string;
  sede?: string;
  /** Recorte do desenho: cada setor tem o seu organograma. */
  setor?: string;
  /** id do superior. Vazio = está no topo. */
  respondeA?: string;
}

export interface ArvoreNo {
  no: NoOrganograma;
  /** Profundidade a partir da raiz, começando em 1. */
  nivel: number;
  filhos: ArvoreNo[];
}

export interface Arvore {
  raizes: ArvoreNo[];
  /** Nós cujo superior aponta para alguém que não existe mais. */
  orfaos: NoOrganograma[];
  total: number;
}

/**
 * Monta a árvore.
 *
 * Trata dois defeitos que o dado permite e a tela não pode quebrar por causa
 * deles: superior apagado (o nó vira raiz e é reportado como órfão) e ciclo
 * criado à mão (A→B→A), que estouraria a pilha na renderização.
 */
export function montarArvore(nos: NoOrganograma[], idsExistentes?: Set<string>): Arvore {
  const porId = new Map(nos.map(n => [n.id, n]));

  const orfaos: NoOrganograma[] = [];
  const paiDe = new Map<string, string>();
  nos.forEach(n => {
    if (!n.respondeA || n.respondeA === n.id) return;
    if (!porId.has(n.respondeA)) {
      // Chefe fora da LISTA mas existente no desenho (é o caso ao ver um setor
      // só: o coordenador de Infra responde a um diretor de outro setor). Isso
      // é topo do recorte, não órfão — avisar seria alarme falso a cada filtro.
      // Órfão de verdade é chefe que não existe em lugar nenhum: foi apagado.
      if (!idsExistentes || !idsExistentes.has(n.respondeA)) orfaos.push(n);
      return;
    }
    paiDe.set(n.id, n.respondeA);
  });

  // Ciclo: detecta sobre uma cópia e só então remove TODOS os envolvidos.
  // Apagar durante a varredura quebraria uma ponta só, e a outra sobreviveria —
  // o desenho sairia válido com um vencedor escolhido pela ordem de iteração.
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

  const criados = new Map<string, ArvoreNo>(
    nos.map(n => [n.id, { no: n, nivel: 1, filhos: [] }])
  );

  const raizes: ArvoreNo[] = [];
  nos.forEach(n => {
    const atual = criados.get(n.id)!;
    const pai = paiDe.get(n.id);
    if (pai && criados.has(pai)) criados.get(pai)!.filhos.push(atual);
    else raizes.push(atual);
  });

  const numerar = (lista: ArvoreNo[], nivel: number) => {
    lista.sort((a, b) => a.no.nome.localeCompare(b.no.nome, 'pt-BR'));
    lista.forEach(item => {
      item.nivel = nivel;
      numerar(item.filhos, nivel + 1);
    });
  };
  numerar(raizes, 1);

  return { raizes, orfaos, total: nos.length };
}

/** Quantos degraus a árvore tem. */
export function profundidade(nos: ArvoreNo[]): number {
  return nos.reduce((max, n) => Math.max(max, 1 + profundidade(n.filhos)), 0);
}

/**
 * Descendentes de um nó — usado para barrar o arraste que inverteria a ordem
 * (soltar um chefe dentro da própria equipe).
 */
export function descendentes(raizes: ArvoreNo[], id: string): Set<string> {
  const achar = (lista: ArvoreNo[]): ArvoreNo | null => {
    for (const item of lista) {
      if (item.no.id === id) return item;
      const achado = achar(item.filhos);
      if (achado) return achado;
    }
    return null;
  };
  const alvo = achar(raizes);
  const saco = new Set<string>();
  const descer = (item: ArvoreNo) => item.filhos.forEach(f => { saco.add(f.no.id); descer(f); });
  if (alvo) descer(alvo);
  return saco;
}
