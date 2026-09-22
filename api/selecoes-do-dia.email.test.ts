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

  it('o assunto é fixo, e o número que importa fica no corpo', () => {
    const e = montarEmailSelecoes(DIA, [
      sel({ convocados: 8, compareceram: 5, ausentes: 3 }),
      sel({ convocados: 4, compareceram: 4 }),
    ]);
    expect(e.assunto).toBe('Resumo do dia - 17/09/2026');
    expect(e.html).toContain('75% de comparecimento');
  });

  it('dia só com agendamento não anuncia "0 compareceram"', () => {
    const e = montarEmailSelecoes(DIA, [sel({ status: 'agendado', convocados: 12 })]);
    expect(e.vale).toBe(true);
    expect(e.assunto).toBe('Resumo do dia - 17/09/2026');
    expect(e.html).toContain('sem confirmação de presença');
  });

  it('lista cargo, sede, responsável e os três números', () => {
    const e = montarEmailSelecoes(DIA, [
      sel({ cargo: 'Professor(a)', sede: 'BENFICA', responsavel: 'Diana', convocados: 6, compareceram: 6 }),
    ]);
    expect(e.html).toContain('Professor(a)');
    expect(e.html).toContain('BENFICA');
    expect(e.html).toContain('Diana');
    // Cada número na SUA coluna. Antes os três vinham numa célula só ("6 / 6 / 0"),
    // ilegível sem subir até o cabeçalho para decodificar a ordem.
    expect(e.html).toContain('Convocados');
    expect(e.html).toContain('Compareceram');
    expect(e.html).toContain('Ausentes');
    expect(e.html).toContain('>6</td>');
    expect(e.html).toContain('>0</td>');
  });

  it('mostra os códigos das vagas atendidas', () => {
    const e = montarEmailSelecoes(DIA, [
      sel({ convocados: 20, compareceram: 9, vagaCodigos: [31, 1120] }),
    ]);
    expect(e.html).toContain('<span>3</span><span>1</span>');
    expect(e.html).toContain('<span>11</span><span>20</span>');
  });

  it('o e-mail não leva link nenhum — link falso fez o Gmail marcar como perigoso', () => {
    // Em 23/09 a tarja vermelha "Esta mensagem pode ser perigosa" apareceu no
    // primeiro envio depois de eu envolver o código de vaga num <a href="#">,
    // para impedir o Gmail de ler 10 dígitos como telefone. Link cujo texto é
    // um número e cujo destino é lugar nenhum é padrão de phishing. Enquanto
    // não houver um destino de verdade, este e-mail não tem link.
    const e = montarEmailSelecoes(DIA, [
      sel({ convocados: 1, compareceram: 1, vagaCodigos: [2147180880] }),
    ]);
    expect(e.html).not.toContain('<a ');
    expect(e.html).not.toContain('href=');
  });

  it('o código de vaga é partido, para o Gmail não ler como telefone', () => {
    // Os códigos reais têm 10 dígitos (conferido no banco: todos têm). Dois nós
    // de texto quebram a sequência para o detector sem sujar o que se copia —
    // ao contrário do espaço de largura zero.
    const e = montarEmailSelecoes(DIA, [
      sel({ convocados: 1, compareceram: 1, vagaCodigos: [2147180880] }),
    ]);
    expect(e.html).toContain('<span>21471</span><span>80880</span>');
    expect(e.html).not.toContain('>2147180880<');
  });

  it('o corpo não esconde nada nem traz comentário — foi o que o Gmail marcou', () => {
    // Em 22 e 23/09 veio a tarja "Esta mensagem pode ser perigosa" com SPF,
    // DKIM e DMARC todos em PASS: era o corpo. Texto com `display:none` e
    // comentário em HTML são dos padrões mais antigos de mensagem maliciosa, e
    // os dois tinham entrado na redesenhada. Este teste é a cerca.
    const e = montarEmailSelecoes(DIA, [sel({ convocados: 6, compareceram: 4, ausentes: 2 })]);
    expect(e.html).not.toMatch(/display\s*:\s*none/i);
    expect(e.html).not.toContain('<!--');
    expect(e.html).not.toContain('<style');
    // Link tem teste próprio logo acima, com a história dele.
  });

  it('as duas partes da mensagem anunciam a mesma coisa', () => {
    // O texto puro abria com "SGPC — Seleções do dia" e o HTML com "Resumo do
    // dia". Divergir entre text/plain e text/html é mostrar uma coisa a um
    // leitor e outra a outro — sinal clássico para filtro de phishing.
    const e = montarEmailSelecoes(DIA, [sel({ convocados: 6, compareceram: 4, ausentes: 2 })]);
    expect(e.texto.split('\n')[0]).toBe(`Resumo do dia - ${DIA}`);
    expect(e.texto.split('\n')[0]).toBe(e.assunto);
    expect(e.html).toContain('Resumo do dia');
  });

  it('a taxa sai com vírgula decimal nas duas partes', () => {
    // O texto dizia "28.6%" e o HTML "28,6%" — ponto decimal errado em pt-BR e,
    // de quebra, mais uma divergência entre as duas partes da mensagem. A
    // conversão passou a existir num lugar só e ser passada para o HTML.
    const e = montarEmailSelecoes(DIA, [sel({ convocados: 21, compareceram: 6, ausentes: 15 })]);
    expect(e.texto).toContain('28,6% de comparecimento');
    expect(e.html).toContain('28,6% de comparecimento');
    expect(e.texto).not.toContain('28.6');
    expect(e.html).not.toContain('28.6');
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
    // A agendada mostra quantos foram convocados e marca as outras duas colunas
    // como pendentes. Zero ali seria mentira: a seleção ainda não aconteceu.
    expect(e.html).toContain('>3</td>');
    expect(e.html).toContain('a confirmar');
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
      // Ancorado no CORPO, não no assunto: o assunto virou fixo
      // ("Resumo do dia - DD/MM/AAAA") a pedido do RH e não carrega número. Se
      // este teste tivesse ido embora junto, as duas cópias da regra de totais
      // voltariam a poder divergir sem ninguém ver.
      if (doApp.convocados > 0) {
        expect(daApi.texto).toContain(`${doApp.convocados} convocados`);
        expect(daApi.texto).toContain(`${doApp.compareceram} compareceram`);
        expect(daApi.html).toContain(`>${doApp.convocados}</td>`);
        expect(daApi.html).toContain(`>${doApp.compareceram}</td>`);
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
    expect(e.html).toContain('<span>3</span><span>1</span>');
    expect(e.html).toContain('<span>11</span><span>20</span>');
  });
});

describe('resumo nao contradiz a tabela', () => {
  it('dia so com agendamento nao anuncia "0 convocados"', () => {
    const e = montarEmailSelecoes(DIA, [sel({ status: 'agendado', convocados: 2 })]);
    expect(e.texto).not.toContain('0 convocados');
    expect(e.html).toContain('2 convocados a confirmar');
  });

  it('dia misto mostra o realizado E o que falta confirmar', () => {
    const e = montarEmailSelecoes(DIA, [
      sel({ convocados: 8, compareceram: 5 }),
      sel({ status: 'agendado', convocados: 4 }),
    ]);
    // Os totais do realizado ficam no rodapé da tabela, alinhados sob as colunas
    // que somam; o que ainda não aconteceu é dito por fora, em texto.
    expect(e.html).toContain('>8</td>');
    expect(e.html).toContain('>5</td>');
    expect(e.html).toContain('4 convocados a confirmar');
  });

  it('dia so realizado nao inventa "a confirmar"', () => {
    const e = montarEmailSelecoes(DIA, [sel({ convocados: 6, compareceram: 6 })]);
    expect(e.html).not.toContain('a confirmar');
  });
});
