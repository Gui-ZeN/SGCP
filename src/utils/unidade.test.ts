import { describe, it, expect } from 'vitest';
import {
  regiaoDaSede, sedeEhUniversidade, vagaEhUniversidade,
  escoparVagasPorUnidade, escoparSedesPorUnidade, escoparListaPorUnidade,
  acharSede, siglaCanonica
} from './unidade';
import type { Vaga } from '../types';
import type { Sede } from '../hooks/useMetadata';

const SEDES: Sede[] = [
  { id: 's1', nome: 'DIONISIO TORRES', regiao: 'Dionísio Torres', sigla: 'DT' },
  { id: 's2', nome: 'SUL', regiao: 'Sul', sigla: 'SUL 1' },
  { id: 's3', nome: 'BARAO STUADART', regiao: 'Central', sigla: 'BS' },
  { id: 's4', nome: 'PARQUE ECOLÓGICO', regiao: 'Universidade', sigla: 'PE' },
  { id: 's5', nome: 'ALDEOTA', regiao: 'Universidade', sigla: 'ALD' },
];

const vaga = (p: Partial<Vaga>) => p as Vaga;
const VAGAS: Vaga[] = [
  vaga({ id: 'c1', vaga: 'Prof', sede: 'DIONISIO TORRES' }),
  vaga({ id: 'c2', vaga: 'Zelador', sede: 'SUL' }),
  vaga({ id: 'u1', vaga: 'Coordenador NPJ', sede: 'PARQUE ECOLÓGICO' }),
  vaga({ id: 'u2', vaga: 'Analista', sede: 'QUALQUER', origem: 'planilha-universidade' }), // origem manda, mesmo sede desconhecida
  vaga({ id: 'x1', vaga: 'Sem sede', sede: '' }), // sede vazia → Colégio (não some)
];

describe('regiaoDaSede / sedeEhUniversidade', () => {
  it('resolve por nome (case-insensitive)', () => {
    expect(regiaoDaSede(SEDES, 'dionisio torres')).toBe('Dionísio Torres');
    expect(sedeEhUniversidade(SEDES, 'ALDEOTA')).toBe(true);
    expect(sedeEhUniversidade(SEDES, 'SUL')).toBe(false);
  });
  it('sede desconhecida/vazia → não é Universidade', () => {
    expect(sedeEhUniversidade(SEDES, 'NAO EXISTE')).toBe(false);
    expect(sedeEhUniversidade(SEDES, undefined)).toBe(false);
  });
  it('resolve também pela SIGLA (treinamentos usam sigla na unidade)', () => {
    expect(regiaoDaSede(SEDES, 'DT')).toBe('Dionísio Torres');
    expect(sedeEhUniversidade(SEDES, 'PE')).toBe(true);   // sigla da PARQUE ECOLÓGICO
    expect(sedeEhUniversidade(SEDES, 'SUL 1')).toBe(false);
  });
});

describe('vagaEhUniversidade', () => {
  it('por sede em região Universidade', () => expect(vagaEhUniversidade(VAGAS[2], SEDES)).toBe(true));
  it('por origem de planilha (independe da sede)', () => expect(vagaEhUniversidade(VAGAS[3], SEDES)).toBe(true));
  it('Colégio → false', () => expect(vagaEhUniversidade(VAGAS[0], SEDES)).toBe(false));
});

describe('escoparVagasPorUnidade (o isolamento)', () => {
  it('admin vê tudo', () => {
    expect(escoparVagasPorUnidade(VAGAS, SEDES, 'DIONISIO TORRES', true).map(v => v.id))
      .toEqual(['c1', 'c2', 'u1', 'u2', 'x1']);
  });
  it('usuário do Colégio vê TODO o Colégio (5 regiões se enxergam) e NUNCA a Universidade', () => {
    expect(escoparVagasPorUnidade(VAGAS, SEDES, 'BARAO STUADART', false).map(v => v.id))
      .toEqual(['c1', 'c2', 'x1']);
  });
  it('usuário da Universidade vê SÓ a Universidade', () => {
    expect(escoparVagasPorUnidade(VAGAS, SEDES, 'ALDEOTA', false).map(v => v.id))
      .toEqual(['u1', 'u2']);
  });
  it('usuário sem sede (ex.: Visualizador) conta como Colégio', () => {
    expect(escoparVagasPorUnidade(VAGAS, SEDES, undefined, false).map(v => v.id))
      .toEqual(['c1', 'c2', 'x1']);
  });
});

describe('escoparListaPorUnidade (treinamentos/experiências/entrevistas)', () => {
  // Entrevistas de desligamento: contêm dado pessoal e alimentam o "clima" da Home.
  const entrevistas = [
    { id: 'e1', unidade: 'DIONISIO TORRES' },   // Colégio (nome)
    { id: 'e2', unidade: 'BS' },                // Colégio (sigla)
    { id: 'e3', unidade: 'PARQUE ECOLÓGICO' },  // Universidade
    { id: 'e4', unidade: 'ALD' },               // Universidade (sigla)
    { id: 'e5', unidade: '' },                  // sem sede → Colégio
  ];
  const ids = (l: { id: string }[]) => l.map(x => x.id);

  it('usuário da Universidade NÃO vê as saídas do Colégio', () => {
    expect(ids(escoparListaPorUnidade(entrevistas, e => e.unidade, SEDES, 'ALDEOTA', false)))
      .toEqual(['e3', 'e4']);
  });
  it('usuário do Colégio NÃO vê as saídas da Universidade', () => {
    expect(ids(escoparListaPorUnidade(entrevistas, e => e.unidade, SEDES, 'SUL', false)))
      .toEqual(['e1', 'e2', 'e5']);
  });
  it('admin vê tudo', () => {
    expect(escoparListaPorUnidade(entrevistas, e => e.unidade, SEDES, 'SUL', true)).toHaveLength(5);
  });
});

describe('escoparListaPorUnidade — eventos de seleção', () => {
  // O "Funil de Seleção" dos Indicadores somava as duas unidades num número só
  // até 31/08/2026. Indicador do Colégio e da Universidade não se misturam.
  const selecoes = [
    { id: 's1', sede: 'DT' },                 // Colégio (sigla)
    { id: 's2', sede: 'BS' },                 // Colégio
    { id: 's3', sede: 'ALDEOTA' },            // Universidade
    { id: 's4', sede: 'PARQUE ECOLÓGICO' },   // Universidade
  ];
  const ids = (l: { id: string }[]) => l.map(x => x.id);

  it('Colégio não soma as convocações da Universidade', () => {
    expect(ids(escoparListaPorUnidade(selecoes, s => s.sede, SEDES, 'SUL', false)))
      .toEqual(['s1', 's2']);
  });
  it('Universidade não soma as do Colégio', () => {
    expect(ids(escoparListaPorUnidade(selecoes, s => s.sede, SEDES, 'ALDEOTA', false)))
      .toEqual(['s3', 's4']);
  });
});

describe('escoparSedesPorUnidade (filtros)', () => {
  it('Colégio não lista sedes da Universidade', () => {
    expect(escoparSedesPorUnidade(SEDES, 'SUL', false).map(s => s.sigla))
      .toEqual(['DT', 'SUL 1', 'BS']);
  });
  it('Universidade só lista as suas', () => {
    expect(escoparSedesPorUnidade(SEDES, 'PARQUE ECOLÓGICO', false).map(s => s.sigla))
      .toEqual(['PE', 'ALD']);
  });
  it('admin vê todas', () => {
    expect(escoparSedesPorUnidade(SEDES, 'SUL', true)).toHaveLength(5);
  });
});

describe('siglaCanonica / acharSede', () => {
  // Recorte real do catálogo /sedes lido em 27/08/2026.
  const cat = [
    { id: '1', nome: 'DIONISIO TORRES', sigla: 'DT', regiao: 'Dionísio Torres' },
    { id: '2', nome: 'PARQUELANDIA 1', sigla: 'PQL 1', regiao: 'Parquelândia' },
    { id: '3', nome: 'SUL 2', sigla: 'SUL 2', regiao: 'Sul' },
    { id: '4', nome: 'Construtora', sigla: null, regiao: 'Central' },
  ] as any;

  it('casa por nome e por sigla, ignorando caixa e espaços', () => {
    expect(siglaCanonica(cat, 'DIONISIO TORRES')).toBe('DT');
    expect(siglaCanonica(cat, 'DT')).toBe('DT');
    expect(siglaCanonica(cat, '  dt  ')).toBe('DT');
    expect(siglaCanonica(cat, 'Sul 2')).toBe('SUL 2');
    expect(siglaCanonica(cat, 'PARQUELANDIA 1')).toBe('PQL 1');
    expect(siglaCanonica(cat, 'PQL 1')).toBe('PQL 1');
  });

  it('as duas grafias colapsam na MESMA chave de agrupamento', () => {
    // O bug medido: DT (63) e DIONISIO TORRES (20) viravam duas barras "DT".
    expect(siglaCanonica(cat, 'DT')).toBe(siglaCanonica(cat, 'DIONISIO TORRES'));
    expect(siglaCanonica(cat, 'SUL 2')).toBe(siglaCanonica(cat, 'Sul 2'));
  });

  it('sede sem sigla cai no nome', () => {
    expect(siglaCanonica(cat, 'Construtora')).toBe('Construtora');
  });

  it('sede fora do catálogo volta como veio, sem sumir', () => {
    expect(siglaCanonica(cat, 'CD LOJINHA')).toBe('CD LOJINHA');
    expect(siglaCanonica(cat, '')).toBe('');
    expect(siglaCanonica(cat, undefined)).toBe('');
  });

  it('acharSede devolve o doc do catálogo ou undefined', () => {
    expect(acharSede(cat, 'dt')?.nome).toBe('DIONISIO TORRES');
    expect(acharSede(cat, 'inexistente')).toBeUndefined();
  });

  it('regiaoDaSede continua funcionando por nome e por sigla', () => {
    expect(regiaoDaSede(cat, 'DT')).toBe('Dionísio Torres');
    expect(regiaoDaSede(cat, 'DIONISIO TORRES')).toBe('Dionísio Torres');
  });
});
