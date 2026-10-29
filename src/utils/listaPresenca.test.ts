import { describe, it, expect } from 'vitest';
import { folhasDaLista, htmlDaListaDePresenca, LINHAS_POR_FOLHA, MAX_EM_BRANCO, type DadosDaLista } from './listaPresenca';

const base: DadosDaLista = {
  unidade: 'universidade', logo: 'https://sgp.test/logos/universidade.png', tema: 'NR 35', instrutor: 'SESMT', data: '22/10/2026',
  local: 'BENFICA', horario: '14h', cargaHoraria: '1h', pessoas: [{ nome: 'Ana Lima', setor: 'Infra' }], emBranco: 5,
};

describe('folhasDaLista', () => {
  it('os do quadro primeiro, depois as em branco, numeradas em sequência até completar a folha', () => {
    const [f] = folhasDaLista([{ nome: 'A', setor: 'Infra' }, { nome: 'B', setor: 'Infra' }], 2);
    expect(f).toHaveLength(LINHAS_POR_FOLHA);
    expect(f.slice(0, 3).map(l => [l.n, l.nome])).toEqual([[1, 'A'], [2, 'B'], [3, '']]);
    expect(f.at(-1)).toMatchObject({ n: LINHAS_POR_FOLHA, nome: '' });
  });
  it('quebra em folhas de LINHAS_POR_FOLHA', () => {
    const pessoas = Array.from({ length: LINHAS_POR_FOLHA + 3 }, (_, i) => ({ nome: `P${i}`, setor: 'Infra' }));
    const folhas = folhasDaLista(pessoas, 0);
    expect(folhas.map(f => f.length)).toEqual([LINHAS_POR_FOLHA, LINHAS_POR_FOLHA]); // a 2ª completa até o fim
    expect(folhas[1].filter(l => l.nome)).toHaveLength(3);
    expect(folhas[1][0].n).toBe(LINHAS_POR_FOLHA + 1);
  });
  it('em branco é o MÍNIMO: a folha completa sozinha; acima do teto é cortado', () => {
    expect(folhasDaLista([], -3).flat()).toHaveLength(LINHAS_POR_FOLHA);
    const cheia = Array.from({ length: LINHAS_POR_FOLHA }, (_, i) => ({ nome: `P${i}`, setor: 'Infra' }));
    expect(folhasDaLista(cheia, 1)).toHaveLength(2); // 1 em branco a mais força outra folha
    expect(folhasDaLista([], 999).flat().length).toBe(Math.ceil(MAX_EM_BRANCO / LINHAS_POR_FOLHA) * LINHAS_POR_FOLHA);
  });
});

describe('htmlDaListaDePresenca', () => {
  it('título, dados da ação e o nome impresso', () => {
    const h = htmlDaListaDePresenca(base);
    for (const t of ['LISTA DE PRESENÇA EM AÇÃO DE DESENVOLVIMENTO', 'NR 35', 'SESMT', '22/10/2026', 'BENFICA', '14h', 'Ana Lima', 'Página: 1 de 1']) expect(h).toContain(t);
  });
  it('logo e nome da unidade certos', () => {
    expect(htmlDaListaDePresenca(base)).toContain('alt="Universidade Christus"');
    expect(htmlDaListaDePresenca({ ...base, unidade: 'colegio', logo: '/c.png' })).toContain('alt="Colégio Christus"');
  });
  it('nome e tema vão como TEXTO (nada vira HTML)', () => {
    const h = htmlDaListaDePresenca({ ...base, tema: '<script>x</script>', pessoas: [{ nome: '<img onerror=alert(1)>', setor: 'Infra' }] });
    expect(h).not.toContain('<script>x');
    expect(h).not.toContain('<img onerror');
    expect(h).toContain('&lt;img onerror=alert(1)&gt;');
  });
  it('cabeçalho repetido e "Página X de Y" em cada folha', () => {
    const pessoas = Array.from({ length: LINHAS_POR_FOLHA * 2 }, (_, i) => ({ nome: `P${i}`, setor: 'Infra' }));
    const h = htmlDaListaDePresenca({ ...base, pessoas, emBranco: 1 });
    expect(h).toContain('Página: 1 de 3');
    expect(h).toContain('Página: 3 de 3');
    expect(h.match(/LISTA DE PRESENÇA EM AÇÃO/g)).toHaveLength(3);
  });
});
