import { describe, it, expect } from 'vitest';
import {
  montarEmailPessoa, relatoPorPessoa,
  type RelatoPessoa, type EntradaLog, type Diario, type Tarefa,
} from './selecoes-do-dia';
import { relatoPorPessoa as relatoDaTela } from '../src/utils/resumoDia';

const DIA = '22/09/2026';

const pessoa = (over: Partial<RelatoPessoa> = {}): RelatoPessoa => ({
  email: 'arlana@christus.com.br',
  nome: 'Arlana Gomes',
  acoes: 4,
  secoes: [
    { titulo: 'Seleções', frases: ['Conduziu a seleção de ASG em Dionisio Torres: 3 convocados, 1 compareceu.'] },
    { titulo: 'Também informou', frases: ['Atendimentos a colaboradores: 6.'] },
  ],
  acumulado: { mes: ['12 seleções conduzidas'], ano: ['40 seleções conduzidas'] },
  ...over,
});

describe('montarEmailPessoa', () => {
  it('o assunto leva o nome — são vários e-mails no mesmo dia', () => {
    // Um e-mail por pessoa, todos para os diretores: sem o nome no assunto,
    // cinco "Resumo do dia - 22/09/2026" seriam indistinguíveis na caixa.
    expect(montarEmailPessoa(DIA, pessoa()).assunto).toBe('Resumo do dia - 22/09/2026 - Arlana Gomes');
  });

  it('as frases do relato aparecem nas duas partes', () => {
    const e = montarEmailPessoa(DIA, pessoa());
    for (const parte of [e.html, e.texto]) {
      expect(parte).toContain('Conduziu a seleção de ASG em Dionisio Torres: 3 convocados, 1 compareceu.');
      expect(parte).toContain('Atendimentos a colaboradores: 6.');
    }
  });

  it('o acumulado do mês e do ano vem no fim', () => {
    const e = montarEmailPessoa(DIA, pessoa());
    expect(e.texto).toContain('No mês: 12 seleções conduzidas');
    expect(e.texto).toContain('No ano: 40 seleções conduzidas');
    expect(e.html).toContain('12 seleções conduzidas');
  });

  it('quem só preencheu o "Meu dia" não aparece como "0 ações"', () => {
    const e = montarEmailPessoa(DIA, pessoa({ acoes: 0 }));
    expect(e.texto).toContain('Informado no "Meu dia"');
    expect(e.texto).not.toMatch(/\b0 ações/);
  });

  it('sem acumulado, não sai caixa vazia', () => {
    const e = montarEmailPessoa(DIA, pessoa({ acumulado: { mes: [], ano: [] } }));
    expect(e.texto).not.toContain('No mês');
    expect(e.html).not.toContain('No mês');
  });

  it('escapa o que vem de texto livre', () => {
    const e = montarEmailPessoa(DIA, pessoa({
      nome: '<b>x</b>',
      secoes: [{ titulo: 'Também informou', frases: ['<script>alert(1)</script>'] }],
    }));
    expect(e.html).not.toContain('<script>');
    expect(e.html).toContain('&lt;script&gt;');
    expect(e.html).not.toContain('<b>x</b>');
  });
});

describe('as regras que custaram caro (22 e 23/09)', () => {
  // A tarja vermelha "Esta mensagem pode ser perigosa" veio com SPF, DKIM e
  // DMARC todos em PASS: era o corpo. Estes testes são a cerca.

  it('o e-mail não leva link nenhum', () => {
    const e = montarEmailPessoa(DIA, pessoa());
    expect(e.html).not.toContain('<a ');
    expect(e.html).not.toContain('href=');
  });

  it('não esconde nada, não traz <style> nem comentário', () => {
    const e = montarEmailPessoa(DIA, pessoa());
    expect(e.html).not.toMatch(/display\s*:\s*none/i);
    expect(e.html).not.toContain('<style');
    expect(e.html).not.toContain('<!--');
  });

  it('as duas partes anunciam a mesma coisa', () => {
    // O texto puro abre com o assunto; o HTML, com o nome e o dia.
    const e = montarEmailPessoa(DIA, pessoa());
    expect(e.texto.split('\n')[0]).toBe(e.assunto);
    expect(e.html).toContain('Arlana Gomes');
    expect(e.html).toContain('Resumo do dia');
    expect(e.html).toContain(DIA);
  });

  it('número longo sai partido, para o Gmail não ler como telefone', () => {
    const e = montarEmailPessoa(DIA, pessoa({
      secoes: [{ titulo: 'Vagas', frases: ['Abriu a vaga 2147180880.'] }],
    }));
    expect(e.html).toContain('<span>21471</span><span>80880</span>');
    expect(e.html).not.toContain('2147180880');
    // No texto puro não há detector para enganar: fica inteiro.
    expect(e.texto).toContain('2147180880');
  });
});

describe('relato concorda com a tela', () => {
  // A função da Vercel não pode importar de `src/` (ela transpila e não
  // empacota — foi o disparo quebrado de 17/09). O relato existe duas vezes;
  // este teste é o que impede as duas de divergirem em silêncio. O caso é
  // rico de propósito: se só cobrisse o trivial, duas cópias diferentes
  // passariam iguais.
  const A = 'arlana@christus.com.br';
  const J = 'jenifer@christus.com.br';
  const log: EntradaLog[] = [
    { timestamp: '2026-09-22T12:46:00.000Z', usuario: A, acao: 'ALTEROU', modulo: 'Seleções', detalhes: '',
      ref: { cargo: 'AUXILIAR DE SERVIÇOS GERAIS', sede: 'DIONISIO TORRES', convocados: 3, compareceram: 0 } },
    { timestamp: '2026-09-22T12:50:00.000Z', usuario: A, acao: 'CRIOU', modulo: 'Seleções', detalhes: '',
      ref: { cargo: 'Aprendiz', sede: 'DT', data: '23/09/2026', convocados: 10 } },
    { timestamp: '2026-09-22T13:00:00.000Z', usuario: A, acao: 'CRIOU', modulo: 'Vagas', detalhes: '',
      ref: { cargo: 'ASG', sede: 'DOM LUÍS', quantidade: 30 } },
    { timestamp: '2026-09-22T13:05:00.000Z', usuario: A, acao: 'ALTEROU', modulo: 'Vagas', detalhes: 'status' },
    { timestamp: '2026-09-22T13:10:00.000Z', usuario: A, acao: 'CRIOU', modulo: 'Consultas',
      detalhes: 'Consulta de "Maria" (Psiquiatria).' },
    { timestamp: '2026-09-22T13:20:00.000Z', usuario: J, acao: 'CRIOU', modulo: 'Experiências', detalhes: '',
      ref: { colaborador: 'Emilly Bastos' } },
    { timestamp: '2026-09-22T13:30:00.000Z', usuario: J, acao: 'CRIOU', modulo: 'Vagas',
      detalhes: 'Importação da planilha anual: 50 vaga(s).' },
    { timestamp: '2026-09-22T13:40:00.000Z', usuario: J, acao: 'CRIOU', modulo: 'Vagas',
      detalhes: 'Seleção agendada: ASG em DT, 22/09/2026 — 3 convocado(s).' },
    { timestamp: '2026-09-23T02:30:00.000Z', usuario: J, acao: 'CRIOU', modulo: 'Resumo do Dia', detalhes: '',
      ref: { titulo: 'Kits do Setembro Amarelo', detalhe: '120 kits' } },
    { timestamp: '2026-09-22T16:00:00.000Z', usuario: A, acao: 'ALTEROU', modulo: 'Seleções', detalhes: '',
      ref: { tipo: 'edicao', cargo: 'ASG', sede: 'DT', convocados: 3, compareceram: 1 } },
    // Candidatos: dois registrados, um deles com resultado lançado duas vezes
    // e um terceiro só com resultado — cobre a contagem por candidato.
    { timestamp: '2026-09-22T14:00:00.000Z', usuario: A, acao: 'CRIOU', modulo: 'Candidatos', detalhes: '',
      ref: { cargo: 'ASG', data: '22/09/2026', candidato: 'k1' } },
    { timestamp: '2026-09-22T14:01:00.000Z', usuario: A, acao: 'CRIOU', modulo: 'Candidatos', detalhes: '',
      ref: { cargo: 'ASG', data: '22/09/2026', candidato: 'k2' } },
    { timestamp: '2026-09-22T15:00:00.000Z', usuario: A, acao: 'ALTEROU', modulo: 'Candidatos', detalhes: '',
      ref: { cargo: 'ASG', data: '22/09/2026', candidato: 'k1' } },
    { timestamp: '2026-09-22T15:05:00.000Z', usuario: A, acao: 'ALTEROU', modulo: 'Candidatos', detalhes: '',
      ref: { cargo: 'ASG', data: '22/09/2026', candidato: 'k3' } },
    { timestamp: '2026-09-22T15:06:00.000Z', usuario: A, acao: 'ALTEROU', modulo: 'Candidatos', detalhes: '',
      ref: { cargo: 'ASG', data: '22/09/2026', candidato: 'k3' } },
    { timestamp: '2026-09-05T13:00:00.000Z', usuario: A, acao: 'ALTEROU', modulo: 'Seleções', detalhes: '',
      ref: { cargo: 'X', convocados: 2, compareceram: 2 } },
    { timestamp: '2026-08-05T13:00:00.000Z', usuario: A, acao: 'ALTEROU', modulo: 'Seleções', detalhes: '',
      ref: { cargo: 'Y', convocados: 2, compareceram: 1 } },
  ];
  const diarios: Diario[] = [
    { email: A, data: DIA, contagens: { atendimentos: 6, testes: 1, tTel: 5 } },
    { email: A, data: '10/09/2026', contagens: { atendimentos: 4 } },
    { email: 'so-diario@christus.com.br', data: DIA, contagens: { acolhimentos: 2 } },
  ];
  const nomes = new Map([[A, 'Arlana Gomes']]);
  // Uma tarefa criada pela equipe e uma padrão renomeada.
  const tarefas: Tarefa[] = [
    { id: 'tTel', nome: 'Entrevistas por telefone', ordem: 5 },
    { id: 'testes', nome: 'Testes psicológicos' },
  ];

  it('o mesmo dado dá o mesmo relato nos dois lugares', () => {
    expect(relatoPorPessoa(log, diarios, DIA, nomes, tarefas)).toEqual(relatoDaTela(log, diarios, DIA, nomes, tarefas));
  });

  it('e o relato é o esperado, não só igual', () => {
    // Igualdade entre duas cópias erradas também passaria no teste de cima.
    const r = relatoPorPessoa(log, diarios, DIA, nomes, tarefas);
    expect(r.map(p => [p.nome, p.acoes])).toEqual([
      ['Arlana Gomes', 11], // 5 + os 5 lançamentos de candidatos + 1 correção
      ['jenifer@christus.com.br', 4],
      ['so-diario@christus.com.br', 0],
    ]);
    const arlana = r[0].secoes.flatMap(s => s.frases);
    expect(arlana).toContain('Conduziu a seleção de Auxiliar de Serviços Gerais em Dionisio Torres: 3 convocados, nenhum compareceu.');
    expect(arlana).toContain('Agendou para 23/09/2026 a seleção de Aprendiz em DT, com 10 convocados.');
    expect(arlana).toContain('Abriu 30 vagas em Dom Luís: 30 de ASG.');
    expect(arlana).toContain('Encaminhou 1 consulta de colaboradores.');
    expect(arlana).toContain('Registrou 2 candidatos na seleção de ASG de 22/09/2026.');
    expect(arlana).toContain('Corrigiu os dados de 1 seleção.');
    expect(arlana).toContain('Lançou o resultado de 1 candidato na seleção de ASG de 22/09/2026.');
    expect(JSON.stringify(r)).not.toContain('Psiquiatria');
    expect(arlana).toContain('Entrevistas por telefone: 5.');
    expect(arlana).toContain('Testes psicológicos: 1.');
    expect(r[0].acumulado.mes).toEqual([
      '2 seleções conduzidas', '30 vagas abertas',
      'Atendimentos a colaboradores: 10', 'Testes psicológicos: 1', 'Entrevistas por telefone: 5',
    ]);
    expect(r[0].acumulado.ano[0]).toBe('3 seleções conduzidas');

    const jenifer = r[1].secoes.flatMap(s => s.frases);
    expect(jenifer).toContain('Iniciou o acompanhamento do período de experiência de Emilly Bastos.');
    expect(jenifer).toContain('Importou 1 planilha para o sistema.');
    expect(jenifer).toContain('Agendou 1 seleção.');
    expect(jenifer).toContain('Kits do Setembro Amarelo — 120 kits.');
  });
});
