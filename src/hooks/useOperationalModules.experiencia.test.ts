/**
 * Prazos da experiência por unidade (04/11/2026): Universidade +45/+75, como na
 * planilha dela; Colégio +44/+89. Passa pelo hook e pelo useFirestoreCollection
 * REAIS (carimbo de unidade incluso) — só o banco e o React são falsos. O projeto
 * não tem biblioteca de teste de componente.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const R = vi.hoisted(() => {
  const r: any = { slots: [] as any[], i: 0, efeitos: [] as any[] };
  const slot = (ini: () => any) => { const k = r.i++; if (!(k in r.slots)) r.slots[k] = ini(); return r.slots[k]; };
  r.api = {
    useState: (v: any) => { const s = slot(() => ({ v: typeof v === 'function' ? v() : v })); return [s.v, (n: any) => { s.v = typeof n === 'function' ? n(s.v) : n; }]; },
    useRef: (v: any) => slot(() => ({ current: v })),
    useMemo: (f: any) => f(),
    useCallback: (f: any) => f,
    useEffect: (f: any, deps?: any[]) => {
      const s = slot(() => ({ deps: undefined as any }));
      if (!deps || !s.deps || deps.some((d: any, j: number) => !Object.is(d, s.deps[j]))) { s.deps = deps; r.efeitos.push(f); }
    },
  };
  return r;
});
vi.mock('react', () => R.api);

const b = vi.hoisted(() => ({ existentes: [] as any[], criados: [] as any[], editados: [] as any[] }));
vi.mock('../lib/firebase', () => ({
  db: {}, isFirebaseEnabled: true,
  collection: (_: any, nome: string) => ({ nome }),
  doc: (_: any, nome: string, id: string) => ({ nome, id }),
  query: (c: any) => c,
  where: () => ({}),
  getDocs: async () => ({ forEach() {}, docs: [] }),
  onSnapshot: (c: any, cb: any) => {
    const lista = c.nome === 'experiencia' ? b.existentes : [];
    cb({ forEach: (f: any) => lista.forEach(d => f({ id: d.id, data: () => d })) });
    return () => {};
  },
  addDoc: async (c: any, d: any) => { if (c.nome === 'experiencia') b.criados.push(d); return { id: 'novo' }; },
  updateDoc: async (r: any, d: any) => { if (r.nome === 'experiencia') b.editados.push(d); },
  setDoc: async () => {}, deleteDoc: async () => {},
  writeBatch: () => ({ set() {}, delete() {}, commit: async () => {} }),
  handleFirestoreError: (e: any) => { throw e; },
  OperationType: {},
}));

vi.stubGlobal('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });

const { useOperationalModules } = await import('./useOperationalModules');
const { avaliacoesAVencer } = await import('../components/indicadores/AbaPessoas');
const { montarAgendaDoDia } = await import('../utils/agenda');
const { avaliacaoDoMes, avaliacoesDoMes, experienciaDoMes } = await import('../utils/relatorioMensal');
const { pendenciasDoMes } = await import('../utils/pendenciasDoMes');
const { diasEntre } = await import('../utils/date');

const SEDES = [
  { id: '1', nome: 'ALDEOTA', sigla: 'ALD', regiao: 'Universidade' },
  { id: '2', nome: 'DIONISIO TORRES', sigla: 'DT', regiao: 'Fortaleza' },
];
/** Desenha o hook e roda os efeitos (a escuta entrega `existentes`) até assentar. */
function hook(escopo: string | null) {
  let h: any;
  for (let i = 0; i < 3; i++) {
    R.i = 0;
    h = useOperationalModules({ uid: 'x' }, { sedes: SEDES, escopo, pronto: true } as any);
    const fx = R.efeitos; R.efeitos = []; fx.forEach((f: any) => f());
  }
  return h;
}
const base = { colaborador: 'A', funcao: 'F', setor: '', dataAdmissao: '02/11/2026', supervisor: '', status: 'EM_ANALISE', observacoes: '' };
const prazos = (c: any) => [diasEntre(c.dataAdmissao ?? base.dataAdmissao, c.termino1), diasEntre(c.dataAdmissao ?? base.dataAdmissao, c.termino2)];

beforeEach(() => { R.slots = []; R.efeitos = []; b.existentes = []; b.criados = []; b.editados = []; });

describe('criar experiência', () => {
  it('Administrador, sede da Universidade: +45/+75', async () => {
    await hook(null).addExperiencia({ ...base, sede: 'ALDEOTA' });
    expect(b.criados[0].escopo).toBe('universidade');
    expect(prazos(b.criados[0])).toEqual([45, 75]);
  });
  it('Administrador, sede do Colégio: +44/+89', async () => {
    await hook(null).addExperiencia({ ...base, sede: 'DIONISIO TORRES' });
    expect(b.criados[0].escopo).toBe('colegio');
    expect(prazos(b.criados[0])).toEqual([44, 89]);
  });
  it('Coordenador da Universidade, sede fora do cadastro: a unidade é a dele', async () => {
    await hook('universidade').addExperiencia({ ...base, sede: 'BENFICA' });
    expect(b.criados[0].escopo).toBe('universidade');
    expect(prazos(b.criados[0])).toEqual([45, 75]);
  });
  it('Coordenador não cria na outra unidade, mesmo dizendo outra', async () => {
    await hook('colegio').addExperiencia({ ...base, sede: 'DIONISIO TORRES', escopo: 'universidade' });
    expect(b.criados[0].escopo).toBe('colegio');
    expect(prazos(b.criados[0])).toEqual([44, 89]);
  });
});

describe('editar experiência', () => {
  const col = { id: 'c', ...base, sede: 'DIONISIO TORRES', escopo: 'colegio', termino1: '16/12/2026', termino2: '30/01/2027' };
  const uni = { id: 'u', ...base, sede: 'ALDEOTA', escopo: 'universidade', termino1: '17/12/2026', termino2: '16/01/2027' };

  it('Administrador leva quem está em andamento para a outra unidade: prazos da unidade nova', async () => {
    b.existentes = [col];
    await hook(null).updateExperiencia('c', { sede: 'ALDEOTA', dataAdmissao: base.dataAdmissao });
    expect(b.editados[0].escopo).toBe('universidade');
    expect(prazos(b.editados[0])).toEqual([45, 75]);
  });
  it('o caminho inverso também', async () => {
    b.existentes = [uni];
    await hook(null).updateExperiencia('u', { sede: 'DIONISIO TORRES' });
    expect(b.editados[0].escopo).toBe('colegio');
    expect(prazos(b.editados[0])).toEqual([44, 89]);
  });
  it('prorrogado também passa aos prazos da unidade nova', async () => {
    b.existentes = [{ ...col, status: 'PRORROGADO' }];
    await hook(null).updateExperiencia('c', { sede: 'ALDEOTA' });
    expect(prazos(b.editados[0])).toEqual([45, 75]);
  });
  it('encerrado e efetivado mudam de unidade sem mexer nas datas', async () => {
    b.existentes = [{ ...col, status: 'ENCERRADO' }, { ...col, id: 'd', status: 'EFETIVADO' }];
    const h = hook(null);
    await h.updateExperiencia('c', { sede: 'ALDEOTA' });
    await h.updateExperiencia('d', { sede: 'ALDEOTA' });
    expect(b.editados.map(x => x.termino2)).toEqual([undefined, undefined]);
    expect(b.editados.map(x => x.escopo)).toEqual(['universidade', 'universidade']);
  });
  it('mudar outro campo não mexe nos prazos', async () => {
    b.existentes = [uni];
    await hook(null).updateExperiencia('u', { supervisor: 'X', dataAdmissao: base.dataAdmissao });
    expect(b.editados[0].termino1).toBeUndefined();
    expect(b.editados[0].termino2).toBeUndefined();
  });
  it('mover a admissão preserva o espaçamento do registro', async () => {
    b.existentes = [uni];
    await hook(null).updateExperiencia('u', { dataAdmissao: '05/11/2026' });
    expect(prazos({ ...b.editados[0] })).toEqual([45, 75]);
  });
});

describe('o rótulo acompanha a unidade', () => {
  it('a vencer, agenda e relatório dizem 75 na Universidade e 90 no Colégio', () => {
    const uni: any = { colaborador: 'U', status: 'PRORROGADO', escopo: 'universidade', termino1: '', termino2: '16/01/2027' };
    const col: any = { colaborador: 'C', status: 'PRORROGADO', escopo: 'colegio', termino1: '', termino2: '16/01/2027' };
    expect(avaliacoesAVencer([uni, col], 15, '2027-01-10').map(v => v.marco).sort()).toEqual(['75 dias', '90 dias']);
    const agenda = montarAgendaDoDia('16/01/2027', { selecoes: [], vagas: [], integracoes: [], entrevistas: [], consultas: [], experiencias: [uni, col] } as any);
    expect(agenda.eventos.map((x: any) => x.titulo)).toEqual(['Vence 75 dias — U', 'Vence 90 dias — C']);
    expect(avaliacaoDoMes(uni, 2027, 1, '2027-01-20')?.marco).toBe('75 dias');
    expect(avaliacaoDoMes(col, 2027, 1, '2027-01-20')?.marco).toBe('90 dias');
  });
});

describe('relatório do mês', () => {
  it('os dois prazos no mesmo mês contam duas avaliações de quem passou do 1º', () => {
    const e: any = { sede: 'ALD', escopo: 'universidade', status: 'PRORROGADO', termino1: '01/03/2027', termino2: '31/03/2027' };
    const [l] = experienciaDoMes([e], 2027, 3, '2027-04-05');
    expect(l).toMatchObject({ programadas: 2, realizadas: 1, prorrogadas: 1, semDesfecho: 1 });
  });
  it('a 2ª avaliação diz o desfecho e o rótulo da unidade', () => {
    const pro: any = { escopo: 'universidade', status: 'PRORROGADO', termino1: '01/03/2027', termino2: '31/03/2027' };
    expect(avaliacoesDoMes(pro, 2027, 3, '2027-04-05').map(a => [a.marco, a.desfecho])).toEqual([['45 dias', 'prorrogadas'], ['75 dias', 'semDesfecho']]);
    expect(avaliacoesDoMes(pro, 2027, 3, '2027-03-10').map(a => a.desfecho)).toEqual(['prorrogadas', 'aVencer']);
    expect(avaliacoesDoMes({ ...pro, status: 'EFETIVADO' }, 2027, 3, '2027-04-05').map(a => a.desfecho)).toEqual(['prorrogadas', 'efetivadas']);
    expect(avaliacoesDoMes({ ...pro, status: 'EM_ANALISE' }, 2027, 3, '2027-04-05')).toHaveLength(1);
  });
  it('a pendência aponta a 2ª avaliação vencida, uma vez só', () => {
    const e: any = { id: 'x', colaborador: 'U', sede: 'ALD', escopo: 'universidade', status: 'PRORROGADO', termino1: '01/03/2027', termino2: '31/03/2027' };
    const l = pendenciasDoMes({ ano: 2027, mes: 3, hojeISO: '2027-04-05', vagas: [], selecoes: [], experiencias: [e], integracoes: [], treinamentos: [], comIntegracao: false, abaSelecoes: 'selecoesLista' });
    const it = l.find(p => p.id === 'experiencia')!.itens;
    expect(it).toHaveLength(1);
    expect(it[0].detalhe).toContain('75 dias · venceu 31/03');
  });
  it('quem saiu no 1º prazo conta uma só', () => {
    const e: any = { sede: 'ALD', escopo: 'universidade', status: 'ENCERRADO', tipoEncerramento: 'empresa', termino1: '01/03/2027', termino2: '31/03/2027' };
    const [l] = experienciaDoMes([e], 2027, 3, '2027-04-05');
    expect(l).toMatchObject({ programadas: 1, desligados: 1 });
  });
});
