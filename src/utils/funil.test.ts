import { describe, it, expect } from 'vitest';
import { funilCompleto, indiceDeExperiencia } from './funil';

const sel = (o: any) => ({ id: Math.random().toString(), data: '10/09/2026', cargo: 'ASG', sede: 'BN', status: 'realizado', convocados: 0, compareceram: 0, ausentes: 0, desistiram: 0, contratados: 0, ...o });
const vaga = (o: any) => ({ id: Math.random().toString(), vaga: 'ASG', sede: 'BN', setor: 'Infraestrutura', status: 'ABERTA', ...o });
const exp = (colaborador: string, status: string) => ({ id: colaborador, colaborador, status } as any);

const base = { periodo: { ano: 2026, mes: 9 }, recorte: 'ambos' as const, hojeISO: '2026-09-29' };

describe('funilCompleto', () => {
  it('pessoas das seleções realizadas; vagas cumulativas; experiência pelo nome', () => {
    const f = funilCompleto({
      ...base,
      selecoes: [sel({ convocados: 10, compareceram: 6 }), sel({ convocados: 5, compareceram: 3 }), sel({ status: 'agendado', convocados: 9 })] as any,
      vagas: [
        vaga({ status: 'FECHADA', conclusao: '15/09/2026', aprovado: 'Ana Maria Costa' }),
        vaga({ status: 'FECHADA', conclusao: '20/09/2026', aprovado: 'João Lima' }),
        vaga({ status: 'FECHADA', conclusao: '21/09/2026', aprovado: 'Paulo Reis' }),
        vaga({ status: 'FECHADA', conclusao: '22/09/2026' }),                          // sem nome: conta, sem cadastro
        vaga({ status: 'FECHADA', conclusao: '10/08/2026', aprovado: 'Fora' }),          // outro mês
        vaga({ status: 'DOCUMENTAÇÃO', aprovado: 'Rita' }),                              // em doc
        vaga({ status: 'ABERTA', aprovado: 'Bia' }),                                     // gestor aprovou
        vaga({ status: 'ABERTA' }),                                                      // ainda na triagem
      ] as any,
      experiencias: [exp('Ana Costa', 'EFETIVADO'), exp('JOÃO LIMA', 'ENCERRADO'), exp('Paulo Reis', 'EM_ANALISE')],
    });
    expect(f.etapas.map(e => e.valor)).toEqual([15, 9, 6, 5, 4, 1]);
    expect(f.experiencia).toEqual({ efetivados: 1, sairam: 1, emCurso: 1, semCadastro: 1 });
    expect(f.incluiEmAndamento).toBe(true);
  });

  it('período passado não conta vaga em andamento; recorte pelo setor da vaga', () => {
    const vagas = [
      vaga({ status: 'FECHADA', conclusao: '10/08/2026', setor: 'Pedagógico' }),
      vaga({ status: 'FECHADA', conclusao: '11/08/2026' }),
      vaga({ status: 'DOCUMENTAÇÃO', setor: 'Pedagógico' }),
    ] as any;
    const f = funilCompleto({ ...base, periodo: { ano: 2026, mes: 8 }, recorte: 'pedagogico', selecoes: [], vagas, experiencias: [] });
    expect(f.incluiEmAndamento).toBe(false);
    expect(f.etapas.find(e => e.id === 'contratados')!.valor).toBe(1);
    expect(f.etapas.find(e => e.id === 'documentacao')!.valor).toBe(1);
  });
});

describe('indiceDeExperiencia', () => {
  it('primeiro+último só quando não é ambíguo', () => {
    const acha = indiceDeExperiencia([exp('Maria Souza', 'EFETIVADO'), exp('Maria Clara Souza', 'ENCERRADO')]);
    expect(acha('maria  souza')?.status).toBe('EFETIVADO');          // nome exato vence
    expect(acha('Maria José Souza')).toBeUndefined();               // "maria souza" é ambíguo (2 pessoas)
  });
});
