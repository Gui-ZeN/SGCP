import { describe, it, expect } from 'vitest';
import { participanteManual, participanteDoQuadro, alternar, mesmoParticipante, MAX_PARTICIPANTES } from './presenca';
import type { Participante } from '../types';

/* Casos M do revisor de segurança (28/10/2026). */
const SEDES = ['DT1', 'SUL1'];
const manual = (nome: string, matricula = '', sede = '', lista: Participante[] = []) => participanteManual({ nome, matricula, sede }, lista, SEDES);

describe('participanteManual', () => {
  it('M1 nome vazio, só espaços ou longo demais: recusa', () => {
    for (const nome of ['', '   ', 'a'.repeat(121)]) expect(manual(nome)).toHaveProperty('erro');
  });
  it('M2 nome com quebra de linha, tab ou caractere de controle: recusa', () => {
    for (const nome of ['Ana\nSilva', 'Ana\tSilva', 'Ana\u0007']) expect(manual(nome)).toHaveProperty('erro');
  });
  it('M3 fórmula de planilha entra como texto (a exportação escreve string)', () => {
    expect(manual('=HYPERLINK("x")')).toEqual({ participante: { matricula: '', nome: '=HYPERLINK("x")', sede: '', foraDoQuadro: true } });
  });
  it('M4 matrícula só com dígitos, até 12; vazia passa', () => {
    for (const m of ['12a', '1 23', '1234567890123']) expect(manual('Ana', m)).toHaveProperty('erro');
    expect(manual('Ana', '  123 ')).toMatchObject({ participante: { matricula: '123' } });
    expect(manual('Ana', '')).toMatchObject({ participante: { matricula: '' } });
  });
  it('M5 sede fora das conhecidas vira vazia', () => {
    expect(manual('Ana', '', 'MARTE')).toMatchObject({ participante: { sede: '' } });
    expect(manual('Ana', '', 'DT1')).toMatchObject({ participante: { sede: 'DT1' } });
  });
  it('M6/M7 duplicado pela matrícula ou, sem matrícula, pelo nome (sem acento e caixa): recusa', () => {
    const lista: Participante[] = [{ matricula: '7', nome: 'José Lima', sede: 'DT1' }];
    expect(manual('Outro Nome', '7', '', lista)).toHaveProperty('erro');
    expect(manual('jose  lima', '', '', lista)).toHaveProperty('erro');
    expect(manual('José Lima', '8', '', lista)).toHaveProperty('participante'); // matrícula diferente: outra pessoa
  });
  it('lista cheia: recusa', () => {
    const cheia = Array.from({ length: MAX_PARTICIPANTES }, (_, i) => ({ matricula: String(i), nome: `P${i}`, sede: '' }));
    expect(manual('Mais Um', '', '', cheia)).toHaveProperty('erro');
  });
});

describe('participanteDoQuadro / alternar', () => {
  it('M8/M9 do quadro: só matrícula, nome e sede, nunca foraDoQuadro', () => {
    const vindo = { matricula: '1', nome: 'Ana', sede: 'DT1', unidade: 'colegio', celular: '85' } as any;
    expect(participanteDoQuadro(vindo)).toEqual({ matricula: '1', nome: 'Ana', sede: 'DT1' });
  });
  it('marca e desmarca; não duplica com a mesma pessoa lançada à mão (o Realizado não infla)', () => {
    const ana = { matricula: '1', nome: 'Ana', sede: 'DT1' };
    let lista = alternar([], ana);
    expect(lista).toHaveLength(1);
    lista = alternar(lista, ana);
    expect(lista).toHaveLength(0);
    const aMao: Participante = { matricula: '1', nome: 'Ana Maria', sede: '', foraDoQuadro: true };
    expect(alternar([aMao], ana)).toEqual([]); // é a mesma (matrícula): desmarca em vez de somar
  });
  it('mesmoParticipante: matrícula decide quando os dois têm', () => {
    expect(mesmoParticipante({ matricula: '1', nome: 'A' }, { matricula: '2', nome: 'A' })).toBe(false);
    expect(mesmoParticipante({ matricula: '', nome: 'Ána' }, { matricula: '2', nome: 'ana' })).toBe(true);
  });
});
