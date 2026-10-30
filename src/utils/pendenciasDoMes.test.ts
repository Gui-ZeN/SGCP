import { describe, it, expect } from 'vitest';
import { pendenciasDoMes, desistentesSemMotivo, abaDaUnidade } from './pendenciasDoMes';
import type { Vaga, Selecao, Experiencia, Integracao, Treinamento } from '../types';

const vaga = (p: Partial<Vaga>) => ({ id: 'v', codigo: 1, vaga: 'ASG', sede: 'ALDEOTA', status: 'ABERTA', setor: 'Infra', solicitacao: '05/09/2026', solicitante: '', ...p }) as Vaga;
const sel = (p: Partial<Selecao>) => ({ id: 's', data: '10/09/2026', cargo: 'ASG', sede: 'ALDEOTA', responsavel: '', origem: 'geral',
  convocados: 10, compareceram: 3, ausentes: 7, contratados: 0, desistiram: 0, numerosPelaLista: true, ...p }) as Selecao;
const base = { ano: 2026, mes: 9, hojeISO: '2026-10-05', vagas: [], selecoes: [], experiencias: [], integracoes: [], treinamentos: [], comIntegracao: true, abaSelecoes: 'selecoesLista' as const };
const de = (l: ReturnType<typeof pendenciasDoMes>, id: string) => l.find(p => p.id === id);

describe('pendenciasDoMes', () => {
  it('sem pendência, lista vazia (categoria sem item não aparece)', () => {
    expect(pendenciasDoMes(base)).toEqual([]);
  });

  it('seleções: agendada, desistente sem motivo (com lista) e sem lista de nomes, cada uma no seu lugar', () => {
    const l = pendenciasDoMes({ ...base, selecoes: [
      sel({ id: 'a', status: 'agendado' }),
      sel({ id: 'b', desistiram: 3, motivos: { 'motivos pessoais': 1 } }),
      sel({ id: 'c', desistiram: 2, numerosPelaLista: false }),
      sel({ id: 'd', desistiram: 1, motivos: { x: 1 } }),           // tudo com motivo
      sel({ id: 'e', data: '10/08/2026', status: 'agendado' }),      // outro mês
    ] });
    expect(de(l, 'agendadas')!.itens.map(i => i.id)).toEqual(['a']);
    expect(de(l, 'semMotivo')!.itens).toEqual([{ id: 'b', principal: 'ASG', detalhe: '10/09 · ALDEOTA · 2 sem motivo', link: '#/selecoes?selecao=b' }]);
    expect(de(l, 'semLista')!.itens.map(i => i.id)).toEqual(['c']);
  });

  it('no Colégio a seleção abre no dia (Resumo do Dia)', () => {
    const l = pendenciasDoMes({ ...base, abaSelecoes: 'selecoes', selecoes: [sel({ status: 'agendado' })] });
    expect(de(l, 'agendadas')!.itens[0].link).toBe('#/resumo-do-dia?dia=2026-09-10');
  });

  it('experiência: só a vencida sem desfecho, com link para a pessoa', () => {
    const exp = (p: Partial<Experiencia>) => ({ id: 'x', colaborador: 'Ana', sede: 'ALDEOTA', status: 'EM_ANALISE', termino1: '', termino2: '', ...p }) as Experiencia;
    const l = pendenciasDoMes({ ...base, experiencias: [
      exp({ id: '1', termino1: '20/09/2026' }), exp({ id: '2', termino1: '21/09/2026', status: 'PRORROGADO' }),
    ] });
    expect(de(l, 'experiencia')!.itens).toEqual([{ id: '1', principal: 'Ana', detalhe: '45 dias · venceu 20/09 · ALDEOTA', link: '#/experiencia?pessoa=Ana' }]);
  });

  it('integração: os "Não realizado" do mês, com o filtro pronto; sem integração na unidade, nada', () => {
    const i = (p: Partial<Integracao>) => ({ id: 'i', nome: 'Bia', sede: 'BEN', admissao: '03/09/2026', status: 'Não realizado', ...p }) as Integracao;
    const integracoes = [i({ id: '1' }), i({ id: '2', status: 'Realizado' }), i({ id: '3', admissao: '03/08/2026' })];
    const p = de(pendenciasDoMes({ ...base, integracoes }), 'integracao')!;
    expect(p.itens.map(x => x.id)).toEqual(['1']);
    expect(p.todos).toBe('#/integracao?situacao=N%C3%A3o+realizado&admissao=2026-09');
    expect(de(pendenciasDoMes({ ...base, integracoes, comIntegracao: false }), 'integracao')).toBeUndefined();
  });

  it('vagas: concluída sem data (solicitada no ano) e concluída no mês sem tempo de processo', () => {
    const l = pendenciasDoMes({ ...base, vagas: [
      vaga({ id: '1', codigo: 11, status: 'FECHADA', conclusao: '' }),
      vaga({ id: '2', codigo: 12, status: 'FECHADA', conclusao: '', solicitacao: '05/09/2025' }), // outro ano: fora
      vaga({ id: '3', codigo: 13, status: 'FECHADA', conclusao: '15/09/2026', tempoProcesso: 0 }),
      vaga({ id: '4', codigo: 14, status: 'FECHADA', conclusao: '15/09/2026', tempoProcesso: 20 }),
    ] });
    expect(de(l, 'semConclusao')!.itens.map(x => [x.id, x.link])).toEqual([['1', '#/vagas?vaga=11']]);
    expect(de(l, 'semTempo')!.itens.map(x => x.id)).toEqual(['3']);
  });

  it('treinamento do mês já acontecido sem presentes; o de amanhã ainda não', () => {
    const t = (p: Partial<Treinamento>) => ({ id: 't', tema: 'NR 35', dataInicio: '10/09/2026', unidade: 'ALDEOTA', qtdPrevista: 10, qtdRealizada: 0, ...p }) as Treinamento;
    const l = pendenciasDoMes({ ...base, hojeISO: '2026-09-15', treinamentos: [t({ id: '1' }), t({ id: '2', qtdRealizada: 8 }), t({ id: '3', dataInicio: '20/09/2026' })] });
    expect(de(l, 'semPresenca')!.itens.map(x => x.id)).toEqual(['1']);
  });

  it('a aba da seleção segue a unidade, não o perfil (Administrador vê as duas)', () => {
    expect(abaDaUnidade('universidade')).toBe('selecoesLista');
    expect(abaDaUnidade('colegio')).toBe('selecoes');
    expect(abaDaUnidade(undefined)).toBe('selecoes');
    const l = pendenciasDoMes({ ...base, abaSelecoes: abaDaUnidade('universidade'), selecoes: [sel({ id: 'u1', status: 'agendado' })] });
    expect(de(l, 'agendadas')!.itens[0].link).toBe('#/selecoes?selecao=u1');
  });

  it('vaga sem código: sem "nº undefined", e o link abre a lista de vagas', () => {
    const l = pendenciasDoMes({ ...base, vagas: [vaga({ id: '1', codigo: undefined as any, status: 'FECHADA', conclusao: '' })] });
    expect(de(l, 'semConclusao')!.itens[0]).toMatchObject({ detalhe: 'ALDEOTA', link: '#/vagas' });
  });

  it('desistentesSemMotivo nunca é negativo', () => {
    expect(desistentesSemMotivo({ desistiram: 1, motivos: { a: 3 } })).toBe(0);
    expect(desistentesSemMotivo({ desistiram: 4, motivos: { a: 1, b: 1 } })).toBe(2);
  });
});
