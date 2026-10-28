import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';

// Projeto, banco e conta de serviço falsos: a rota só conversa com eles e com o Chromos.
vi.mock('./selecoes-do-dia.js', async (original) => ({
  ...(await original<typeof import('./selecoes-do-dia')>()),
  PROJETO: 'projeto-teste',
  BASE: 'https://fs.teste/documents',
  tokenDeAcesso: async () => 'acesso-falso',
}));
import handler, { urlDoQuadro, lerPessoas } from './quadro-infra';

/* Casos Q do revisor de segurança (28/10/2026). */
const PROJ = 'projeto-teste';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
function token(corpo: Record<string, unknown>, cab: Record<string, unknown> = { alg: 'RS256', kid: 'k1' }) {
  const c = `${b64(cab)}.${b64(corpo)}`;
  return `${c}.${crypto.createSign('RSA-SHA256').update(c).sign(privateKey, 'base64url')}`;
}
const sessao = (email: string, extra: Record<string, unknown> = {}) => token({
  aud: PROJ, iss: `https://securetoken.google.com/${PROJ}`, sub: 'u1',
  exp: Math.floor(Date.now() / 1000) + 600, email, email_verified: true, ...extra,
});

const SEGREDO = 'segredo-do-absenteismo-com-32-caracteres-ou-mais';
const PESSOAS = [
  { matricula: '1', nome: 'Ana Colégio', sede: 'DT1', instituicao: 'Christus' },
  { matricula: '2', nome: 'Bia Universidade', sede: 'BEN', instituicao: 'Unichristus' },
];
const usuario = (campos: Record<string, string>) => ({ fields: Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, { stringValue: v }])) });
const USUARIOS: Record<string, unknown> = {
  'admin@x.com': usuario({ role: 'Administrador' }),
  'analista@x.com': usuario({ role: 'Analista', unidade: 'colegio' }),
  'semunidade@x.com': usuario({ role: 'Analista', sede: 'PE' }), // sede na Universidade, sem `unidade`
  'coorduni@x.com': usuario({ role: 'Coordenador', unidade: 'universidade' }),
  'maiuscula@x.com': usuario({ role: 'Analista', unidade: 'Universidade' }),
  'vazia@x.com': usuario({ role: 'Analista', unidade: '' }),
  'viewer@x.com': usuario({ role: 'Visualizador' }),
  'admin-minusculo@x.com': usuario({ role: 'administrador' }),
  'gestor@x.com': usuario({ role: 'Gestor' }),
};

let doChromos: () => Promise<Response>;
let pedidosAoChromos: string[];
const original = globalThis.fetch;
beforeEach(() => {
  vi.stubEnv('CROMOS_ABSENTEISMO_URL', 'https://cromos.teste/api/absenteismo-externo');
  vi.stubEnv('CROMOS_ABSENTEISMO_TOKEN', SEGREDO);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  pedidosAoChromos = [];
  doChromos = async () => Response.json({ pessoas: PESSOAS, geradoEm: 'x' });
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('securetoken@system')) return Response.json({ k1: publicKey });
    if (u.startsWith('https://fs.teste/documents/usuarios/')) {
      const email = decodeURIComponent(u.split('/').pop()!);
      return USUARIOS[email] ? Response.json(USUARIOS[email]) : new Response('', { status: 404 });
    }
    if (u.startsWith('https://cromos.teste/')) {
      pedidosAoChromos.push(`${u} ${(init?.headers as Record<string, string>)?.Authorization}`);
      return doChromos();
    }
    throw new Error(`inesperado: ${u}`);
  }) as typeof fetch;
});
afterEach(() => { globalThis.fetch = original; vi.unstubAllEnvs(); vi.restoreAllMocks(); });

const resposta = () => {
  const r: any = { code: 0, body: null, headers: {} as Record<string, string> };
  r.status = (c: number) => { r.code = c; return r; };
  r.json = (b: unknown) => { r.body = b; return r; };
  r.setHeader = (k: string, v: string) => { r.headers[k.toLowerCase()] = v; return r; };
  return r;
};
const pedir = async (authorization?: string, query: Record<string, string> = {}, method = 'GET') => {
  const r = resposta();
  await handler({ method, headers: authorization ? { authorization } : {}, query }, r);
  return r;
};
const como = (email: string) => pedir(`Bearer ${sessao(email)}`);
const logado = () => vi.mocked(console.error).mock.calls.map(a => a.join(' ')).join('\n');

describe('urlDoQuadro', () => {
  it('Q25 mesma origem do absenteísmo, sem caminho nem query; só https', () => {
    expect(String(urlDoQuadro('https://cromos.teste/api/absenteismo-externo?x=1'))).toBe('https://cromos.teste/api/quadro-externo');
    expect(urlDoQuadro('http://cromos.teste/api/absenteismo-externo')).toBeNull();
    expect(urlDoQuadro('')).toBeNull();
    expect(urlDoQuadro('não é url')).toBeNull();
  });
});

describe('lerPessoas', () => {
  it('Q18/Q20/Q21 só as 4 chaves, instituição desconhecida e tipo errado ficam fora; texto vai como texto', () => {
    const lidas = lerPessoas({ pessoas: [
      { matricula: '1', nome: ' Ana ', sede: 'DT1', instituicao: 'Christus', celular: '8599', admissao: '2020-01-01', id: 'x' },
      { matricula: '2', nome: 'Sem instituição', sede: 'X' },
      { matricula: '3', nome: 'Outra', sede: 'X', instituicao: 'Faculdade' },
      { matricula: null, nome: 'Matrícula nula', sede: 'X', instituicao: 'Christus' },
      { matricula: '4', nome: 123, sede: 'X', instituicao: 'Christus' },
      { matricula: '5', nome: '<img onerror=x>', sede: 'BEN', instituicao: 'Unichristus' },
      null, 'lixo',
    ] }, null);
    expect(lidas).toEqual([
      { matricula: '5', nome: '<img onerror=x>', sede: 'BEN', unidade: 'universidade' },
      { matricula: '1', nome: 'Ana', sede: 'DT1', unidade: 'colegio' },
    ]);
  });
  it('corpo sem a lista estoura (a rota responde 502)', () => {
    expect(() => lerPessoas({}, null)).toThrow();
    expect(() => lerPessoas(null, null)).toThrow();
  });
});

describe('handler — a porta', () => {
  it('Q1 sem segredo, sem URL ou URL http: 503, e o Chromos não é chamado', async () => {
    for (const [url, seg] of [['', SEGREDO], ['https://cromos.teste/x', ''], ['http://cromos.teste/x', SEGREDO]]) {
      vi.stubEnv('CROMOS_ABSENTEISMO_URL', url);
      vi.stubEnv('CROMOS_ABSENTEISMO_TOKEN', seg);
      expect((await como('analista@x.com')).code).toBe(503);
    }
    expect(pedidosAoChromos).toEqual([]);
  });
  it('Q2 sem Authorization, Basic ou Bearer vazio: 401', async () => {
    for (const a of [undefined, 'Basic x', 'Bearer ']) expect((await pedir(a)).code).toBe(401);
  });
  it('Q3–Q7 alg none, assinatura adulterada, vencido, outro projeto, e-mail não confirmado: 401', async () => {
    const [c, , s] = sessao('analista@x.com').split('.');
    const tokens = [
      token({ aud: PROJ }, { alg: 'none', kid: 'k1' }),
      `${c}.${b64({ email: 'admin@x.com' })}.${s}`,
      sessao('analista@x.com', { exp: 1 }),
      sessao('analista@x.com', { aud: 'cromos-79124', iss: 'https://securetoken.google.com/cromos-79124' }),
      sessao('analista@x.com', { email_verified: false }),
    ];
    for (const t of tokens) expect((await pedir(`Bearer ${t}`)).code).toBe(401);
    expect(pedidosAoChromos).toEqual([]);
  });
  it('Q8/Q9/Q10 sem cadastro, Visualizador e papel fora da lista exata: 403, sem chamar o Chromos', async () => {
    for (const email of ['ninguem@x.com', 'viewer@x.com', 'admin-minusculo@x.com', 'gestor@x.com']) {
      expect((await como(email)).code, email).toBe(403);
    }
    expect(pedidosAoChromos).toEqual([]);
  });
  it('Q13 unidade com maiúscula ou vazia: 403 (as Rules não a reconhecem)', async () => {
    expect((await como('maiuscula@x.com')).code).toBe(403);
    expect((await como('vazia@x.com')).code).toBe(403);
  });
  it('Q23 POST: 405', async () => {
    expect((await pedir(`Bearer ${sessao('analista@x.com')}`, {}, 'POST')).code).toBe(405);
  });
});

describe('handler — o que sai', () => {
  it('Q11 Coordenador da Universidade: só a Universidade', async () => {
    const r = await como('coorduni@x.com');
    expect(r.code).toBe(200);
    expect(r.body.pessoas.map((p: any) => p.nome)).toEqual(['Bia Universidade']);
  });
  it('Q12 Analista sem `unidade`, com sede na Universidade: só o Colégio, como as Rules', async () => {
    expect((await como('semunidade@x.com')).body.pessoas.map((p: any) => p.nome)).toEqual(['Ana Colégio']);
  });
  it('Q14 Administrador: as duas unidades', async () => {
    expect((await como('admin@x.com')).body.pessoas).toHaveLength(2);
  });
  it('Q15 query não muda nada; o pedido ao Chromos vai à origem, com o segredo, sem query', async () => {
    const r = await pedir(`Bearer ${sessao('analista@x.com')}`, { unidade: 'universidade', instituicao: 'Unichristus', sede: 'BEN' });
    expect(r.body.pessoas.map((p: any) => p.nome)).toEqual(['Ana Colégio']);
    expect(pedidosAoChromos).toEqual([`https://cromos.teste/api/quadro-externo Bearer ${SEGREDO}`]);
  });
  it('Q16/Q17 Chromos com 500, HTML, sem lista ou que não responde: 502, sem repassar o corpo nem nomes ao log', async () => {
    const respostas: (() => Promise<Response>)[] = [
      async () => new Response('Ana Colégio em projects/x', { status: 500 }),
      async () => new Response('<html>Ana Colégio</html>', { status: 200 }),
      async () => Response.json({ erro: 'x' }),
      async () => { throw new DOMException('prazo', 'TimeoutError'); },
    ];
    for (const r of respostas) {
      doChromos = r;
      const out = await como('analista@x.com');
      expect(out.code).toBe(502);
      expect(JSON.stringify(out.body)).not.toContain('Ana');
    }
    expect(logado()).not.toContain('Ana');
    expect(logado()).not.toContain(SEGREDO);
  });
  it('Q22 sempre no-store (também no erro)', async () => {
    expect((await como('analista@x.com')).headers['cache-control']).toBe('no-store');
    expect((await pedir()).headers['cache-control']).toBe('no-store');
  });
});
