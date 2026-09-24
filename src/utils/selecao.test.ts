import { describe, it, expect } from 'vitest';
import { ehRealizada, estaAtrasada, validarAgendamento, validarConfirmacao, camposDaConfirmacao, totaisDeSelecoes, codigosDasVagas, funilDaVaga, camposDoFormulario, funilEfetivo, selecoesDaVaga, vagasSugeridas, origemDoSetor } from './selecao';
import type { Selecao } from '../types';

const dia = (over: Partial<Selecao>): Selecao => ({
  id: 'x', data: '10/09/2026', cargo: 'ASG', sede: 'DT', responsavel: 'Arlana',
  origem: 'geral', convocados: 0, compareceram: 0, ausentes: 0, contratados: 0,
  desistiram: 0, ...over,
});

describe('ehRealizada', () => {
  it('registro SEM status conta como realizado (os 220 importados da planilha)', () => {
    expect(ehRealizada({} as any)).toBe(true);
  });
  it('agendado não é realizado', () => {
    expect(ehRealizada({ status: 'agendado' })).toBe(false);
  });
  it('realizado é realizado', () => {
    expect(ehRealizada({ status: 'realizado' })).toBe(true);
  });
});

describe('estaAtrasada', () => {
  const hoje = '10/09/2026';

  it('agendado com data passada e sem confirmação está atrasado', () => {
    expect(estaAtrasada({ status: 'agendado', data: '08/09/2026' }, hoje)).toBe(true);
  });
  it('agendado para hoje ainda não está atrasado', () => {
    expect(estaAtrasada({ status: 'agendado', data: hoje }, hoje)).toBe(false);
  });
  it('agendado para o futuro não está atrasado', () => {
    expect(estaAtrasada({ status: 'agendado', data: '15/09/2026' }, hoje)).toBe(false);
  });
  it('já realizado nunca está atrasado, mesmo antigo', () => {
    expect(estaAtrasada({ status: 'realizado', data: '01/01/2026' }, hoje)).toBe(false);
  });
  it('compara por dia/mês/ano, não por texto', () => {
    // '09/12/2025' < '10/09/2026' — comparação ingênua de string diria o contrário.
    expect(estaAtrasada({ status: 'agendado', data: '09/12/2025' }, hoje)).toBe(true);
  });
});

describe('validarAgendamento', () => {
  const ok = { data: '15/09/2026', cargo: 'ASG', sede: 'DT', convocados: 5 };

  it('agendamento completo passa', () => {
    expect(validarAgendamento(ok)).toEqual([]);
  });
  it('exige data, cargo, sede e convocados', () => {
    expect(validarAgendamento({})).toHaveLength(4);
  });
  it('não aceita convocar zero pessoas', () => {
    expect(validarAgendamento({ ...ok, convocados: 0 }))
      .toContain('Informe quantas pessoas foram convocadas.');
  });
});

describe('validarConfirmacao', () => {
  it('presentes dentro do convocado passa', () => {
    expect(validarConfirmacao(10, 4)).toEqual([]);
  });
  it('ninguém apareceu é válido — é o dado que o RH quer mostrar', () => {
    expect(validarConfirmacao(10, 0)).toEqual([]);
  });
  it('mais presentes que convocados é recusado (viraria taxa acima de 100%)', () => {
    expect(validarConfirmacao(5, 8)[0]).toContain('não pode ser maior');
  });
});

describe('camposDaConfirmacao', () => {
  it('calcula os ausentes em vez de pedir digitação', () => {
    expect(camposDaConfirmacao(10, 4)).toEqual({ status: 'realizado', compareceram: 4, ausentes: 6 });
  });
  it('nunca devolve ausentes negativo', () => {
    expect(camposDaConfirmacao(3, 3).ausentes).toBe(0);
  });
});

describe('totaisDeSelecoes', () => {
  it('soma os dias realizados e calcula a taxa', () => {
    const t = totaisDeSelecoes([
      dia({ convocados: 10, compareceram: 4, ausentes: 6, desistiram: 2, contratados: 1 }),
      dia({ convocados: 10, compareceram: 6, ausentes: 4 }),
    ]);
    expect(t).toMatchObject({ convocados: 20, compareceram: 10, ausentes: 10, desistiram: 2, contratados: 1, taxa: 50 });
  });

  it('agendado fica fora da taxa — senão um dia que nem chegou derruba o indicador', () => {
    const t = totaisDeSelecoes([
      dia({ convocados: 10, compareceram: 5, ausentes: 5 }),
      dia({ status: 'agendado', convocados: 40 }),
    ]);
    expect(t.convocados).toBe(10);
    expect(t.taxa).toBe(50);
    expect(t.aConfirmar).toBe(1);
  });

  it('sem nada realizado a taxa é null, não zero', () => {
    expect(totaisDeSelecoes([dia({ status: 'agendado', convocados: 5 })]).taxa).toBeNull();
    expect(totaisDeSelecoes([]).taxa).toBeNull();
  });

  it('arredonda a taxa a uma casa', () => {
    expect(totaisDeSelecoes([dia({ convocados: 3, compareceram: 1 })]).taxa).toBe(33.3);
  });
});

describe('codigosDasVagas', () => {
  it('lê a lista de vagas — uma seleção atende várias', () => {
    expect(codigosDasVagas({ vagaCodigos: [31, 1120] })).toEqual([31, 1120]);
  });

  it('ainda lê o vínculo único gravado antes da lista', () => {
    expect(codigosDasVagas({ vagaCodigo: 24 })).toEqual([24]);
  });

  it('a lista tem precedência quando os dois existem', () => {
    expect(codigosDasVagas({ vagaCodigos: [31, 1120], vagaCodigo: 24 })).toEqual([31, 1120]);
  });

  it('seleção sem vaga devolve lista vazia (pedagógico chama sem vaga)', () => {
    expect(codigosDasVagas({})).toEqual([]);
  });

  it('código zero não é tratado como ausência', () => {
    expect(codigosDasVagas({ vagaCodigo: 0 })).toEqual([0]);
  });
});

describe('funilDaVaga', () => {
  const vaga = { id: 'v1', codigo: 31 };

  it('soma as seleções ligadas pela lista de vagas', () => {
    const f = funilDaVaga([
      dia({ vagaIds: ['v1'], vagaCodigos: [31], convocados: 8, compareceram: 5, contratados: 1 }),
      dia({ vagaIds: ['v1'], vagaCodigos: [31], convocados: 4, compareceram: 4, contratados: 2, data: '11/09/2026' }),
      dia({ vagaIds: ['v9'], vagaCodigos: [99], convocados: 50, compareceram: 50 }),
    ], vaga);

    expect(f).toMatchObject({ selecoes: 2, chamados: 12, compareceram: 9, aprovados: 3 });
    expect(f.ultimaData).toBe('11/09/2026');
  });

  it('acha pelo vínculo único antigo, gravado antes da lista', () => {
    const f = funilDaVaga([dia({ vagaId: 'v1', vagaCodigo: 31, convocados: 6, compareceram: 2 })], vaga);
    expect(f).toMatchObject({ selecoes: 1, chamados: 6, compareceram: 2 });
  });

  it('agendada não entra — senão a vaga herdava "ninguém compareceu"', () => {
    const f = funilDaVaga([
      dia({ vagaIds: ['v1'], convocados: 8, compareceram: 5 }),
      dia({ vagaIds: ['v1'], status: 'agendado', convocados: 40 }),
    ], vaga);
    expect(f).toMatchObject({ selecoes: 1, chamados: 8, compareceram: 5 });
  });

  it('vaga sem seleção devolve tudo zerado, não null', () => {
    expect(funilDaVaga([], vaga)).toMatchObject({ selecoes: 0, chamados: 0, ultimaData: '' });
  });

  it('a última data respeita o calendário, não a ordem alfabética', () => {
    const f = funilDaVaga([
      dia({ vagaIds: ['v1'], data: '09/12/2025', convocados: 1, compareceram: 1 }),
      dia({ vagaIds: ['v1'], data: '10/09/2026', convocados: 1, compareceram: 1 }),
    ], vaga);
    expect(f.ultimaData).toBe('10/09/2026');
  });
});

describe('camposDoFormulario (módulo Seleções)', () => {
  const base = {
    data: '10/09/2026', cargo: 'ASG', sede: 'DT', origem: 'geral' as const, setor: 'Infra', gestor: 'Paulo', responsavel: 'Arlana',
    convocados: 10, jaAconteceu: true, compareceram: 4, ausentes: 6, desistiram: 1, contratados: 2,
  };

  it('seleção que já aconteceu nasce realizada, com os números', () => {
    const { erros, campos } = camposDoFormulario(base);
    expect(erros).toEqual([]);
    expect(campos).toMatchObject({ status: 'realizado', compareceram: 4, ausentes: 6, contratados: 2, setor: 'Infra', gestor: 'Paulo' });
  });

  it('agendada ignora os números de resultado', () => {
    expect(camposDoFormulario({ ...base, jaAconteceu: false }).campos).toMatchObject({ status: 'agendado', compareceram: 0, ausentes: 0, contratados: 0 });
  });

  it('não exige que a conta feche, só barra o impossível', () => {
    expect(camposDoFormulario({ ...base, compareceram: 2, ausentes: 6 }).erros).toEqual([]); // 8 de 10: a planilha tem isso
    expect(camposDoFormulario({ ...base, compareceram: 7, ausentes: 6 }).erros[0]).toMatch(/passa dos convocados/);
    expect(camposDoFormulario({ ...base, contratados: 5 }).erros[0]).toMatch(/Contratados/);
  });

  it('herda as exigências do agendamento', () => {
    expect(camposDoFormulario({ ...base, jaAconteceu: false, cargo: '', convocados: 0 }).erros).toEqual(['Informe o cargo.', 'Informe quantas pessoas foram convocadas.']);
  });
});

describe('seleção ↔ vaga', () => {
  const sel = (over: Partial<Selecao>): Selecao => ({
    id: Math.random().toString(36), data: '10/09/2026', cargo: 'ASG', sede: 'DT', responsavel: '', origem: 'geral',
    convocados: 10, compareceram: 4, ausentes: 6, contratados: 1, desistiram: 0, ...over,
  });
  const vaga = { id: 'v1', codigo: 1143, candChamados: 3, candCompareceram: 2, candAprovados: 1 };

  it('vaga com seleção ligada: o funil é a soma das seleções, não o digitado', () => {
    const f = funilEfetivo(vaga, [sel({ vagaIds: ['v1'] }), sel({ vagaCodigos: [1143], convocados: 5, compareceram: 5, contratados: 0 }), sel({})]);
    expect(f).toEqual({ chamados: 15, compareceram: 9, aprovados: 1, fonte: 'selecao', selecoes: 2 });
  });

  it('sem seleção ligada: vale o que foi digitado na vaga', () => {
    expect(funilEfetivo(vaga, [sel({})])).toMatchObject({ chamados: 3, compareceram: 2, aprovados: 1, fonte: 'manual' });
  });

  it('ligada só por agendamento: a fonte já é a seleção, com zeros até acontecer', () => {
    expect(funilEfetivo(vaga, [sel({ vagaIds: ['v1'], status: 'agendado' })])).toMatchObject({ chamados: 0, fonte: 'selecao', selecoes: 0 });
  });

  it('seleções da vaga: da mais recente para a mais antiga, agendadas incluídas', () => {
    const lista = selecoesDaVaga([sel({ vagaIds: ['v1'], data: '01/09/2026' }), sel({ vagaIds: ['v1'], data: '20/09/2026', status: 'agendado' }), sel({})], vaga);
    expect(lista.map(s => s.data)).toEqual(['20/09/2026', '01/09/2026']);
  });
});

describe('vagasSugeridas', () => {
  const sedes = [{ id: '1', nome: 'DIONISIO TORRES', sigla: 'DT', regiao: '' }] as any[];
  const v = (id: string, vaga: string, sede: string, status = 'ABERTA') => ({ id, vaga, sede, status });
  const vagas = [v('a', 'Pedreiro', 'DT'), v('b', 'ASG', 'DIONISIO TORRES'), v('c', 'ASG', 'BS'), v('d', 'ASG', 'DT', 'FECHADA')];

  it('abertas da mesma sede (nome ou sigla), mesmo cargo primeiro', () => {
    expect(vagasSugeridas(vagas, sedes, 'DT', 'asg').map(x => x.id)).toEqual(['b', 'a']);
  });

  it('já ligada aparece mesmo fechada', () => {
    expect(vagasSugeridas(vagas, sedes, 'DT', 'ASG', ['d']).map(x => x.id)).toContain('d');
  });
});

describe('origemDoSetor', () => {
  it('Pedagógico (com ou sem acento) vai para a planilha pedagógica; o resto, geral', () => {
    expect(origemDoSetor('Pedagógico')).toBe('pedagogico');
    expect(origemDoSetor(' PEDAGOGICO ')).toBe('pedagogico');
    expect(origemDoSetor('Infraestrutura')).toBe('geral');
    expect(origemDoSetor(undefined)).toBe('geral');
  });
});
