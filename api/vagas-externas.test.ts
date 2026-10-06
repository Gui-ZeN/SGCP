import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('./selecoes-do-dia', async (original) => ({
  ...(await original<typeof import('./selecoes-do-dia')>()),
  tokenDeAcesso: async () => 'acesso-falso',
}));
import handler, { validarPedido, MOTIVO } from './vagas-externas';

const CAT = {
  cargos: ['ASG', 'TME'],
  setores: ['Infraestrutura'],
  sedes: [{ nome: 'DIONISIO TORRES', sigla: 'DT' }, { nome: 'SUL', sigla: 'SUL 1' }, { nome: 'PRE SUL', sigla: 'PSUL' }],
};
const pedido = (extra: Record<string, unknown> = {}) => ({
  versao: 1,
  origem: { sistema: 'Chromos', caso: 'm77_2026-09-01' },
  cargo: 'asg', sede: 'DT', setor: 'Infraestrutura',
  motivo: 'Substituição — abandono de emprego',
  substituido: { nome: 'Fulano de Tal', matricula: '77' },
  descricao: 'Limpeza do 2º andar e banheiros.',
  solicitante: { email: 'coord@christus.com.br', nome: 'Coordenação Infra' },
  ...extra,
});
const AGORA = new Date('2026-10-06T02:00:00Z'); // 23h de 05/10 em Fortaleza

describe('validarPedido', () => {
  it('monta a vaga como o formulário: ABERTA, triagem, RH, sede pelo NOME, cargo do catálogo', () => {
    const r = validarPedido(pedido(), CAT, AGORA);
    if ('erro' in r) throw new Error(r.erro);
    expect(r.docId).toBe('chromos_m77_2026-09-01');
    expect(r.campos).toMatchObject({
      vaga: 'ASG', sede: 'DIONISIO TORRES', setor: 'Infraestrutura', status: 'ABERTA', etapa: 'Triagem de currículos',
      responsavel: 'RH', motivo: MOTIVO, categoriaMotivo: 'Substituição', solicitante: 'Coordenação Infra',
      funcionarioSubstituido: 'Fulano de Tal (matrícula 77)', origem: 'chromos',
      solicitacao: '05/10/2026', mesSolicitacao: 'Out', ano: 2026, etapaDesde: '2026-10-05',
    });
    expect(String(r.campos.observacoes)).toContain('abandono de emprego');
    expect(String(r.campos.observacoes)).toContain('Limpeza do 2º andar');
  });

  it('sede por sigla ou nome, com ou sem acento/hífen', () => {
    for (const sede of ['SUL 1', 'sul', 'Pré-Sul', 'PSUL']) {
      const r = validarPedido(pedido({ sede }), CAT, AGORA);
      expect('erro' in r ? r.erro : r.campos.sede).toMatch(/^(SUL|PRE SUL)$/);
    }
  });

  it('400 com frase para gente: cargo, sede, setor, versão, sistema, caso e campos obrigatórios', () => {
    const erro = (p: any) => { const r = validarPedido(p, CAT, AGORA); return 'erro' in r ? r.erro : ''; };
    expect(erro(pedido({ cargo: 'Astronauta' }))).toMatch(/Cargo "Astronauta"/);
    expect(erro(pedido({ sede: 'Marte' }))).toMatch(/Sede "Marte"/);
    expect(erro(pedido({ setor: 'Lua' }))).toMatch(/Setor/);
    expect(erro(pedido({ versao: 2 }))).toMatch(/Versão/);
    expect(erro(pedido({ origem: { sistema: 'Outro', caso: 'x' } }))).toMatch(/origem/);
    expect(erro(pedido({ origem: { sistema: 'Chromos', caso: '../vagas/x' } }))).toMatch(/origem.caso/);
    expect(erro(pedido({ solicitante: {} }))).toMatch(/solicitante/);
    expect(erro(pedido({ substituido: {} }))).toMatch(/substituido/);
    expect(erro(null)).toMatch(/JSON/);
  });
});

describe('handler', () => {
  const resposta = () => {
    const r: any = { code: 0, body: null };
    r.status = (c: number) => { r.code = c; return r; };
    r.json = (b: unknown) => { r.body = b; return r; };
    return r;
  };
  const doc = (campos: Record<string, string>) => ({ fields: Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, { stringValue: v }])) });
  const original = globalThis.fetch;
  let banco: Record<string, any>;
  let criarFalha = false;

  beforeEach(() => {
    vi.stubEnv('SGPC_VAGAS_TOKEN', 'segredo');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    banco = {};
    criarFalha = false;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const u = String(url), metodo = init?.method || 'GET';
      if (u.endsWith('/cargos?pageSize=300')) return Response.json({ documents: CAT.cargos.map(nome => doc({ nome })) });
      if (u.endsWith('/setores?pageSize=300')) return Response.json({ documents: CAT.setores.map(nome => doc({ nome })) });
      if (u.endsWith('/sedes?pageSize=300')) return Response.json({ documents: CAT.sedes.map(s => doc(s as any)) });
      if (u.endsWith(':runQuery')) return Response.json([{ document: { fields: { codigo: { integerValue: '2147180526' } } } }]);
      if (u.endsWith('/logs')) return Response.json({});
      const m = /\/vagas\/([^?]+)(\?.*)?$/.exec(u);
      if (m && metodo === 'GET') return banco[m[1]] ? Response.json(banco[m[1]]) : new Response('', { status: 404 });
      if (m && metodo === 'PATCH') {
        if (criarFalha) { banco[m[1]] = { fields: { codigo: { integerValue: '999' } } }; return new Response('existe', { status: 409 }); }
        banco[m[1]] = JSON.parse(String(init?.body));
        return Response.json(banco[m[1]]);
      }
      throw new Error(`inesperado: ${metodo} ${u}`);
    }) as unknown as typeof fetch;
  });
  afterEach(() => { globalThis.fetch = original; vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  const enviar = async (corpo: unknown, token = 'segredo', method = 'POST') => {
    const r = resposta();
    await handler({ method, headers: { authorization: `Bearer ${token}` }, body: corpo }, r);
    return r;
  };

  it('sem a variável: 503; token errado: 401; GET: 405', async () => {
    expect((await enviar(pedido(), 'errado')).code).toBe(401);
    expect((await enviar(pedido(), 'segredo', 'GET')).code).toBe(405);
    vi.stubEnv('SGPC_VAGAS_TOKEN', '');
    expect((await enviar(pedido())).code).toBe(503);
  });

  it('cria com código = maior + 1 (201) e o mesmo caso de novo devolve a mesma (200)', async () => {
    const a = await enviar(pedido());
    expect(a.code).toBe(201);
    expect(a.body).toEqual({ id: 'chromos_m77_2026-09-01', codigo: '2147180527' });
    expect(banco['chromos_m77_2026-09-01'].fields.status.stringValue).toBe('ABERTA');
    const b = await enviar(pedido());
    expect(b.code).toBe(200);
    expect(b.body).toEqual(a.body);
  });

  it('dois envios simultâneos: quem perde a corrida recebe a vaga que ganhou (200)', async () => {
    criarFalha = true;
    const r = await enviar(pedido());
    expect(r.code).toBe(200);
    expect(r.body).toEqual({ id: 'chromos_m77_2026-09-01', codigo: '999' });
  });

  it('400 com a frase quando a sede não existe', async () => {
    const r = await enviar(pedido({ sede: 'Marte' }));
    expect(r.code).toBe(400);
    expect(r.body.erro).toMatch(/Sede "Marte"/);
  });

  it('aceita o corpo como texto JSON', async () => {
    expect((await enviar(JSON.stringify(pedido()))).code).toBe(201);
  });
});
