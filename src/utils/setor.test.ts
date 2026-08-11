import { describe, it, expect } from 'vitest';
import { chaveSetor, resolverSetor, diagnosticarSetores, duplicadosProvaveis } from './setor';

// Cadastro "limpo" (o que o RH deveria ter no Painel Admin → Setores)
const CADASTRO = ['Almoxarifado', 'Atendimento', 'Infraestrutura', 'Marketing', 'Jurídico', 'TI'];

describe('chaveSetor', () => {
  it('ignora acento, caixa e espaços', () => {
    expect(chaveSetor('  Jurídico ')).toBe('juridico');
    expect(chaveSetor('METALÚRGICA')).toBe('metalurgica');
    expect(chaveSetor(undefined)).toBe('');
  });
});

describe('resolverSetor', () => {
  it('casa ignorando acento/caixa e devolve o nome do CADASTRO', () => {
    expect(resolverSetor('juridico', CADASTRO)).toBe('Jurídico'); // volta com acento
    expect(resolverSetor('MARKETING', CADASTRO)).toBe('Marketing');
  });
  it('resolve os apelidos legados', () => {
    expect(resolverSetor('MKT', CADASTRO)).toBe('Marketing');
    expect(resolverSetor('Infra', CADASTRO)).toBe('Infraestrutura');
    expect(resolverSetor('Almoxarifado geral', CADASTRO)).toBe('Almoxarifado');
  });
  it('quem manda é o cadastro: sem o canônico lá, não sugere', () => {
    expect(resolverSetor('Infra', ['Atendimento'])).toBeNull();
  });
  it('valor desconhecido → null (vaga ficaria órfã)', () => {
    expect(resolverSetor('Lojinha', CADASTRO)).toBeNull();
    expect(resolverSetor('', CADASTRO)).toBeNull();
  });
});

describe('diagnosticarSetores', () => {
  const vagas = [
    { setor: 'Marketing' },      // exato
    { setor: 'Atendimento' },    // exato
    { setor: 'MKT' },            // legado → Marketing
    { setor: 'MKT' },            // idem (agrupa e conta 2)
    { setor: 'Infra' },          // legado → Infraestrutura
    { setor: 'Lojinha' },        // sem correspondência
    { setor: '' },               // sem setor
  ];
  const d = diagnosticarSetores(vagas, CADASTRO);

  it('conta os que já estão certos e os vazios', () => {
    expect(d.totalVagas).toBe(7);
    expect(d.okExato).toBe(2);
    expect(d.semSetor).toBe(1);
  });
  it('agrupa divergentes por valor, com a quantidade e a sugestão', () => {
    expect(d.divergentes).toEqual([
      { valor: 'MKT', qtd: 2, sugestao: 'Marketing' },
      { valor: 'Infra', qtd: 1, sugestao: 'Infraestrutura' },
      { valor: 'Lojinha', qtd: 1, sugestao: null },
    ]);
  });
  it('destaca quem ficaria SEM setor (sugestao null)', () => {
    expect(d.divergentes.filter(x => !x.sugestao).map(x => x.valor)).toEqual(['Lojinha']);
  });
});

describe('duplicadosProvaveis', () => {
  it('acha apelido, prefixo e acento no próprio cadastro', () => {
    const pares = duplicadosProvaveis(['Marketing', 'MKT', 'Almoxarifado', 'Almoxarifado geral', 'Jurídico', 'Juridico']);
    const comoTexto = pares.map(p => p.join(' | '));
    expect(comoTexto).toContain('Marketing | MKT');
    expect(comoTexto).toContain('Almoxarifado | Almoxarifado geral');
    expect(comoTexto).toContain('Jurídico | Juridico');
  });
  it('cadastro limpo → nenhum par', () => {
    expect(duplicadosProvaveis(CADASTRO)).toEqual([]);
  });
});
