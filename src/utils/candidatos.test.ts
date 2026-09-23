import { describe, it, expect } from 'vitest';
import { numerosDoDia, type CandidatoDoDia } from './candidatos';
import { normalizeKey } from '../lib/spreadsheetImport';

const c = (resultado: CandidatoDoDia['resultado'], extra: Partial<CandidatoDoDia> = {}): CandidatoDoDia => ({ resultado, ...extra });

describe('numerosDoDia', () => {
  it('convocados = quantos nomes; compareceram = todos menos ausentes', () => {
    const n = numerosDoDia([c('ausente'), c('ausente'), c('aprovado'), c('r_restricao'), c('fora_perfil')]);
    expect(n).toMatchObject({ convocados: 5, ausentes: 2, compareceram: 3, desistiram: 0, contratados: 0 });
  });

  it('quem desistiu COMPARECEU — desistência é parte de quem veio (decisão de 23/09/2026)', () => {
    const n = numerosDoDia([c('desistiu', { motivo: 'Sem interesse na vaga' }), c('ausente'), c('aprovado')]);
    expect(n).toMatchObject({ convocados: 3, compareceram: 2, ausentes: 1, desistiram: 1 });
  });

  it('contratado conta pelo campo próprio, independente do resultado', () => {
    const n = numerosDoDia([c('aprovado', { contratado: 'sim' }), c('aprovado', { contratado: 'banco' }), c('aprovado', { contratado: 'nao' })]);
    expect(n.contratados).toBe(1);
  });

  it('motivos somam na mesma chave normalizada que o import da QUANTI usa', () => {
    const n = numerosDoDia([
      c('desistiu', { motivo: 'Recebeu uma proposta melhor / Conseguiu outro emprego' }),
      c('desistiu', { motivo: 'Recebeu uma proposta melhor / Conseguiu outro emprego' }),
      c('desistiu'),
    ]);
    // A chave é a do import (`normalizeKey` do cabeçalho), com as manias dela —
    // inclusive o espaço duplo que sobra onde havia a barra.
    expect(n.motivos).toEqual({ [normalizeKey('Recebeu uma proposta melhor / Conseguiu outro emprego')]: 2 });
  });

  it('dia com alguém ainda sem resultado fica AGENDADO — fora do funil até fechar', () => {
    // Um "convocado" pendente contaria como 0 presente e derrubaria a taxa por
    // algo que só não foi lançado ainda.
    expect(numerosDoDia([c('convocado'), c('aprovado')]).status).toBe('agendado');
    expect(numerosDoDia([c('ausente'), c('aprovado')]).status).toBe('realizado');
  });

  it('pendente é convocado, mas nem presente nem ausente', () => {
    expect(numerosDoDia([c('convocado'), c('ausente')])).toMatchObject({ convocados: 2, compareceram: 0, ausentes: 1 });
  });

  it('sem motivo nenhum, o campo vai vazio (e não some da gravação)', () => {
    expect(numerosDoDia([c('aprovado')]).motivos).toEqual({});
  });
});

import { nomesDoTexto } from '../components/CandidatosDoDia';

describe('nomesDoTexto (colar a lista da convocação)', () => {
  it('um nome por linha; linha vazia e espaço sobrando não viram candidato', () => {
    expect(nomesDoTexto('Ana  Souza\r\n\n  Bruno Lima \n')).toEqual(['Ana Souza', 'Bruno Lima']);
  });
});
