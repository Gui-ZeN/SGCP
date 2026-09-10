import { describe, it, expect } from 'vitest';
import { montarAgendaDoDia, resumoEmTexto, type FontesAgenda } from './agenda';

const VAZIO: FontesAgenda = {
  selecoes: [], vagas: [], integracoes: [], entrevistas: [], consultas: [], experiencias: [],
};
const fontes = (parcial: Partial<FontesAgenda>): FontesAgenda => ({ ...VAZIO, ...parcial }) as FontesAgenda;

const DIA = '10/09/2026';
const OUTRO = '09/09/2026';

describe('montarAgendaDoDia', () => {
  it('soma convocados e presentes das seleções do dia', () => {
    const { resumo, eventos } = montarAgendaDoDia(DIA, fontes({
      selecoes: [
        { data: DIA, cargo: 'ASG', sede: 'DT', responsavel: 'Camila', convocados: 10, compareceram: 4 },
        { data: DIA, cargo: 'Aprendiz', sede: 'BS', convocados: 5, compareceram: 5 },
        { data: OUTRO, cargo: 'Não conta', sede: 'DT', convocados: 99, compareceram: 99 },
      ] as any,
    }));

    expect(resumo.convocados).toBe(15);
    expect(resumo.compareceram).toBe(9);
    expect(eventos).toHaveLength(2);
    expect(eventos[0].numeros).toBe('10 convocados · 4 compareceram');
    expect(eventos[0].contexto).toBe('DT · Camila');
  });

  it('separa vaga aberta de vaga concluída — a mesma vaga pode ser as duas no dia', () => {
    const { resumo, eventos } = montarAgendaDoDia(DIA, fontes({
      vagas: [
        { vaga: 'ASG', sede: 'DT', setor: 'Infra', solicitante: 'Ana', solicitacao: DIA, conclusao: DIA, tempoProcesso: 0 },
      ] as any,
    }));

    expect(resumo.vagasAbertas).toBe(1);
    expect(resumo.vagasConcluidas).toBe(1);
    expect(eventos.map(e => e.tipo)).toEqual(['vaga-aberta', 'vaga-concluida']);
  });

  it('conta prazos de experiência que vencem no dia', () => {
    const { resumo, eventos } = montarAgendaDoDia(DIA, fontes({
      experiencias: [
        { colaborador: 'Ana', funcao: 'Aux', sede: 'DT', supervisor: 'João', status: 'EM_ANALISE', termino1: DIA, termino2: '25/10/2026' },
        { colaborador: 'Bruno', funcao: 'ASG', sede: 'BS', supervisor: 'Maria', status: 'PRORROGADO', termino1: OUTRO, termino2: DIA },
      ] as any,
    }));

    expect(resumo.prazos).toBe(2);
    expect(eventos.map(e => e.tipo)).toEqual(['experiencia-45', 'experiencia-90']);
    expect(eventos[0].titulo).toBe('Vence 45 dias — Ana');
  });

  it('NÃO cobra prazo de quem já foi efetivado ou encerrado', () => {
    const { resumo } = montarAgendaDoDia(DIA, fontes({
      experiencias: [
        { colaborador: 'Efetivada', status: 'EFETIVADO', termino1: DIA, termino2: DIA },
        { colaborador: 'Encerrado', status: 'ENCERRADO', termino1: DIA, termino2: DIA },
      ] as any,
    }));

    expect(resumo.prazos).toBe(0);
  });

  it('preserva o anonimato na entrevista de desligamento', () => {
    const { eventos } = montarAgendaDoDia(DIA, fontes({
      entrevistas: [
        { colaborador: 'Anônimo', anonima: true, unidade: 'DT', funcao: 'Aux', dataEntrevista: DIA },
      ] as any,
    }));

    expect(eventos[0].titulo).toBe('Entrevista de desligamento — anônima');
  });

  it('mostra consulta aberta e consulta atendida como eventos diferentes', () => {
    const { eventos } = montarAgendaDoDia(DIA, fontes({
      consultas: [
        { funcionario: 'Ana', especialidade: 'Jurídico', dataSolicitacao: DIA, status: 'No aguardo' },
        { funcionario: 'Bruno', especialidade: 'TI', dataSolicitacao: OUTRO, dataAtendimento: DIA, status: 'Atendido' },
      ] as any,
    }));

    expect(eventos.map(e => e.tipo)).toEqual(['consulta-aberta', 'consulta-atendida']);
  });

  it('dia sem nada devolve resumo zerado e lista vazia', () => {
    const { resumo, eventos } = montarAgendaDoDia(DIA, VAZIO);
    expect(eventos).toEqual([]);
    expect(resumo).toMatchObject({ convocados: 0, vagasAbertas: 0, prazos: 0 });
  });
});

describe('resumoEmTexto', () => {
  it('monta a frase só com o que houve', () => {
    const { resumo } = montarAgendaDoDia(DIA, fontes({
      selecoes: [{ data: DIA, cargo: 'ASG', sede: 'DT', convocados: 10, compareceram: 4 }] as any,
      vagas: [{ vaga: 'X', sede: 'DT', setor: 'Y', solicitacao: DIA }] as any,
    }));

    const texto = resumoEmTexto(resumo);
    expect(texto).toContain('10 convocados');
    expect(texto).toContain('4 compareceram');
    expect(texto).toContain('1 vaga aberta');
    expect(texto).not.toContain('integração');   // não houve: não aparece
  });

  it('concorda no singular — "1 vaga aberta", não "1 vagas abertas"', () => {
    const { resumo } = montarAgendaDoDia(DIA, fontes({
      selecoes: [{ data: DIA, cargo: 'ASG', sede: 'DT', convocados: 1, compareceram: 0 }] as any,
      vagas: [{ vaga: 'X', sede: 'DT', setor: 'Y', solicitacao: DIA }] as any,
    }));

    const texto = resumoEmTexto(resumo);
    expect(texto).toContain('1 convocado ');
    expect(texto).toContain('1 vaga aberta');
    expect(texto).not.toContain('vagas abertas');
  });

  it('dia vazio diz que está vazio, em vez de uma frase truncada', () => {
    expect(resumoEmTexto(montarAgendaDoDia(DIA, VAZIO).resumo)).toBe('Nenhum registro neste dia.');
  });
});
