import { describe, it, expect } from 'vitest';
import type { Candidato, Selecao } from '../types';
import {
  normalizarTelefone, separarTelefone, convocacoesDasLinhas, agruparPessoas, indicePorPessoa, marcaDe, avisoDe, sugestoesDeNome, linhaDaPessoa, type MarcaNaoChamar,
} from './bancoCandidatos';

const sel = (id: string, cargo: string, data: string) => ({ id, cargo, data, sede: 'PE' } as Selecao);
const SELECOES = [sel('s1', 'ASG', '10/01/2026'), sel('s2', 'Recepcionista', '15/03/2026'), sel('s3', 'ASG', '20/05/2026')];
let n = 0;
const cand = (nome: string, selecaoId: string, data: string, resultado: Candidato['resultado'], extra: Partial<Candidato> = {}) =>
  ({ id: `c${++n}`, nome, selecaoId, data, resultado, ...extra } as Candidato);

describe('telefone', () => {
  it('só dígitos, sem o 55, com DDD', () => {
    expect(normalizarTelefone('(85) 99999-1234')).toBe('85999991234');
    expect(normalizarTelefone('+55 85 99999-1234')).toBe('85999991234');
    expect(normalizarTelefone('85 3333-1234')).toBe('8533331234');
    expect(normalizarTelefone('9999-1234')).toBe(''); // sem DDD não identifica
    expect(normalizarTelefone('')).toBe('');
  });

  it('separa o telefone colado junto do nome', () => {
    expect(separarTelefone('Maria Souza – (85) 99999-1234')).toEqual({ nome: 'Maria Souza', telefone: '85999991234' });
    expect(separarTelefone('João Lima 85999991234')).toEqual({ nome: 'João Lima', telefone: '85999991234' });
    expect(separarTelefone('Ana Paula')).toEqual({ nome: 'Ana Paula', telefone: '' });
  });
});

describe('agruparPessoas', () => {
  it('conta as convocações da mesma pessoa pelo nome (acento e caixa não importam)', () => {
    const [p] = agruparPessoas([
      cand('Josué Araújo', 's1', '10/01/2026', 'ausente'),
      cand('JOSUE ARAUJO', 's2', '15/03/2026', 'ausente'),
      cand('josué  araújo', 's3', '20/05/2026', 'aprovado', { contratado: 'banco' }),
    ], SELECOES);
    expect(p.vezes).toBe(3);
    expect(p.faltas).toBe(2);
    expect(p.vieram).toBe(1);
    expect(p.noBanco).toBe(true);
    expect(p.soPeloNome).toBe(true);
    expect(p.convocacoes[0].cargo).toBe('ASG'); // mais recente primeiro
    expect(p.convocacoes[0].candidato.data).toBe('20/05/2026');
  });

  it('homônimos com telefones diferentes são duas pessoas', () => {
    const pessoas = agruparPessoas([
      cand('Maria Silva', 's1', '10/01/2026', 'ausente', { telefone: '85999990001' }),
      cand('Maria Silva', 's2', '15/03/2026', 'aprovado', { telefone: '85999990002' }),
    ], SELECOES);
    expect(pessoas).toHaveLength(2);
  });

  it('convocação antiga sem telefone entra no grupo do ÚNICO telefone daquele nome', () => {
    const pessoas = agruparPessoas([
      cand('Carla Dias', 's1', '10/01/2026', 'ausente'),
      cand('Carla Dias', 's2', '15/03/2026', 'ausente', { telefone: '85999990003' }),
    ], SELECOES);
    expect(pessoas).toHaveLength(1);
    expect(pessoas[0].vezes).toBe(2);
    expect(pessoas[0].soPeloNome).toBe(false);
  });

  it('sem telefone e com DOIS telefones para o nome: fica no grupo "só nome"', () => {
    const pessoas = agruparPessoas([
      cand('Rita Lopes', 's1', '10/01/2026', 'ausente'),
      cand('Rita Lopes', 's2', '15/03/2026', 'ausente', { telefone: '85999990004' }),
      cand('Rita Lopes', 's3', '20/05/2026', 'ausente', { telefone: '85999990005' }),
    ], SELECOES);
    expect(pessoas).toHaveLength(3);
    expect(pessoas.find(p => p.soPeloNome)?.vezes).toBe(1);
  });
});

describe('aviso ao convocar', () => {
  const pessoas = agruparPessoas([
    cand('Bruno Reis', 's1', '10/01/2026', 'ausente'),
    cand('Bruno Reis', 's2', '15/03/2026', 'ausente'),
    cand('Lia Moura', 's1', '10/01/2026', 'aprovado'),
  ], SELECOES);
  const achar = indicePorPessoa(pessoas);

  it('quantas vezes foi chamado e a última vaga', () => {
    expect(avisoDe(achar('Bruno Reis'), undefined)).toEqual({ vezes: 2, ultima: { cargo: 'Recepcionista', data: '15/03/26' } });
    expect(avisoDe(achar('Lia Moura'), undefined)).toEqual({ vezes: 1, ultima: { cargo: 'ASG', data: '10/01/26' } });
  });

  it('nunca chamado: sem selo', () => {
    expect(avisoDe(achar('Pessoa Nova'), undefined)).toBeNull();
  });

  it('a própria convocação não conta (lista do dia)', () => {
    const p = achar('Lia Moura')!;
    expect(avisoDe(p, undefined, p.convocacoes[0].candidato.id)).toBeNull();
  });
});

describe('Nunca mais chamar', () => {
  const marcas: MarcaNaoChamar[] = [
    { id: 'm1', nome: 'Bruno Reis', nomeNorm: 'bruno reis', motivo: 'Faltou repetidas vezes', por: 'a@x' },
    { id: 'm2', nome: 'Ana Luz', nomeNorm: 'ana luz', telefone: '85999990009', motivo: 'Outro: x', por: 'a@x' },
    { id: 'm3', nome: 'Desfeita', nomeNorm: 'desfeita', motivo: 'x', por: 'a@x', desfeito: { por: 'c@x', motivo: 'engano' } },
  ];

  it('nome bate: avisa como "mesmo nome", acima de qualquer outro aviso', () => {
    const m = marcaDe(marcas, 'BRUNO REIS');
    expect(m?.peloNome).toBe(true);
    expect(avisoDe(undefined, m)).toEqual({ vezes: 0, naoChamar: 'Faltou repetidas vezes' });
  });

  it('telefone bate: confirmado (sem "mesmo nome")', () => {
    const m = marcaDe(marcas, 'Ana Luz', '(85) 99999-0009');
    expect(m?.peloNome).toBe(false);
  });

  it('mesmo nome com OUTRO telefone: é outra pessoa, não avisa', () => {
    expect(marcaDe(marcas, 'Ana Luz', '85999990000')).toBeUndefined();
  });

  it('marca desfeita não vale mais', () => {
    expect(marcaDe(marcas, 'Desfeita')).toBeUndefined();
  });
});

describe('sugestões ao digitar', () => {
  const pessoas = agruparPessoas([
    cand('Maria Souza Lima', 's1', '10/01/2026', 'ausente'),
    cand('Maria Souza Lima', 's2', '15/03/2026', 'aprovado'),
    cand('Ana Maria Costa', 's1', '10/01/2026', 'ausente'),
    cand('Mariana Reis', 's2', '15/03/2026', 'ausente', { telefone: '85999990007' }),
  ], SELECOES);

  it('menos de 3 letras: nada', () => {
    expect(sugestoesDeNome(pessoas, 'ma')).toEqual([]);
  });

  it('quem começa pelo digitado vem antes; depois, quem foi mais convocado', () => {
    expect(sugestoesDeNome(pessoas, 'mari').map(p => p.nome)).toEqual(['Maria Souza Lima', 'Mariana Reis', 'Ana Maria Costa']);
  });

  it('cada palavra digitada precisa aparecer no nome (acento não importa)', () => {
    expect(sugestoesDeNome(pessoas, 'maria lim').map(p => p.nome)).toEqual(['Maria Souza Lima']);
    expect(sugestoesDeNome(pessoas, 'MARIA CÓSTA').map(p => p.nome)).toEqual(['Ana Maria Costa']);
  });

  it('a pessoa já escolhida (nome + telefone iguais) sai da lista', () => {
    const mariana = pessoas.find(p => p.nome === 'Mariana Reis')!;
    expect(linhaDaPessoa(mariana)).toBe('Mariana Reis – (85) 99999-0007');
    expect(sugestoesDeNome(pessoas, linhaDaPessoa(mariana))).toEqual([]);
  });
});

describe('telefone fora do formato (auditoria de 16/10/2026)', () => {
  it('aceita o 0 antes do DDD', () => {
    expect(separarTelefone('João 085 99999-1234')).toEqual({ nome: 'João', telefone: '85999991234' });
  });
  it('sem DDD: não separa, a linha fica inteira (nada de nome sujo)', () => {
    expect(separarTelefone('Maria 99999-1234')).toEqual({ nome: 'Maria 99999-1234', telefone: '' });
    expect(separarTelefone('Pedro 2025 1234 5678')).toEqual({ nome: 'Pedro 2025 1234 5678', telefone: '' });
  });
  it('dois telefones: fica o primeiro, o nome sai limpo', () => {
    expect(separarTelefone('Maria (85)99999-1234 / (85) 98888-0000')).toEqual({ nome: 'Maria', telefone: '85999991234' });
  });
  it('pontuação colada nas pontas sai do nome', () => {
    expect(separarTelefone('Maria Souza 85999991234.')).toEqual({ nome: 'Maria Souza', telefone: '85999991234' });
    expect(separarTelefone('Maria, (85) 3333-4444;')).toEqual({ nome: 'Maria', telefone: '8533334444' });
  });
  it('hífen do nome composto fica', () => {
    expect(separarTelefone('Ana-Maria Lopes – (85) 99999-1234')).toEqual({ nome: 'Ana-Maria Lopes', telefone: '85999991234' });
  });
  it('linha só com traço não é nome', () => {
    expect(convocacoesDasLinhas(['  – ', 'Ana'])).toEqual([{ nome: 'Ana', telefone: '' }]);
  });
  it('linha só com telefone vai para o nome de cima (cópia do WhatsApp)', () => {
    expect(convocacoesDasLinhas(['Ana Souza', '(85) 99999-1234', 'Bia Lima', 'Caio Reis – 85 98888-7777', '85 97777-6666']))
      .toEqual([{ nome: 'Ana Souza', telefone: '85999991234' }, { nome: 'Bia Lima', telefone: '' }, { nome: 'Caio Reis', telefone: '85988887777' }]);
  });
  it('homônimos com telefones diferentes e o nome digitado sem telefone: nenhum selo de uma só', () => {
    const pessoas = agruparPessoas([
      cand('Maria Silva', 's1', '10/01/2026', 'ausente', { telefone: '85999990001' }),
      cand('Maria Silva', 's2', '15/03/2026', 'aprovado', { telefone: '85999990002' }),
    ], SELECOES);
    expect(indicePorPessoa(pessoas)('Maria Silva')).toBeUndefined();
  });
});
