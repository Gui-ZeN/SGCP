/**
 * Leitura por partes dos candidatos (19/10/2026): toda gravação que recalcula
 * os números de uma seleção parte da lista COMPLETA dela (`daSelecao`).
 * React falso: o hook vira uma função (refs/estado nas closures) — o projeto
 * não tem biblioteca de teste de componente, e aqui só importa a lógica.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react', () => ({
  useMemo: (f: any) => f(),
  useRef: (v: any) => ({ current: v }),
  useState: (v: any) => [typeof v === 'function' ? v() : v, () => {}],
  useEffect: (f: any) => { f(); },
}));
const st = vi.hoisted(() => ({ leituras: [] as any[], pendentes: [] as any[], falhar: false, janela: [] as any[] }));
vi.mock('../lib/firebase', () => ({
  db: {}, isFirebaseEnabled: true,
  where: (...a: any[]) => a, orderBy: (...a: any[]) => a, limit: (...a: any[]) => a,
  getDocs: (q: any) => {
    st.leituras.push(q);
    if (st.falhar) return Promise.reject(new Error('sem rede'));
    return new Promise(r => st.pendentes.push((docs: any[]) => r({ forEach: (f: any) => docs.forEach(d => f({ id: d.id, data: () => d })) })));
  },
}));
vi.mock('./useFirestoreCollection', () => ({
  useFirestoreCollection: () => ({ items: st.janela, loading: false, usingFirebase: true, upsert: async () => {}, remove: async () => {} }),
  colecaoDoLeitor: (_n: string, _e: any, ...f: any[]) => f,
}));

const { useCandidatos } = await import('./useCandidatos');
const responder = (docs: any[]) => { const r = st.pendentes.shift(); r(docs); };
const esperar = () => new Promise(r => setTimeout(r, 0));
const vinte = (selecaoId: string) => Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, selecaoId, nome: `Pessoa ${i}`, resultado: 'convocado' }));

beforeEach(() => { st.leituras = []; st.pendentes = []; st.falhar = false; st.janela = []; });

describe('daSelecao', () => {
  it('seleção ANTIGA fora da janela: lê pelo id da seleção e devolve a lista inteira', async () => {
    const h = useCandidatos({ uid: 'x' }, true, 'universidade');
    const p = h.daSelecao({ id: 'antiga', data: '01/03/2025' });
    await esperar();
    expect(st.leituras).toHaveLength(1);
    expect(st.leituras[0]).toEqual([['selecaoId', 'in', ['antiga']]]);
    responder(vinte('antiga'));
    expect(await p).toHaveLength(20);
  });

  it('seleção RECENTE também vai ao banco (a escuta não traz quem ficou sem dataISO)', async () => {
    const hoje = new Date();
    const data = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
    const h = useCandidatos({ uid: 'x' }, true, 'colegio');
    const p = h.daSelecao({ id: 'hoje', data });
    await esperar();
    expect(st.leituras).toHaveLength(1);
    responder([{ id: 'sem-data-iso', selecaoId: 'hoje', nome: 'Ana' }]);
    expect((await p).map(c => c.id)).toEqual(['sem-data-iso']);
  });

  it('pedida no meio de uma leitura em andamento: espera a MESMA leitura (uma ida ao banco)', async () => {
    const h = useCandidatos({ uid: 'x' }, true, null);
    const sel = { id: 'antiga', data: '01/03/2025' };
    const abrindo = h.garantirSelecoes([sel]);
    const salvando = h.daSelecao(sel);
    await esperar();
    expect(st.leituras).toHaveLength(1);
    responder(vinte('antiga'));
    await abrindo;
    expect(await salvando).toHaveLength(20);
  });

  it('leitura que falha: o erro chega a quem grava, e a próxima tentativa vai ao banco de novo', async () => {
    const h = useCandidatos({ uid: 'x' }, true, null);
    const sel = { id: 'antiga', data: '01/03/2025' };
    st.falhar = true;
    await expect(h.daSelecao(sel)).rejects.toThrow('sem rede');
    st.falhar = false;
    const p = h.daSelecao(sel);
    await esperar();
    expect(st.leituras).toHaveLength(2);
    responder(vinte('antiga'));
    expect(await p).toHaveLength(20);
  });

  it('leitura desligada: recusa em vez de devolver lista vazia (o recálculo zeraria o dia)', async () => {
    const h = useCandidatos({ uid: 'x' }, false, null);
    await expect(h.daSelecao({ id: 's', data: '01/03/2025' })).rejects.toThrow();
    expect(st.leituras).toHaveLength(0);
  });
});
