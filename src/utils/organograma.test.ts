import { describe, it, expect } from 'vitest';
import { montarOrganograma, profundidade, type PessoaOrganograma } from './organograma';

const NIVEIS = new Map([
  ['diretor', 1],
  ['coordenador', 2],
  ['supervisor', 3],
  ['analista', 4],
  ['assistente', 5],
]);

const p = (id: string, cargo: string, over: Partial<PessoaOrganograma> = {}): PessoaOrganograma =>
  ({ id, nome: id.toUpperCase(), cargo, sede: 'DT', setor: 'RH', ...over });

/** Nomes dos filhos diretos, para asserção legível. */
const filhos = (no: { filhos: { pessoa: PessoaOrganograma }[] }) =>
  no.filhos.map(f => f.pessoa.nome).sort();

describe('montarOrganograma', () => {
  it('liga cada pessoa ao único superior do nível imediatamente acima', () => {
    const { raizes, ambiguidades } = montarOrganograma([
      p('ana', 'Coordenador'),
      p('bia', 'Analista'),
      p('caio', 'Analista'),
    ], NIVEIS);

    expect(raizes).toHaveLength(1);
    expect(raizes[0].pessoa.nome).toBe('ANA');
    expect(filhos(raizes[0])).toEqual(['BIA', 'CAIO']);
    expect(ambiguidades).toHaveLength(0);
  });

  it('pula o nível vazio — analista sob diretor quando não há coordenador', () => {
    const { raizes } = montarOrganograma([
      p('dir', 'Diretor'),
      p('ana', 'Analista'),
    ], NIVEIS);

    expect(filhos(raizes[0])).toEqual(['ANA']);
  });

  it('com DOIS superiores possíveis não inventa a linha', () => {
    const { raizes, ambiguidades } = montarOrganograma([
      p('c1', 'Coordenador'),
      p('c2', 'Coordenador'),
      p('ana', 'Analista'),
    ], NIVEIS);

    expect(ambiguidades).toHaveLength(1);
    expect(ambiguidades[0].pessoa.nome).toBe('ANA');
    expect(ambiguidades[0].candidatos.map(c => c.nome).sort()).toEqual(['C1', 'C2']);
    // fica como raiz, visível, em vez de pendurada num chute
    expect(raizes.map(r => r.pessoa.nome).sort()).toEqual(['ANA', 'C1', 'C2']);
  });

  it('respondeA resolve a ambiguidade e vence o nível', () => {
    const { raizes, ambiguidades } = montarOrganograma([
      p('c1', 'Coordenador'),
      p('c2', 'Coordenador'),
      p('ana', 'Analista', { respondeA: 'c2' }),
    ], NIVEIS);

    expect(ambiguidades).toHaveLength(0);
    const c2 = raizes.find(r => r.pessoa.nome === 'C2')!;
    expect(filhos(c2)).toEqual(['ANA']);
  });

  it('procura o superior no mesmo setor antes de abrir para a sede', () => {
    const { raizes } = montarOrganograma([
      p('dir', 'Diretor', { setor: 'Administrativo' }),
      p('coordRH', 'Coordenador', { setor: 'RH' }),
      p('coordTI', 'Coordenador', { setor: 'TI' }),
      p('anaRH', 'Analista', { setor: 'RH' }),
    ], NIVEIS);

    const dir = raizes.find(r => r.pessoa.nome === 'DIR')!;
    expect(filhos(dir)).toEqual(['COORDRH', 'COORDTI']);
    const coordRH = dir.filhos.find(f => f.pessoa.nome === 'COORDRH')!;
    // dois coordenadores na sede, mas só um no setor RH: sem ambiguidade
    expect(filhos(coordRH)).toEqual(['ANARH']);
  });

  it('atravessa sedes dentro do recorte recebido — quem filtra é a tela', () => {
    // Regra ANTERIOR: sede era muro, e cada uma virava uma árvore. Caiu quando
    // medimos o quadro real: a coordenação é regional, o coordenador fica
    // lotado numa sede e responde pelas outras, e o muro deixava 126 caixas
    // soltas no topo contra 36. A util respeita o recorte que recebe (uma
    // região, uma sede) e não conhece região nenhuma.
    const { raizes } = montarOrganograma([
      p('dirDT', 'Diretor', { sede: 'DT' }),
      p('anaBS', 'Analista', { sede: 'BS' }),
    ], NIVEIS);

    expect(raizes.map(r => r.pessoa.nome)).toEqual(['DIRDT']);
    expect(filhos(raizes[0])).toEqual(['ANABS']);
  });

  it('cargo sem nível no catálogo fica de fora da árvore, mas não some', () => {
    const { raizes, semNivel, total } = montarOrganograma([
      p('ana', 'Coordenador'),
      p('zé', 'Estagiário de Verão'),
    ], NIVEIS);

    expect(semNivel.map(s => s.nome)).toEqual(['ZÉ']);
    expect(raizes).toHaveLength(1);
    expect(total).toBe(1);
  });

  it('desligado não entra no organograma', () => {
    const { total, raizes } = montarOrganograma([
      p('ana', 'Coordenador'),
      p('ex', 'Analista', { ativo: false }),
    ], NIVEIS);

    expect(total).toBe(1);
    expect(raizes[0].filhos).toHaveLength(0);
  });

  it('ciclo criado à mão não trava o desenho', () => {
    const { raizes, total } = montarOrganograma([
      p('a', 'Coordenador', { respondeA: 'b' }),
      p('b', 'Coordenador', { respondeA: 'a' }),
    ], NIVEIS);

    expect(total).toBe(2);
    expect(raizes).toHaveLength(2);
  });

  it('respondeA apontando para quem não existe é ignorado', () => {
    const { raizes } = montarOrganograma([
      p('ana', 'Coordenador'),
      p('bia', 'Analista', { respondeA: 'fantasma' }),
    ], NIVEIS);

    expect(filhos(raizes[0])).toEqual(['BIA']);
  });

  it('o cargo casa sem depender de acento ou caixa', () => {
    const { raizes } = montarOrganograma([
      p('ana', 'COORDENADOR'),
      p('bia', 'analista'),
    ], NIVEIS);

    expect(filhos(raizes[0])).toEqual(['BIA']);
  });
});

describe('profundidade', () => {
  it('conta os degraus da árvore', () => {
    const { raizes } = montarOrganograma([
      p('dir', 'Diretor'),
      p('coord', 'Coordenador'),
      p('ana', 'Analista'),
    ], NIVEIS);

    expect(profundidade(raizes)).toBe(3);
  });

  it('árvore vazia tem profundidade zero', () => {
    expect(profundidade([])).toBe(0);
  });
});

describe('ambíguo sobe para o chefe comum', () => {
  const NIVEIS_INFRA = new Map([
    ['coordenador de infra', 3], ['supervisor', 4], ['tme', 5], ['asg', 6],
  ]);
  const time = (cargo: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `${cargo}-${i}`, nome: `${cargo} ${i + 1}`, cargo, sede: 'DT', setor: 'Infraestrutura',
    }));

  const quadroReal = [
    ...time('Coordenador de Infra', 1),
    ...time('Supervisor', 10),
    ...time('TME', 5),
    ...time('ASG', 36),
  ];

  it('o quadro de infra vira UMA árvore, não 42 caixas soltas', () => {
    const { raizes, total } = montarOrganograma(quadroReal, NIVEIS_INFRA);
    expect(total).toBe(52);
    expect(raizes).toHaveLength(1);
    expect(raizes[0].pessoa.cargo).toBe('Coordenador de Infra');
    // 10 supervisores + 5 TME + 36 ASG pendurados na coordenação
    expect(raizes[0].filhos).toHaveLength(51);
  });

  it('cada um dos 36 ASG continua sendo uma caixa com nome próprio', () => {
    const { raizes } = montarOrganograma(quadroReal, NIVEIS_INFRA);
    const asg = raizes[0].filhos.filter(f => f.pessoa.cargo === 'ASG');
    expect(asg).toHaveLength(36);
    expect(new Set(asg.map(a => a.pessoa.nome)).size).toBe(36);
  });

  it('registra onde pendurou, para a tela poder explicar', () => {
    const { ambiguidades } = montarOrganograma(quadroReal, NIVEIS_INFRA);
    expect(ambiguidades).toHaveLength(41);
    expect(ambiguidades.every(a => a.penduradaEm?.cargo === 'Coordenador de Infra')).toBe(true);
  });

  it('sem chefe comum entre os candidatos, continua como raiz', () => {
    const { raizes, ambiguidades } = montarOrganograma([
      p('c1', 'Coordenador'),
      p('c2', 'Coordenador'),
      p('ana', 'Analista'),
    ], NIVEIS);

    expect(ambiguidades[0].penduradaEm).toBeUndefined();
    expect(raizes.map(r => r.pessoa.nome).sort()).toEqual(['ANA', 'C1', 'C2']);
  });
});

describe('ambiguidade encadeada (caso Dionísio Torres)', () => {
  const NIVEIS_DT = new Map([
    ['coordenador(a)', 3], ['supervisor(a)', 4], ['tme', 5], ['asg', 6], ['aprendiz', 7],
  ]);
  const time = (cargo: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `${cargo}-${i}`, nome: `${cargo} ${i + 1}`, cargo, sede: 'DT',
    }));

  it('o nível de baixo não fica solto por depender de um ambíguo de cima', () => {
    // 1 coord, 3 supervisores (ambíguos para quem está abaixo), 2 TME e 56 ASG:
    // o ASG só acha chefe comum DEPOIS que o TME acha o dele.
    const { raizes, total } = montarOrganograma([
      ...time('COORDENADOR(A)', 1),
      ...time('SUPERVISOR(A)', 3),
      ...time('TME', 2),
      ...time('ASG', 56),
      ...time('APRENDIZ', 4),
    ], NIVEIS_DT);

    expect(total).toBe(66);
    expect(raizes).toHaveLength(1);
    expect(raizes[0].pessoa.cargo).toBe('COORDENADOR(A)');
    expect(raizes[0].filhos).toHaveLength(65);
  });

  it('a ordem da lista de entrada não muda o desenho', () => {
    const pessoas = [
      ...time('ASG', 5),
      ...time('TME', 2),
      ...time('COORDENADOR(A)', 1),
      ...time('SUPERVISOR(A)', 3),
    ];
    const direto = montarOrganograma(pessoas, NIVEIS_DT);
    const invertido = montarOrganograma([...pessoas].reverse(), NIVEIS_DT);
    expect(direto.raizes).toHaveLength(1);
    expect(invertido.raizes).toHaveLength(1);
    expect(direto.raizes[0].filhos.length).toBe(invertido.raizes[0].filhos.length);
  });
});

describe('coordenação regional', () => {
  const NIVEIS_REG = new Map([['coordenador(a)', 3], ['supervisor(a)', 4], ['asg', 6]]);

  it('chefe de outra sede do mesmo recorte é aceito quando a sede não tem ninguém acima', () => {
    // Coordenador lotado em DT1 responde pela região inteira.
    const { raizes } = montarOrganograma([
      { id: 'coord', nome: 'COORD', cargo: 'COORDENADOR(A)', sede: 'DT1' },
      { id: 'sup', nome: 'SUP', cargo: 'SUPERVISOR(A)', sede: 'DT2' },
      { id: 'asg', nome: 'ASG', cargo: 'ASG', sede: 'DT2' },
    ], NIVEIS_REG);

    expect(raizes).toHaveLength(1);
    expect(raizes[0].pessoa.nome).toBe('COORD');
    const sup = raizes[0].filhos[0];
    expect(sup.pessoa.nome).toBe('SUP');
    expect(sup.filhos.map(f => f.pessoa.nome)).toEqual(['ASG']);
  });

  it('a própria sede continua tendo precedência sobre a região', () => {
    const { raizes } = montarOrganograma([
      { id: 'supA', nome: 'SUPA', cargo: 'SUPERVISOR(A)', sede: 'BEN' },
      { id: 'supB', nome: 'SUPB', cargo: 'SUPERVISOR(A)', sede: 'SP' },
      { id: 'asg', nome: 'ASG', cargo: 'ASG', sede: 'SP' },
    ], NIVEIS_REG);

    const supB = raizes.find(r => r.pessoa.nome === 'SUPB')!;
    expect(supB.filhos.map(f => f.pessoa.nome)).toEqual(['ASG']);
  });
});
