/**
 * O ciclo de vida da leitura por partes (auditoria e segurança de 19/10/2026):
 * pedido feito antes de a leitura ligar, pedido no mesmo desenho em que ela
 * liga, e leitura a caminho quando a unidade troca. React falso que guarda
 * estado entre desenhos (o efeito do filho roda ANTES do efeito do hook, como
 * no React de verdade — por isso a tela pede "antes" de os efeitos rodarem).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const R = vi.hoisted(() => {
  const r: any = { slots: [] as any[], i: 0, effects: [] as any[] };
  const slot = (init: () => any) => { const k = r.i++; if (!(k in r.slots)) r.slots[k] = init(); return r.slots[k]; };
  r.api = {
    useState: (v: any) => { const s = slot(() => ({ v: typeof v === 'function' ? v() : v })); return [s.v, (n: any) => { s.v = typeof n === 'function' ? n(s.v) : n; }]; },
    useRef: (v: any) => slot(() => ({ current: v })),
    useMemo: (f: any, deps: any[]) => {
      const s = slot(() => ({ deps: undefined as any, v: undefined }));
      if (!s.deps || deps.some((d: any, j: number) => !Object.is(d, s.deps[j]))) { s.deps = deps; s.v = f(); }
      return s.v;
    },
    useEffect: (f: any, deps?: any[]) => {
      const s = slot(() => ({ deps: undefined as any }));
      if (!deps || !s.deps || deps.some((d: any, j: number) => !Object.is(d, s.deps[j]))) { s.deps = deps; r.effects.push(f); }
    },
  };
  return r;
});
vi.mock('react', () => R.api);
const st = vi.hoisted(() => ({ leituras: [] as any[], pendentes: [] as any[] }));
vi.mock('../lib/firebase', () => ({
  db: {}, isFirebaseEnabled: true,
  where: (...a: any[]) => a, orderBy: (...a: any[]) => a, limit: (...a: any[]) => a,
  getDocs: (q: any) => {
    st.leituras.push(q);
    return new Promise(r => st.pendentes.push((docs: any[]) => r({ forEach: (f: any) => docs.forEach(d => f({ id: d.id, data: () => d })) })));
  },
}));
vi.mock('./useFirestoreCollection', () => ({
  useFirestoreCollection: () => ({ items: [], loading: false, usingFirebase: true, upsert: async () => {}, remove: async () => {} }),
  colecaoDoLeitor: (_n: string, escopo: any, ...f: any[]) => ({ escopo, f }),
}));

const { useCandidatos } = await import('./useCandidatos');
const ANTIGA = { id: 'antiga', data: '01/03/2025' };
const vinte = () => Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, selecaoId: 'antiga', nome: `Pessoa ${i}` }));
const esperar = () => new Promise(r => setTimeout(r, 0));
/** Desenha o hook; `tela` roda no lugar do efeito do filho (antes dos efeitos do hook). */
function desenhar(ligado: boolean, escopo: string | null, tela?: (h: any) => void, uid = 'x') {
  R.i = 0;
  const h = useCandidatos({ uid }, ligado, escopo);
  tela?.(h);
  const fx = R.effects; R.effects = []; fx.forEach((f: any) => f());
  return h;
}

beforeEach(() => { R.slots = []; R.effects = []; st.leituras = []; st.pendentes = []; });

describe('leitura por partes — ciclo de vida', () => {
  it('pedido feito com a leitura DESLIGADA é feito quando ela liga (seleção antiga aberta pelo Início)', async () => {
    desenhar(false, 'universidade', h => h.garantirSelecoes([ANTIGA]));
    expect(st.leituras).toHaveLength(0);
    desenhar(true, 'universidade');
    await esperar();
    expect(st.leituras).toHaveLength(1);
    st.pendentes.shift()(vinte());
    await esperar();
    expect(desenhar(true, 'universidade').candidatos).toHaveLength(20);
  });

  it('pedido no MESMO desenho em que a leitura liga não é descartado', async () => {
    desenhar(false, null);
    desenhar(true, 'universidade', h => h.garantirSelecoes([ANTIGA]));
    await esperar();
    st.pendentes.shift()(vinte());
    await esperar();
    expect(desenhar(true, 'universidade').candidatos).toHaveLength(20);
  });

  it('leitura a caminho quando a unidade TROCA não entra na lista da outra unidade', async () => {
    desenhar(true, 'universidade', h => h.garantirSelecoes([ANTIGA]));
    await esperar();
    desenhar(true, 'colegio');
    st.pendentes.shift()(vinte());
    await esperar();
    expect(desenhar(true, 'colegio').candidatos).toHaveLength(0);
  });

  it('saiu (leitura desliga): o que veio por pedido é descartado', async () => {
    desenhar(true, 'universidade', h => h.garantirSelecoes([ANTIGA]));
    await esperar();
    st.pendentes.shift()(vinte());
    await esperar();
    expect(desenhar(true, 'universidade').candidatos).toHaveLength(20);
    desenhar(false, 'universidade');
    expect(desenhar(false, 'universidade').candidatos).toHaveLength(0);
  });

  it('unidade TROCA no mesmo desenho em que a tela pede: o pedido vale para a unidade nova', async () => {
    desenhar(true, 'universidade', h => h.garantirSelecoes([ANTIGA]));
    await esperar();
    st.pendentes.shift()(vinte());
    await esperar();
    desenhar(true, 'colegio', h => h.garantirSelecoes([ANTIGA]));
    await esperar();
    expect(st.leituras).toHaveLength(2);
    expect(st.leituras[1].escopo).toBe('colegio');
    st.pendentes.shift()(vinte());
    await esperar();
    expect(desenhar(true, 'colegio').candidatos).toHaveLength(20);
  });

  it('a fila de pedidos de uma conta não é feita na conta seguinte', async () => {
    desenhar(false, 'universidade', h => h.garantirSelecoes([ANTIGA]), 'conta-a');
    desenhar(false, null, undefined, 'conta-b');
    desenhar(true, 'colegio', undefined, 'conta-b');
    await esperar();
    expect(st.leituras).toHaveLength(0);
  });

  it('chamada de um desenho ANTIGO depois de trocar a unidade lê com a unidade NOVA', async () => {
    const antigo = desenhar(true, 'universidade');
    desenhar(true, 'colegio');
    antigo.garantirSelecoes([ANTIGA]);
    await esperar();
    expect(st.leituras).toHaveLength(1);
    expect(st.leituras[0].escopo).toBe('colegio');
  });

  it('leitura desligada no meio: a chamada antiga RECUSA, e a seleção não fica marcada como lida (vazia)', async () => {
    const antigo = desenhar(true, 'universidade');
    desenhar(false, 'universidade');
    await expect(antigo.garantirSelecoes([ANTIGA])).rejects.toThrow();
    const novo = desenhar(true, 'universidade');
    const p = novo.daSelecao(ANTIGA);
    await esperar();
    expect(st.leituras).toHaveLength(1);
    st.pendentes.shift()(vinte());
    expect(await p).toHaveLength(20);
  });

  it('o mesmo para o ANO: a chamada antiga recusa e o ano é lido quando a leitura religa', async () => {
    const antigo = desenhar(true, 'universidade');
    desenhar(false, 'universidade');
    await expect(antigo.garantirAno(2024)).rejects.toThrow();
    const novo = desenhar(true, 'universidade');
    const p = novo.garantirAno(2024);
    await esperar();
    expect(st.leituras).toHaveLength(1);
    st.pendentes.shift()(vinte().map(c => ({ ...c, dataISO: '2024-05-01' })));
    await p;
    expect(desenhar(true, 'universidade').candidatos).toHaveLength(20);
  });
});
