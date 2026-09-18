import { describe, it, expect } from 'vitest';
import { montarEmailSelecoes } from './selecoes-do-dia';
import { ehRealizada, totaisDeSelecoes, codigosDasVagas } from '../src/utils/selecao';
import type { Selecao } from '../src/types';

const DIA = '17/09/2026';
const sel = (over: Partial<Selecao>): Selecao => ({
  id: 'x', data: DIA, cargo: 'ASG', sede: 'DT', responsavel: 'Arlana',
  origem: 'geral', convocados: 0, compareceram: 0, ausentes: 0, contratados: 0,
  desistiram: 0, ...over,
});

describe('montarEmailSelecoes', () => {
  it('dia sem seleção não gera e-mail', () => {
    const e = montarEmailSelecoes(DIA, []);
    expect(e.vale).toBe(false);
    expect(e.assunto).toBe('');
  });

  it('dia de outra data não conta', () => {
    expect(montarEmailSelecoes(DIA, [sel({ data: '16/09/2026', convocados: 9 })]).vale).toBe(false);
  });

  it('o assunto traz o número que importa', () => {
    const e = montarEmailSelecoes(DIA, [
      sel({ convocados: 8, compareceram: 5, ausentes: 3 }),
      sel({ convocados: 4, compareceram: 4 }),
    ]);
    expect(e.assunto).toBe('Seleções de 17/09/2026 — 9 de 12 compareceram');
    expect(e.html).toContain('75% de comparecimento');
  });

  it('dia só com agendamento não anuncia "0 compareceram"', () => {
    const e = montarEmailSelecoes(DIA, [sel({ status: 'agendado', convocados: 12 })]);
    expect(e.vale).toBe(true);
    expect(e.assunto).toBe('Seleções de 17/09/2026 — 1 seleção agendada');
    expect(e.html).toContain('sem confirmação de presença');
  });

  it('lista cargo, sede, responsável e os três números', () => {
    const e = montarEmailSelecoes(DIA, [
      sel({ cargo: 'Professor(a)', sede: 'BENFICA', responsavel: 'Diana', convocados: 6, compareceram: 6 }),
    ]);
    expect(e.html).toContain('Professor(a)');
    expect(e.html).toContain('BENFICA');
    expect(e.html).toContain('Diana');
    expect(e.html).toContain('6 / 6 / 0');
  });

  it('mostra os códigos das vagas atendidas', () => {
    const e = montarEmailSelecoes(DIA, [
      sel({ convocados: 20, compareceram: 9, vagaCodigos: [31, 1120] }),
    ]);
    expect(e.html).toContain('#31 #1120');
  });

  it('soma os motivos de desistência do dia', () => {
    const e = montarEmailSelecoes(DIA, [
      sel({ convocados: 5, compareceram: 2, motivos: { 'mora longe': 1 } }),
      sel({ convocados: 5, compareceram: 3, motivos: { 'mora longe': 2, 'sem interesse': 1 } }),
    ]);
    expect(e.html).toContain('mora longe (3)');
    expect(e.html).toContain('sem interesse (1)');
  });

  it('escapa o que vem do cadastro — cargo é texto livre', () => {
    const e = montarEmailSelecoes(DIA, [
      sel({ cargo: '<script>alert(1)</script>', convocados: 1, compareceram: 1 }),
    ]);
    expect(e.html).not.toContain('<script>');
    expect(e.html).toContain('&lt;script&gt;');
  });

  it('a versão em texto puro tem o mesmo conteúdo essencial', () => {
    const e = montarEmailSelecoes(DIA, [sel({ convocados: 8, compareceram: 5, ausentes: 3 })]);
    expect(e.texto).toContain('8 convocados');
    expect(e.texto).toContain('5 compareceram');
    expect(e.texto).not.toContain('<');
  });

  it('agendada aparece depois das realizadas, e sem número de presença', () => {
    const e = montarEmailSelecoes(DIA, [
      sel({ status: 'agendado', cargo: 'AGENDADA', convocados: 3 }),
      sel({ cargo: 'REALIZADA', convocados: 2, compareceram: 2 }),
    ]);
    expect(e.html.indexOf('REALIZADA')).toBeLessThan(e.html.indexOf('AGENDADA'));
    expect(e.html).toContain('3 / — / —');
  });
});


describe('as regras duplicadas concordam com src/utils/selecao', () => {
  // A funcao serverless nao pode importar de fora de `api/` (a Vercel nao
  // empacota, so transpila). As tres regrinhas foram copiadas para la; este
  // teste existe para elas nao divergirem em silencio.
  const casos: Selecao[][] = [
    [sel({ convocados: 10, compareceram: 4, ausentes: 6, desistiram: 2, contratados: 1 })],
    [sel({ convocados: 8, compareceram: 5 }), sel({ status: 'agendado', convocados: 40 })],
    [sel({ status: 'agendado', convocados: 3 })],
    [],
    [sel({ convocados: 3, compareceram: 1 })],
  ];

  it('totaisDeSelecoes da o mesmo resultado nos dois lugares', () => {
    casos.forEach(lista => {
      const daApi = montarEmailSelecoes(DIA, lista);
      const doApp = totaisDeSelecoes(lista);
      // O e-mail usa os totais no assunto; se divergissem, o assunto mentiria.
      if (doApp.convocados > 0) {
        expect(daApi.assunto).toContain(`${doApp.compareceram} de ${doApp.convocados}`);
      }
    });
  });

  it('ehRealizada e codigosDasVagas seguem a mesma regra', () => {
    expect(ehRealizada({} as any)).toBe(true);
    expect(ehRealizada({ status: 'agendado' } as any)).toBe(false);
    expect(codigosDasVagas({ vagaCodigos: [31, 1120] })).toEqual([31, 1120]);
    expect(codigosDasVagas({ vagaCodigo: 24 })).toEqual([24]);
    // e o e-mail imprime exatamente esses codigos
    const e = montarEmailSelecoes(DIA, [sel({ convocados: 1, compareceram: 1, vagaCodigos: [31, 1120] })]);
    expect(e.html).toContain('#31 #1120');
  });
});
