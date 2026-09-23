import { describe, it, expect } from 'vitest';
import { relatoPorPessoa, diaEmFortaleza, listaDeTarefas, totalContado, type EntradaLog, type Diario, type Tarefa } from './resumoDia';

const DIA = '22/09/2026';
const ARLANA = 'arlana@christus.com.br';
// 13:00 UTC = 10:00 em Fortaleza, dia 22.
const e = (over: Partial<EntradaLog>): EntradaLog => ({
  timestamp: '2026-09-22T13:00:00.000Z', usuario: ARLANA,
  acao: 'ALTEROU', modulo: 'Vagas', detalhes: 'x', ...over,
});
const relato = (logs: EntradaLog[], diarios: Diario[] = []) =>
  relatoPorPessoa(logs, diarios, DIA, new Map([[ARLANA, 'Arlana Gomes']]));
const frases = (logs: EntradaLog[], diarios: Diario[] = []) =>
  relato(logs, diarios)[0].secoes.flatMap(s => s.frases);

describe('diaEmFortaleza', () => {
  it('usa o fuso de Fortaleza, não o UTC', () => {
    // 02:30 UTC do dia 23 ainda é 23:30 do dia 22 em Fortaleza.
    expect(diaEmFortaleza('2026-09-23T02:30:00.000Z')).toBe('22/09/2026');
    expect(diaEmFortaleza('2026-09-23T03:00:00.000Z')).toBe('23/09/2026');
  });
});

describe('o relato é frase, não linha de log', () => {
  it('seleção conduzida diz onde, quantos vieram e quantos foram chamados', () => {
    expect(frases([e({
      modulo: 'Seleções', acao: 'ALTEROU',
      ref: { cargo: 'AUXILIAR DE SERVIÇOS GERAIS', sede: 'DIONISIO TORRES', convocados: 3, compareceram: 1 },
    })])).toEqual(['Conduziu a seleção de Auxiliar de Serviços Gerais em Dionisio Torres: 3 convocados, 1 compareceu.']);
  });

  it('correção no módulo Seleções não vira "Conduziu" nem conta como conduzida', () => {
    const r = relato([
      e({ modulo: 'Seleções', acao: 'ALTEROU', ref: { tipo: 'edicao', cargo: 'ASG', sede: 'DT', convocados: 3, compareceram: 1 } }),
      e({ modulo: 'Seleções', acao: 'ALTEROU', ref: { tipo: 'edicao', cargo: 'ASG' } }),
    ]);
    expect(r[0].secoes.flatMap(s => s.frases)).toEqual(['Corrigiu os dados de 2 seleções.']);
    expect(r[0].acumulado.mes.join(' ')).not.toMatch(/conduzida/);
  });

  it('seleção lançada depois do fato vira "Lançou", não "Conduziu" nem "Agendou"', () => {
    const f = frases([
      e({ modulo: 'Seleções', acao: 'CRIOU', ref: { tipo: 'lancamento', cargo: 'ASG', sede: 'DT', data: '10/09/2026', convocados: 5 } }),
      e({ modulo: 'Seleções', acao: 'CRIOU', ref: { tipo: 'lancamento', cargo: 'Pedreiro', sede: 'DT', data: '11/09/2026', convocados: 2 } }),
    ]);
    expect(f).toEqual(['Lançou 2 seleções já realizadas no sistema.']);
  });

  it('comparecimento zero é dito com todas as letras', () => {
    // Foi a queixa do primeiro relatório: horas esperando quem não veio.
    // Esconder o zero não ajuda a resolver.
    expect(frases([e({
      modulo: 'Seleções', acao: 'ALTEROU', ref: { cargo: 'ASG', sede: 'DT', convocados: 3, compareceram: 0 },
    })])[0]).toBe('Conduziu a seleção de ASG em DT: 3 convocados, nenhum compareceu.');
  });

  it('seleção agendada para o próprio dia diz "para hoje"', () => {
    expect(frases([e({
      modulo: 'Seleções', acao: 'CRIOU', ref: { cargo: 'Aprendiz', sede: 'DT', data: DIA, convocados: 5 },
    })])[0]).toBe('Agendou para hoje a seleção de Aprendiz em DT, com 5 convocados.');
  });

  it('vagas abertas agrupadas por sede, somando o lote', () => {
    expect(frases([
      e({ acao: 'CRIOU', ref: { cargo: 'Assistente de tesouraria', sede: 'DOM LUÍS' } }),
      e({ acao: 'CRIOU', ref: { cargo: 'ASG', sede: 'DOM LUÍS', quantidade: 30 } }),
    ])).toEqual(['Abriu 31 vagas em Dom Luís: Assistente de Tesouraria e 30 de ASG.']);
  });

  it('alteração de vaga vira UMA frase de contagem', () => {
    expect(frases([e({}), e({}), e({})])).toEqual(['Atualizou o andamento de 3 vagas.']);
  });

  it('pessoas são citadas pelo nome em experiência, integração e desligamento', () => {
    const f = frases([
      e({ modulo: 'Experiências', acao: 'CRIOU', ref: { colaborador: 'Emilly Bastos' } }),
      e({ modulo: 'Experiências', acao: 'CRIOU', ref: { colaborador: 'Izadora Lima' } }),
      e({ modulo: 'Entrevistas', acao: 'CRIOU', ref: { colaborador: 'João Souza' } }),
    ]);
    expect(f).toContain('Iniciou o acompanhamento do período de experiência de Emilly Bastos e Izadora Lima.');
    expect(f).toContain('Realizou a entrevista de desligamento de João Souza.');
  });

  it('muitos nomes não viram lista: teto de 4 e "mais N"', () => {
    const f = frases(['A', 'B', 'C', 'D', 'E', 'F'].map(n =>
      e({ modulo: 'Integrações', acao: 'CRIOU', ref: { colaborador: n } })));
    expect(f).toContain('Registrou a integração de A, B, C, D e mais 2.');
  });

  it('consulta NUNCA leva nome nem especialidade — é dado de saúde', () => {
    const r = relato([e({
      modulo: 'Consultas', acao: 'CRIOU',
      detalhes: 'Consulta de "Maria Silva" (Psiquiatria) solicitada.',
      ref: { colaborador: 'Maria Silva', especialidade: 'Psiquiatria' },
    })]);
    const tudo = JSON.stringify(r);
    expect(tudo).not.toContain('Maria Silva');
    expect(tudo).not.toContain('Psiquiatria');
    expect(r[0].secoes.flatMap(s => s.frases)).toContain('Encaminhou 1 consulta de colaboradores.');
  });

  it('importação de planilha não vira "abriu 50 vagas"', () => {
    const f = frases([e({ acao: 'CRIOU', detalhes: 'Importação da planilha anual: 50 vaga(s) da aba "SET".' })]);
    expect(f.join(' ')).not.toMatch(/Abriu/);
    expect(f).toContain('Importou 1 planilha para o sistema.');
  });

  it('candidatos viram UMA frase por seleção, contados por pessoa, sem nome', () => {
    const cand = (acao: string, candidato: string) =>
      e({ modulo: 'Candidatos', acao, ref: { cargo: 'AUXILIAR DE CANTINA', data: DIA, candidato } });
    const r = relato([cand('CRIOU', 'k1'), cand('CRIOU', 'k2'), cand('ALTEROU', 'k1'), cand('ALTEROU', 'k3'), cand('ALTEROU', 'k3')]);
    expect(r[0].secoes.find(s => s.titulo === 'Seleções')!.frases).toEqual([
      `Registrou 2 candidatos na seleção de Auxiliar de Cantina de ${DIA}.`,
      // k1 foi registrado agora (já contou acima); k3 teve o resultado lançado duas vezes.
      `Lançou o resultado de 1 candidato na seleção de Auxiliar de Cantina de ${DIA}.`,
    ]);
  });

  it('ajuste de cadastro não entra no relato — nem conta como dia trabalhado', () => {
    // Configurar usuário, sede ou cargo não é trabalho do RH para a direção ler.
    const cad = ['Usuários', 'Sedes', 'Cargos', 'Setores', 'Regiões'].map(modulo => e({ modulo, acao: 'ALTEROU' }));
    expect(relato(cad)).toEqual([]);
    const r = relato([...cad, e({})]);
    expect(r[0].acoes).toBe(1);
    expect(r[0].secoes.flatMap(s => s.frases)).toEqual(['Atualizou o andamento de 1 vaga.']);
  });

  it('"sistema" (import, manutenção) não é pessoa: não vira relato', () => {
    expect(relato([e({ usuario: 'sistema', modulo: 'Candidatos', acao: 'CRIOU' })])).toEqual([]);
  });

  it('registro antigo, sem campos, ainda entra como contagem', () => {
    // Antes de 22/09 o log não gravava `ref`; nada do que a pessoa fez some.
    const f = frases([
      e({ acao: 'CRIOU', detalhes: 'Vaga "ASG" (Sede: DT) cadastrada.' }),
      e({ modulo: 'Vagas', acao: 'CRIOU', detalhes: 'Seleção agendada: ASG em DT, 22/09/2026 — 3 convocado(s).' }),
    ]);
    expect(f).toContain('Abriu 1 vaga.');
    expect(f).toContain('Agendou 1 seleção.');
  });
});

describe('o que a pessoa informou à mão', () => {
  it('cada tarefa vira "Nome: quantidade", e a atividade vem por extenso', () => {
    const diario: Diario = { email: ARLANA, data: DIA, contagens: { atendimentos: 6, testes: 1, divulgacoes: 3, acolhimentos: 2 } };
    const s = relato([
      e({ modulo: 'Resumo do Dia', acao: 'CRIOU', ref: { titulo: 'Montagem dos kits do Setembro Amarelo', detalhe: '120 kits' } }),
    ], [diario])[0].secoes.find(x => x.titulo === 'Também informou')!;
    expect(s.frases).toEqual([
      'Atendimentos a colaboradores: 6.',
      'Testes psicológicos aplicados: 1.',
      'Vagas divulgadas: 3.',
      'Novos colaboradores acolhidos: 2.',
      'Montagem dos kits do Setembro Amarelo — 120 kits.',
    ]);
  });

  it('tarefa criada pela equipe aparece com o nome que ela deu', () => {
    const tarefas: Tarefa[] = [{ id: 't1', nome: 'Entrevistas por telefone', ordem: 5 }];
    const r = relatoPorPessoa([], [{ email: ARLANA, data: DIA, contagens: { t1: 8 } }], DIA, new Map(), tarefas);
    expect(r[0].secoes[0].frases).toEqual(['Entrevistas por telefone: 8.']);
  });

  it('tarefa ARQUIVADA continua dando nome ao que já foi contado', () => {
    // Arquivar tira do formulário, não do histórico: o acumulado do mês ainda
    // precisa dizer o que era aquele número.
    const tarefas: Tarefa[] = [{ id: 't1', nome: 'Plantão de sábado', arquivada: true }];
    const r = relatoPorPessoa([], [{ email: ARLANA, data: DIA, contagens: { t1: 1 } }], DIA, new Map(), tarefas);
    expect(r[0].secoes[0].frases).toEqual(['Plantão de sábado: 1.']);
  });

  it('a equipe pode renomear uma tarefa padrão', () => {
    const tarefas: Tarefa[] = [{ id: 'atendimentos', nome: 'Atendimentos presenciais' }];
    const r = relatoPorPessoa([], [{ email: ARLANA, data: DIA, contagens: { atendimentos: 3 } }], DIA, new Map(), tarefas);
    expect(r[0].secoes[0].frases).toEqual(['Atendimentos presenciais: 3.']);
  });

  it('quem só informou, sem mexer no sistema, também tem relato', () => {
    const r = relatoPorPessoa([], [{ email: ARLANA, data: DIA, contagens: { atendimentos: 4 } }], DIA);
    expect(r).toHaveLength(1);
    expect(r[0].acoes).toBe(0);
  });

  it('diário todo zerado não gera relato', () => {
    expect(relatoPorPessoa([], [{ email: ARLANA, data: DIA, contagens: { atendimentos: 0 } }], DIA)).toEqual([]);
  });

  it('valor estranho gravado na contagem não quebra o relato', () => {
    // A regra do banco não consegue validar cada valor de um mapa; o relato se
    // defende sozinho e ignora o que não é número positivo.
    const r = relatoPorPessoa([], [{ email: ARLANA, data: DIA, contagens: { atendimentos: 'x' as any, testes: -3, divulgacoes: 2 } }], DIA);
    expect(r[0].secoes[0].frases).toEqual(['Vagas divulgadas: 2.']);
  });
});

describe('listaDeTarefas', () => {
  it('as padrão primeiro, na ordem delas; o banco renomeia, arquiva e acrescenta', () => {
    const l = listaDeTarefas([
      { id: 'testes', nome: 'Testes psicológicos', arquivada: true },
      { id: 'nova', nome: 'Reunião com gestor' },
    ]);
    expect(l.map(t => [t.id, t.nome, !!t.arquivada])).toEqual([
      ['atendimentos', 'Atendimentos a colaboradores', false],
      ['testes', 'Testes psicológicos', true],
      ['divulgacoes', 'Vagas divulgadas', false],
      ['acolhimentos', 'Novos colaboradores acolhidos', false],
      ['nova', 'Reunião com gestor', false],
    ]);
  });
});

describe('acumulado da própria pessoa', () => {
  const conduzida = (ts: string) => e({ timestamp: ts, modulo: 'Seleções', acao: 'ALTEROU', ref: { cargo: 'X', convocados: 1, compareceram: 1 } });

  it('mês e ano separados, e só até o dia do relato', () => {
    const r = relato([
      conduzida('2026-09-22T13:00:00.000Z'),
      conduzida('2026-09-05T13:00:00.000Z'),
      conduzida('2026-08-10T13:00:00.000Z'),
      conduzida('2026-09-25T13:00:00.000Z'), // depois do dia: não conta
      conduzida('2025-09-10T13:00:00.000Z'), // outro ano: não conta
    ])[0];
    expect(r.acumulado.mes).toEqual(['2 seleções conduzidas']);
    expect(r.acumulado.ano).toEqual(['3 seleções conduzidas']);
  });

  it('soma o que foi informado à mão no período, por tarefa', () => {
    const r = relato([e({})], [
      { email: ARLANA, data: DIA, contagens: { atendimentos: 6 } },
      { email: ARLANA, data: '10/09/2026', contagens: { atendimentos: 4 } },
      { email: ARLANA, data: '10/08/2026', contagens: { atendimentos: 1 } },
    ])[0];
    expect(r.acumulado.mes).toContain('Atendimentos a colaboradores: 10');
    expect(r.acumulado.ano).toContain('Atendimentos a colaboradores: 11');
  });
});

describe('recorte e ordem', () => {
  it('o dia é o de Fortaleza, e cada pessoa só vê o que é dela', () => {
    const r = relatoPorPessoa([
      e({ timestamp: '2026-09-23T02:30:00.000Z' }),            // 23:30 do dia 22
      e({ timestamp: '2026-09-23T03:30:00.000Z' }),            // 00:30 do dia 23
      e({ usuario: 'Jenifer@christus.com.br' }),
    ], [], DIA);
    expect(r.map(p => [p.email, p.acoes])).toEqual([
      [ARLANA, 1],
      ['jenifer@christus.com.br', 1],
    ]);
  });

  it('sem nome no cadastro, usa o e-mail', () => {
    expect(relatoPorPessoa([e({})], [], DIA)[0].nome).toBe(ARLANA);
  });

  it('quem mais fez vem primeiro', () => {
    const r = relatoPorPessoa([
      e({ usuario: 'pouco@x.com' }),
      e({ usuario: 'muito@x.com' }), e({ usuario: 'muito@x.com' }),
    ], [], DIA);
    expect(r.map(p => p.email)).toEqual(['muito@x.com', 'pouco@x.com']);
  });
});

describe('contador apagado', () => {
  it('a contagem dele some do relato e do acumulado — nunca aparece o id interno', () => {
    const r = relatoPorPessoa([], [{ email: ARLANA, data: DIA, contagens: { atendimentos: 2, tApagado: 5 } }], DIA, new Map(), []);
    const tudo = JSON.stringify(r);
    expect(tudo).not.toContain('tApagado');
    expect(r[0].secoes[0].frases).toEqual(['Atendimentos a colaboradores: 2.']);
    expect(r[0].acumulado.mes).toEqual(['Atendimentos a colaboradores: 2']);
  });

  it('quem só tinha contado no apagado não aparece no dia', () => {
    expect(relatoPorPessoa([], [{ email: ARLANA, data: DIA, contagens: { tApagado: 5 } }], DIA, new Map(), [])).toEqual([]);
  });

  it('totalContado soma todas as pessoas e dias, ignorando zero e negativo', () => {
    expect(totalContado('t1', [{ contagens: { t1: 2 } }, { contagens: { t1: 0 } }, { contagens: { t1: -1 } }, {}])).toBe(2);
  });
});
