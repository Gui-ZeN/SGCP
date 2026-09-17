import { describe, it, expect } from 'vitest';
import { montarArvore, profundidade, descendentes, type NoOrganograma } from './organograma';

const no = (id: string, respondeA?: string, over: Partial<NoOrganograma> = {}): NoOrganograma =>
  ({ id, nome: id.toUpperCase(), cargo: 'Cargo', ...over, respondeA });

const filhos = (item: { filhos: { no: NoOrganograma }[] }) =>
  item.filhos.map(f => f.no.nome);

describe('montarArvore', () => {
  it('sem vínculo nenhum, cada caixa é uma raiz', () => {
    const { raizes, total } = montarArvore([no('a'), no('b')]);
    expect(raizes.map(r => r.no.nome)).toEqual(['A', 'B']);
    expect(total).toBe(2);
  });

  it('monta a cadeia declarada, de cima para baixo', () => {
    const { raizes } = montarArvore([
      no('diretor'),
      no('coord', 'diretor'),
      no('analista', 'coord'),
    ]);

    expect(raizes).toHaveLength(1);
    expect(raizes[0].no.nome).toBe('DIRETOR');
    const coord = raizes[0].filhos[0];
    expect(coord.no.nome).toBe('COORD');
    expect(filhos(coord)).toEqual(['ANALISTA']);
  });

  it('numera o nível pela profundidade, não pelo cargo', () => {
    const { raizes } = montarArvore([no('a'), no('b', 'a'), no('c', 'b')]);
    expect(raizes[0].nivel).toBe(1);
    expect(raizes[0].filhos[0].nivel).toBe(2);
    expect(raizes[0].filhos[0].filhos[0].nivel).toBe(3);
  });

  it('dois chefes com o mesmo cargo não geram ambiguidade — quem manda é o vínculo', () => {
    const { raizes } = montarArvore([
      no('sup1'), no('sup2'),
      no('asg1', 'sup1'), no('asg2', 'sup2'),
    ]);

    const sup1 = raizes.find(r => r.no.nome === 'SUP1')!;
    const sup2 = raizes.find(r => r.no.nome === 'SUP2')!;
    expect(filhos(sup1)).toEqual(['ASG1']);
    expect(filhos(sup2)).toEqual(['ASG2']);
  });

  it('superior apagado: o nó vira raiz e é reportado como órfão', () => {
    const { raizes, orfaos } = montarArvore([no('a'), no('b', 'fantasma')]);
    expect(orfaos.map(o => o.nome)).toEqual(['B']);
    expect(raizes.map(r => r.no.nome)).toEqual(['A', 'B']);
  });

  it('quem responde a si mesmo fica no topo, sem travar', () => {
    const { raizes, orfaos } = montarArvore([no('a', 'a')]);
    expect(raizes).toHaveLength(1);
    expect(orfaos).toHaveLength(0);
  });

  it('ciclo feito à mão não estoura a pilha: os dois viram raiz', () => {
    const { raizes, total } = montarArvore([no('a', 'b'), no('b', 'a')]);
    expect(total).toBe(2);
    expect(raizes.map(r => r.no.nome).sort()).toEqual(['A', 'B']);
  });

  it('ordena irmãos por nome, para o desenho não dançar entre recargas', () => {
    const { raizes } = montarArvore([
      no('chefe'),
      { id: 'z', nome: 'Zilda', respondeA: 'chefe' },
      { id: 'a', nome: 'Ana', respondeA: 'chefe' },
    ]);
    expect(filhos(raizes[0])).toEqual(['Ana', 'Zilda']);
  });

  it('a ordem da lista de entrada não muda o resultado', () => {
    const lista = [no('a'), no('b', 'a'), no('c', 'b')];
    const direto = montarArvore(lista);
    const invertido = montarArvore([...lista].reverse());
    expect(profundidade(direto.raizes)).toBe(profundidade(invertido.raizes));
    expect(direto.raizes).toHaveLength(invertido.raizes.length);
  });
});

describe('profundidade', () => {
  it('conta os degraus', () => {
    const { raizes } = montarArvore([no('a'), no('b', 'a'), no('c', 'b')]);
    expect(profundidade(raizes)).toBe(3);
  });
  it('árvore vazia é zero', () => {
    expect(profundidade([])).toBe(0);
  });
});

describe('descendentes', () => {
  const { raizes } = montarArvore([
    no('diretor'), no('coord', 'diretor'), no('analista', 'coord'), no('outro'),
  ]);

  it('devolve a equipe inteira, em qualquer profundidade', () => {
    expect([...descendentes(raizes, 'diretor')].sort()).toEqual(['analista', 'coord']);
  });
  it('folha não tem descendente', () => {
    expect(descendentes(raizes, 'analista').size).toBe(0);
  });
  it('id inexistente devolve vazio em vez de explodir', () => {
    expect(descendentes(raizes, 'fantasma').size).toBe(0);
  });
});

describe('recorte por setor', () => {
  // Infra responde ao diretor-geral, que é de outro setor.
  const todos = [
    { id: 'dir', nome: 'DIRETOR', setor: 'Administrativo' },
    { id: 'coord', nome: 'COORD INFRA', setor: 'Infra', respondeA: 'dir' },
    { id: 'asg', nome: 'ASG', setor: 'Infra', respondeA: 'coord' },
    { id: 'prof', nome: 'PROFESSOR', setor: 'Pedagógico', respondeA: 'dir' },
  ];
  const idsExistentes = new Set(todos.map(n => n.id));
  const doSetor = (setor: string) => todos.filter(n => n.setor === setor);

  it('o chefe de fora do recorte vira topo, sem virar órfão', () => {
    const { raizes, orfaos } = montarArvore(doSetor('Infra'), idsExistentes);
    expect(orfaos).toHaveLength(0);
    expect(raizes.map(r => r.no.nome)).toEqual(['COORD INFRA']);
    expect(filhos(raizes[0])).toEqual(['ASG']);
  });

  it('cada setor desenha só o seu', () => {
    expect(montarArvore(doSetor('Pedagógico'), idsExistentes).total).toBe(1);
    expect(montarArvore(doSetor('Infra'), idsExistentes).total).toBe(2);
  });

  it('sem o universo de ids, o chefe de fora ainda conta como órfão', () => {
    // É o comportamento de quem monta a árvore inteira: chefe ausente = apagado.
    const { orfaos } = montarArvore(doSetor('Infra'));
    expect(orfaos.map(o => o.nome)).toEqual(['COORD INFRA']);
  });

  it('chefe que nao existe em lugar nenhum segue sendo orfao', () => {
    const { orfaos } = montarArvore(
      [{ id: 'x', nome: 'X', respondeA: 'fantasma' }],
      new Set(['x'])
    );
    expect(orfaos.map(o => o.nome)).toEqual(['X']);
  });
});
