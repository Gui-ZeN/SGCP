/**
 * O provedor do Banco pede o histórico ao banco a cada nome na tela. Leitura
 * que falha não pode virar laço (render → pede → falha → render → pede…):
 * achado da auditoria de 19/10/2026. React falso com setState que redesenha.
 */
import { it, expect, vi } from 'vitest';

const R = vi.hoisted(() => {
  const r: any = { slots: [] as any[], i: 0, effects: [] as any[], agendado: false, renders: 0, rerender: () => {} };
  const slot = (init: () => any) => { const k = r.i++; if (!(k in r.slots)) r.slots[k] = init(); return r.slots[k]; };
  r.api = {
    useState: (v: any) => {
      const s = slot(() => ({ v: typeof v === 'function' ? v() : v }));
      return [s.v, (n: any) => {
        s.v = typeof n === 'function' ? n(s.v) : n;
        if (!r.agendado) { r.agendado = true; setTimeout(() => { r.agendado = false; r.rerender(); }, 0); }
      }];
    },
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
    useContext: () => null,
    createContext: () => ({ Provider: 'P' }),
  };
  return r;
});
vi.mock('react', () => R.api);
vi.mock('react/jsx-runtime', () => ({ jsx: (t: any, p: any) => ({ t, p }), jsxs: (t: any, p: any) => ({ t, p }), Fragment: 'F' }));
vi.mock('react/jsx-dev-runtime', () => ({ jsxDEV: (t: any, p: any) => ({ t, p }), Fragment: 'F' }));
vi.mock('../lib/firebase', () => ({ isFirebaseEnabled: true, db: {}, serverTimestamp: () => 0 }));
vi.mock('./useFirestoreCollection', () => ({ useFirestoreCollection: () => ({ items: [], create: async () => {}, update: async () => {} }) }));

const { ProvedorBanco } = await import('./useBancoCandidatos');
// Listas ESTÁVEIS entre desenhos, como as do App (lista nova a cada desenho
// mudaria o contexto sempre e esconderia o defeito do redesenho).
const VAZIO: any[] = [];

it('leitura que falha não vira laço, e a tela fica sabendo que falhou', async () => {
  let chamadas = 0;
  const busca = {
    porNomes: async () => { chamadas++; throw new Error('índice em construção'); },
    porTelefones: async () => [], porPrefixo: async () => [], porContratado: async () => [],
  };
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  let valor: any;
  R.rerender = () => {
    R.i = 0; R.renders++;
    const el: any = (ProvedorBanco as any)({ candidatos: VAZIO, selecoes: VAZIO, marcas: VAZIO, busca, corte: '2026-08-20', unidadeDoLeitor: null, children: null });
    valor = el.p.value;
    valor.avisoPara('Maria Silva'); // o selo desenhando
    const fx = R.effects; R.effects = []; fx.forEach((f: any) => f());
  };
  R.rerender();
  await new Promise(r => setTimeout(r, 300));
  R.rerender = () => {};
  expect(chamadas).toBe(1);
  expect(valor.falhouPara('Maria Silva')).toBe(true);
});

it('a falha é POR NOME: a leitura boa de outro não apaga o aviso, e a nova tentativa vem sozinha', async () => {
  R.slots = []; R.effects = []; R.renders = 0;
  vi.useFakeTimers();
  let rede = false;
  const pedidosMaria: number[] = [];
  const busca = {
    porNomes: async (nomes: string[]) => {
      if (nomes.includes('maria silva')) { pedidosMaria.push(Date.now()); if (!rede) throw new Error('sem rede'); }
      return nomes.map(n => ({ id: n, nome: n, selecaoId: 's', data: '01/03/2025', resultado: 'ausente' }));
    },
    porTelefones: async () => [], porPrefixo: async () => [], porContratado: async () => [],
  };
  let nomesNaTela = ['Maria Silva'];
  let valor: any;
  R.rerender = () => {
    R.i = 0; R.renders++;
    const el: any = (ProvedorBanco as any)({ candidatos: VAZIO, selecoes: VAZIO, marcas: VAZIO, busca, corte: '2026-08-20', unidadeDoLeitor: null, children: null });
    // Como no React de verdade: o selo (filho fixo vindo do App) só redesenha
    // quando o VALOR do contexto muda — redesenhar só o provedor não basta.
    const novo = el.p.value;
    if (novo !== valor) { valor = novo; nomesNaTela.forEach(n => valor.avisoPara(n)); }
    const fx = R.effects; R.effects = []; fx.forEach((f: any) => f());
  };
  R.rerender();
  await vi.advanceTimersByTimeAsync(10);
  expect(valor.falhouPara('Maria Silva')).toBe(true);
  // Volta a rede; outro nome entra na tela e é lido com sucesso.
  rede = true;
  nomesNaTela = ['Maria Silva', 'João Lima'];
  valor = undefined; // a tela mudou (outro nome entrou): o selo redesenha
  R.rerender();
  await vi.advanceTimersByTimeAsync(10);
  expect(valor.falhouPara('João Lima')).toBe(false);
  expect(valor.falhouPara('Maria Silva')).toBe(true); // ainda não conferida: não vira "nunca convocada"
  // Tela parada: depois de 30 s a nova tentativa acontece sem ninguém mexer.
  await vi.advanceTimersByTimeAsync(31_000);
  expect(pedidosMaria).toHaveLength(2);
  expect(valor.falhouPara('Maria Silva')).toBe(false);
  expect(valor.avisoPara('Maria Silva')?.vezes).toBe(1);
  R.rerender = () => {};
  vi.useRealTimers();
});

it('busca pelo começo do nome que falhou não vira "Ninguém": relança, e refaz sozinha em 30 s', async () => {
  R.slots = []; R.effects = [];
  vi.useFakeTimers();
  let rede = false, chamadas = 0;
  const busca = {
    porNomes: async () => [], porTelefones: async () => [], porContratado: async () => [],
    porPrefixo: async (q: string) => { chamadas++; if (!rede) throw new Error('sem rede'); return [{ id: '1', nome: 'Maria Silva', selecaoId: 's', data: '01/03/2025', resultado: 'ausente' }]; },
  };
  let valor: any;
  R.rerender = () => {
    R.i = 0;
    valor = (ProvedorBanco as any)({ candidatos: VAZIO, selecoes: VAZIO, marcas: VAZIO, busca, corte: '2026-08-20', unidadeDoLeitor: null, children: null }).p.value;
    const fx = R.effects; R.effects = []; fx.forEach((f: any) => f());
  };
  R.rerender();
  await expect(valor.procurar('mar')).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(10);
  expect(valor.buscaFalhou('mar')).toBe(true);
  rede = true;
  // O mesmo texto de novo (redigitou, espaço no fim): não diz "completa".
  await expect(valor.procurar('mar ')).rejects.toThrow();
  expect(chamadas).toBe(1);
  await vi.advanceTimersByTimeAsync(31_000);
  expect(valor.buscaFalhou('mar')).toBe(false);
  expect(await valor.procurar('mar')).toBe(true);
  expect(chamadas).toBe(2);
  R.rerender = () => {};
  vi.useRealTimers();
});
