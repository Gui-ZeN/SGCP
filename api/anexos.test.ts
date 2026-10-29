import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';

// Firestore e conta de serviço falsos, como em quadro-infra.test.ts.
vi.mock('./selecoes-do-dia.js', async (original) => ({
  ...(await original<typeof import('./selecoes-do-dia')>()),
  PROJETO: 'projeto-teste',
  BASE: 'https://fs.teste/documents',
  tokenDeAcesso: async () => 'acesso-falso',
}));
import handler, { nomeLimpo, disposicao, esquecerToken, esquecerPastas, PEDACO, MAX_ANEXOS } from './anexos';

/* Casos de ataque do revisor de segurança (29/10/2026), numerados como lá. */
const PROJ = 'projeto-teste';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(corpo: Record<string, unknown>) {
  const c = `${b64({ alg: 'RS256', kid: 'k1' })}.${b64(corpo)}`;
  return `${c}.${crypto.createSign('RSA-SHA256').update(c).sign(privateKey, 'base64url')}`;
}
const sessao = (email: string) => `Bearer ${jwt({ aud: PROJ, iss: `https://securetoken.google.com/${PROJ}`, sub: 'u', exp: Math.floor(Date.now() / 1000) + 600, email, email_verified: true })}`;
const doc = (campos: Record<string, string>) => ({ fields: Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, { stringValue: v }])) });
const USUARIOS: Record<string, unknown> = {
  'admin@x.com': doc({ role: 'Administrador' }),
  'col@x.com': doc({ role: 'Analista', unidade: 'colegio' }),
  'uni@x.com': doc({ role: 'Coordenador', unidade: 'universidade' }),
  'viewer@x.com': doc({ role: 'Visualizador', unidade: 'colegio' }),
};
let TURMAS: Record<string, unknown>;

// ── Drive falso ──────────────────────────────────────────────────────────────
const PASTA_COL = 'pastaColegio123', PASTA_UNI = 'pastaUniversid1';
let colaborador = false;
/** Apagado de um jeito ou de outro: na lixeira, ou esvaziado e sem as marcas (conta colaboradora). */
const apagado = (id: string) => { const f = arquivos.get(id)!; return f.trashed || (f.appProperties.confirmado === 'apagado' && !f.appProperties.treinamentoId && f.bytes.length === 0); };
interface F { name?: string; id: string; mimeType: string; size?: string; parents: string[]; trashed: boolean; createdTime: string; appProperties: Record<string, string>; bytes: Buffer }
let arquivos: Map<string, F>;
let sessoes: Map<string, Omit<F, 'id' | 'bytes' | 'size' | 'trashed' | 'createdTime'> & { origem: string }>;
let seq = 0;
const novoId = () => `arq${String(++seq).padStart(8, '0')}x`;
function lerQ(q: string) {
  const m = /key='(\w+)' and value='([^']*)'/.exec(q)!;
  return (f: F) => !f.trashed && f.appProperties[m[1]] === m[2];
}
const original = globalThis.fetch;
let chamadas: string[];

beforeEach(() => {
  esquecerToken(); esquecerPastas();
  vi.stubEnv('GCP_WIF_AUDIENCE', '//iam.googleapis.com/projects/1/locations/global/workloadIdentityPools/p/providers/v');
  vi.stubEnv('DRIVE_SA_EMAIL', 'sgpc-anexos@p.iam.gserviceaccount.com');
  vi.stubEnv('DRIVE_PASTA_COLEGIO', PASTA_COL);
  vi.stubEnv('DRIVE_PASTA_UNIVERSIDADE', PASTA_UNI);
  vi.stubEnv('APP_ORIGEM', 'https://sgpc.teste');
  vi.stubEnv('CRON_SECRET', 'segredo-do-cron');
  vi.stubEnv('VERCEL_OIDC_TOKEN', 'oidc-falso');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  TURMAS = { tCol: doc({ escopo: 'colegio' }), tUni: doc({ escopo: 'universidade' }), tSem: doc({ tema: 'x' }) };
  chamadas = [];
  arquivos = new Map();
  const pasta = (id: string, unidade: string): F => ({ id, mimeType: 'application/vnd.google-apps.folder', parents: [], trashed: false, createdTime: '2026-01-01T00:00:00Z', appProperties: { sgpcPasta: unidade }, bytes: Buffer.alloc(0) });
  arquivos.set(PASTA_COL, pasta(PASTA_COL, 'colegio'));
  arquivos.set(PASTA_UNI, pasta(PASTA_UNI, 'universidade'));
  sessoes = new Map();
  globalThis.fetch = (async (url: string | URL, init: RequestInit = {}) => {
    const u = new URL(String(url));
    const h = (init.headers || {}) as Record<string, string>;
    chamadas.push(`${init.method || 'GET'} ${u.origin}${u.pathname}`);
    if (u.href.includes('securetoken@system')) return Response.json({ k1: publicKey });
    if (u.href.startsWith('https://fs.teste/documents/usuarios/')) {
      const e = decodeURIComponent(u.pathname.split('/').pop()!);
      return USUARIOS[e] ? Response.json(USUARIOS[e]) : new Response('', { status: 404 });
    }
    if (u.href.startsWith('https://fs.teste/documents/treinamentos/')) {
      const t = decodeURIComponent(u.pathname.split('/').pop()!);
      return TURMAS[t] ? Response.json(TURMAS[t]) : new Response('', { status: 404 });
    }
    if (u.hostname === 'sts.googleapis.com') return Response.json({ access_token: 'federado' });
    if (u.hostname === 'iamcredentials.googleapis.com') {
      expect(JSON.parse(String(init.body)).scope).toEqual(['https://www.googleapis.com/auth/drive.file']);
      return Response.json({ accessToken: 'drive-token' });
    }
    expect(h.Authorization).toBe('Bearer drive-token');
    if (u.pathname === '/upload/drive/v3/files') {
      const meta = JSON.parse(String(init.body));
      const id = `s${sessoes.size}`;
      sessoes.set(id, { mimeType: meta.mimeType, parents: meta.parents, appProperties: meta.appProperties, origem: h.Origin });
      return new Response('', { headers: { location: `https://www.googleapis.com/upload/drive/v3/files?upload_id=${id}` } });
    }
    if (u.pathname === '/drive/v3/files') {
      const filtro = lerQ(u.searchParams.get('q')!);
      return Response.json({ files: [...arquivos.values()].filter(filtro).map(({ bytes, ...f }) => f) });
    }
    const id = decodeURIComponent(u.pathname.split('/').pop()!);
    const f = arquivos.get(id);
    if (!f) return new Response('', { status: 404 });
    if (init.method === 'PATCH' && u.pathname.startsWith('/upload/')) { f.bytes = Buffer.alloc(0); f.size = '0'; return Response.json({ id }); }
    if (init.method === 'PATCH') {
      const corpo = JSON.parse(String(init.body));
      // Colaboradora num Drive compartilhado: não apaga nem move (o Drive do RH, 30/10/2026).
      if (colaborador && (corpo.trashed || u.searchParams.get('addParents'))) return new Response('', { status: 403 });
      if (corpo.trashed) f.trashed = true;
      if (corpo.name) f.name = corpo.name;
      for (const [k, v] of Object.entries(corpo.appProperties || {})) { if (v === null) delete f.appProperties[k]; else f.appProperties[k] = v as string; }
      if (u.searchParams.get('addParents')) f.parents = [u.searchParams.get('addParents')!];
      return Response.json({ id });
    }
    if (u.searchParams.get('alt') === 'media') {
      const [, de, ate] = /bytes=(\d+)-(\d+)/.exec(h.Range)!;
      return new Response(f.bytes.subarray(Number(de), Number(ate) + 1));
    }
    const { bytes, ...meta } = f;
    return Response.json(meta);
  }) as typeof fetch;
});
afterEach(() => { globalThis.fetch = original; vi.unstubAllEnvs(); vi.restoreAllMocks(); });

const resposta = () => {
  const r: any = { code: 0, body: null as any, headers: {} as Record<string, string> };
  r.status = (c: number) => { r.code = c; return r; };
  r.json = (b: unknown) => { r.body = b; return r; };
  r.end = (b: Buffer) => { r.body = b; return r; };
  r.setHeader = (k: string, v: string) => { r.headers[k.toLowerCase()] = v; return r; };
  return r;
};
const pedir = async (quem: string | undefined, method: string, query: Record<string, string>, body?: unknown) => {
  const res = resposta();
  await handler({ method, query, body, headers: quem ? { authorization: quem.includes('@') ? sessao(quem) : quem } : {} }, res);
  return res;
};

const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(400)]);
const PDF = (n = 500) => Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(n)]);
/** O navegador manda o arquivo para a sessão: o Drive cria o arquivo com o que veio (sem conferir o conteúdo). */
function enviarNaSessao(url: string, bytes: Buffer, criado = new Date().toISOString()) {
  const s = sessoes.get(new URL(url).searchParams.get('upload_id')!)!;
  const id = novoId();
  arquivos.set(id, { id, mimeType: s.mimeType, parents: s.parents, appProperties: { ...s.appProperties }, trashed: false, createdTime: criado, size: String(bytes.length), bytes });
  return id;
}
async function anexar(quem: string, turma: string, bytes: Buffer, tipo = 'image/jpeg', nome = 'foto.jpg') {
  const i = await pedir(quem, 'POST', { acao: 'iniciar' }, { treinamentoId: turma, nome, tipo, tamanho: bytes.length });
  expect(i.code).toBe(200);
  const id = enviarNaSessao(i.body.sessao, bytes);
  return { id, c: await pedir(quem, 'POST', { acao: 'confirmar' }, { treinamentoId: turma, arquivo: id }) };
}

// A suíte inteira roda com a conta como Gerente de conteúdo (lixeira de verdade) e
// como Colaboradora (o Drive do RH, 30/10/2026: esvazia e desmarca, não move).
for (const modo of [false, true]) describe(modo ? 'conta colaboradora' : 'conta gerente de conteúdo', () => {
beforeEach(() => { colaborador = modo; });

describe('caminho normal (15)', () => {
  it('RH da unidade: inicia, envia, confirma, lista, baixa e apaga', async () => {
    const { id, c } = await anexar('col@x.com', 'tCol', JPG);
    expect(c.code).toBe(200);
    expect(arquivos.get(id)!.parents).toEqual([PASTA_COL]);
    const l = await pedir('col@x.com', 'GET', { acao: 'listar', treinamento: 'tCol' });
    expect(l.body.anexos).toEqual([expect.objectContaining({ id, nome: 'foto.jpg', tipo: 'image/jpeg', tamanho: JPG.length })]);
    const b = await pedir('col@x.com', 'GET', { acao: 'baixar', treinamento: 'tCol', arquivo: id });
    expect(Buffer.compare(b.body, JPG)).toBe(0);
    const a = await pedir('col@x.com', 'DELETE', { acao: 'apagar', treinamento: 'tCol', arquivo: id });
    expect(a.body).toEqual({ apagados: 1 });
    expect(apagado(id)).toBe(true);
  });
  it('Administrador nas duas unidades (14)', async () => {
    expect((await anexar('admin@x.com', 'tCol', JPG)).c.code).toBe(200);
    expect((await anexar('admin@x.com', 'tUni', JPG)).c.code).toBe(200);
  });
});

describe('identidade e papel (1, 6)', () => {
  it.each([
    ['iniciar', 'POST'], ['confirmar', 'POST'], ['listar', 'GET'], ['baixar', 'GET'], ['apagar', 'DELETE'],
  ])('%s: sem token 401, Visualizador 403', async (acao, metodo) => {
    expect((await pedir(undefined, metodo, { acao, treinamento: 'tCol' }, { treinamentoId: 'tCol' })).code).toBe(401);
    expect((await pedir('Basic xyz', metodo, { acao, treinamento: 'tCol' }, { treinamentoId: 'tCol' })).code).toBe(401);
    expect((await pedir('viewer@x.com', metodo, { acao, treinamento: 'tCol' }, { treinamentoId: 'tCol' })).code).toBe(403);
  });
  it('método errado ou ação desconhecida: 405 (46)', async () => {
    expect((await pedir('col@x.com', 'GET', { acao: 'iniciar' })).code).toBe(405);
    expect((await pedir('col@x.com', 'PUT', { acao: 'apagar' })).code).toBe(405);
    expect((await pedir('col@x.com', 'GET', {})).code).toBe(405);
  });
});

describe('escopo por unidade (10–13)', () => {
  it('RH do Colégio na turma da Universidade: 403', async () => {
    const r = await pedir('col@x.com', 'POST', { acao: 'iniciar' }, { treinamentoId: 'tUni', nome: 'a', tipo: 'image/jpeg', tamanho: 10 });
    expect(r.code).toBe(403);
    expect(sessoes.size).toBe(0);
  });
  it('escopo/pasta do pedido são ignorados: vale a turma (11)', async () => {
    const r = await pedir('uni@x.com', 'POST', { acao: 'iniciar' }, { treinamentoId: 'tUni', nome: 'a', tipo: 'image/jpeg', tamanho: 10, escopo: 'colegio', pasta: PASTA_COL });
    expect(r.code).toBe(200);
    expect([...sessoes.values()][0]).toMatchObject({ parents: [PASTA_UNI], appProperties: { escopo: 'universidade' } });
  });
  it('turma inexistente 404, sem unidade 409, id malformado 400', async () => {
    const corpo = (t: unknown) => ({ treinamentoId: t, nome: 'a', tipo: 'image/jpeg', tamanho: 10 });
    expect((await pedir('admin@x.com', 'POST', { acao: 'iniciar' }, corpo('nao-existe'))).code).toBe(404);
    expect((await pedir('admin@x.com', 'POST', { acao: 'iniciar' }, corpo('tSem'))).code).toBe(409);
    for (const t of ['../x', 'a/b', '%2F', 'x'.repeat(200), 12, ['tCol']]) {
      expect((await pedir('admin@x.com', 'POST', { acao: 'iniciar' }, corpo(t))).code).toBe(400);
    }
  });
});

describe('conteúdo (16–24)', () => {
  it('tipo fora da lista exata: 400 sem abrir sessão', async () => {
    for (const tipo of ['image/svg+xml', 'text/html', 'image/gif', 'IMAGE/JPEG', 'image/jpeg; charset=x', '', undefined]) {
      expect((await pedir('col@x.com', 'POST', { acao: 'iniciar' }, { treinamentoId: 'tCol', nome: 'a', tipo, tamanho: 10 })).code).toBe(400);
    }
    expect(sessoes.size).toBe(0);
  });
  it('tamanho inválido ou acima do teto: 400 (23)', async () => {
    for (const [tipo, tamanho] of [['image/jpeg', 3 * 1024 * 1024 + 1], ['application/pdf', 10 * 1024 * 1024 + 1], ['image/png', 0], ['image/png', -1], ['image/png', '10'], ['image/png', 1.5], ['image/png', NaN]]) {
      expect((await pedir('col@x.com', 'POST', { acao: 'iniciar' }, { treinamentoId: 'tCol', nome: 'a', tipo, tamanho })).code).toBe(400);
    }
  });
  it('HTML disfarçado de JPEG, SVG como PNG, PNG declarado PDF: 422 e lixeira (17, 18, 21)', async () => {
    const casos: [Buffer, string][] = [
      [Buffer.from('<html><script>alert(1)</script></html>'), 'image/jpeg'],
      [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/png'],
      [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]), 'application/pdf'],
    ];
    for (const [bytes, tipo] of casos) {
      const { id, c } = await anexar('col@x.com', 'tCol', bytes, tipo);
      expect(c.code).toBe(422);
      expect(apagado(id)).toBe(true);
    }
    expect((await pedir('col@x.com', 'GET', { acao: 'listar', treinamento: 'tCol' })).body.anexos).toEqual([]);
  });
  it('tamanho mentido na sessão: o real acima do teto vai para a lixeira (22)', async () => {
    const i = await pedir('col@x.com', 'POST', { acao: 'iniciar' }, { treinamentoId: 'tCol', nome: 'a', tipo: 'image/jpeg', tamanho: 300 });
    const id = enviarNaSessao(i.body.sessao, Buffer.concat([JPG, Buffer.alloc(3 * 1024 * 1024)]));
    expect((await pedir('col@x.com', 'POST', { acao: 'confirmar' }, { treinamentoId: 'tCol', arquivo: id })).code).toBe(422);
    expect(apagado(id)).toBe(true);
  });
  it('JPEG poliglota é aceito, mas a entrega não deixa rodar nada (19, 33)', async () => {
    const { id } = await anexar('col@x.com', 'tCol', Buffer.concat([JPG, Buffer.from('<script>x</script>')]));
    const b = await pedir('col@x.com', 'GET', { acao: 'baixar', treinamento: 'tCol', arquivo: id });
    expect(b.headers).toMatchObject({
      'content-type': 'image/jpeg', 'x-content-type-options': 'nosniff',
      'content-security-policy': "sandbox; default-src 'none'", 'cache-control': 'private, no-store',
    });
    expect(b.headers['content-disposition']).toMatch(/^inline;/);
  });
});

describe('confirmar e baixar o arquivo certo (25–32)', () => {
  it('arquivo criado para outra turma: 404 ao confirmar e ao baixar', async () => {
    const { id } = await anexar('admin@x.com', 'tUni', JPG);
    expect((await pedir('admin@x.com', 'POST', { acao: 'confirmar' }, { treinamentoId: 'tCol', arquivo: id })).code).toBe(404);
    expect((await pedir('admin@x.com', 'GET', { acao: 'baixar', treinamento: 'tCol', arquivo: id })).code).toBe(404);
  });
  it('id que a conta não criou (sem as marcas) ou malformado: 404 / 400 (27, 29, 30)', async () => {
    expect((await pedir('col@x.com', 'GET', { acao: 'baixar', treinamento: 'tCol', arquivo: PASTA_COL })).code).toBe(404);
    for (const a of ['abc?alt=media', '../about', 'x&fields=*', 'curto']) {
      expect((await pedir('col@x.com', 'GET', { acao: 'baixar', treinamento: 'tCol', arquivo: a })).code).toBe(400);
    }
  });
  it('não confirmado não aparece nem baixa; confirmar de novo é idempotente (28, 32)', async () => {
    const i = await pedir('col@x.com', 'POST', { acao: 'iniciar' }, { treinamentoId: 'tCol', nome: 'a', tipo: 'image/jpeg', tamanho: JPG.length });
    const id = enviarNaSessao(i.body.sessao, JPG);
    expect((await pedir('col@x.com', 'GET', { acao: 'baixar', treinamento: 'tCol', arquivo: id })).code).toBe(404);
    expect((await pedir('col@x.com', 'POST', { acao: 'confirmar' }, { treinamentoId: 'tCol', arquivo: id })).code).toBe(200);
    expect((await pedir('col@x.com', 'POST', { acao: 'confirmar' }, { treinamentoId: 'tCol', arquivo: id })).code).toBe(200);
  });
  it('PDF de 9 MB sai em pedaços abaixo do teto da Vercel', async () => {
    const pdf = PDF(9 * 1024 * 1024);
    const { id, c } = await anexar('col@x.com', 'tCol', pdf, 'application/pdf', 'lista.pdf');
    expect(c.code).toBe(200);
    const partes: Buffer[] = [];
    for (let p = 0; p < 3; p++) {
      const r = await pedir('col@x.com', 'GET', { acao: 'baixar', treinamento: 'tCol', arquivo: id, parte: String(p) });
      expect(r.headers['x-partes']).toBe('3');
      expect(r.body.length).toBeLessThanOrEqual(PEDACO);
      partes.push(r.body);
    }
    expect(Buffer.compare(Buffer.concat(partes), pdf)).toBe(0);
    expect((await pedir('col@x.com', 'GET', { acao: 'baixar', treinamento: 'tCol', arquivo: id, parte: '3' })).code).toBe(400);
    const r = await pedir('col@x.com', 'GET', { acao: 'baixar', treinamento: 'tCol', arquivo: id });
    expect(r.headers['content-disposition']).toMatch(/^attachment;/);
  });
});

describe('apagar (35, 36)', () => {
  it('RH de outra unidade não apaga; todos=1 apaga os da turma', async () => {
    const a = await anexar('col@x.com', 'tCol', JPG), b = await anexar('col@x.com', 'tCol', JPG);
    expect((await pedir('uni@x.com', 'DELETE', { acao: 'apagar', treinamento: 'tCol', arquivo: a.id })).code).toBe(403);
    expect((await pedir('uni@x.com', 'DELETE', { acao: 'apagar', treinamento: 'tUni', arquivo: a.id })).code).toBe(404);
    expect(apagado(a.id)).toBe(false);
    expect((await pedir('col@x.com', 'DELETE', { acao: 'apagar', treinamento: 'tCol', todos: '1' })).body).toEqual({ apagados: 2 });
    expect([a.id, b.id].every(id => apagado(id))).toBe(true);
    // Colaboradora: a foto some de fato (0 bytes) e o arquivo fica com nome de apagado, sem a turma.
    if (colaborador) expect(arquivos.get(a.id)!).toMatchObject({ trashed: false, name: `APAGADO-${a.id}`, size: '0' });
    expect((await pedir('col@x.com', 'GET', { acao: 'listar', treinamento: 'tCol' })).body.anexos).toEqual([]);
    expect((await pedir('col@x.com', 'GET', { acao: 'baixar', treinamento: 'tCol', arquivo: a.id })).code).toBe(404);
  });
});

describe('teto de 10 (39)', () => {
  it('cheio: iniciar recusa; na corrida, só os 10 primeiros ficam', async () => {
    for (let i = 0; i < MAX_ANEXOS - 1; i++) await anexar('col@x.com', 'tCol', JPG);
    // Três sessões abertas antes de qualquer confirmação (passaram pelo teto juntas).
    const ids = [];
    for (let i = 0; i < 3; i++) {
      const s = await pedir('col@x.com', 'POST', { acao: 'iniciar' }, { treinamentoId: 'tCol', nome: 'a', tipo: 'image/jpeg', tamanho: JPG.length });
      ids.push(enviarNaSessao(s.body.sessao, JPG));
    }
    const r = await Promise.all(ids.map(id => pedir('col@x.com', 'POST', { acao: 'confirmar' }, { treinamentoId: 'tCol', arquivo: id })));
    expect(r.map(x => x.code).sort()).toEqual([200, 409, 409]);
    expect((await pedir('col@x.com', 'GET', { acao: 'listar', treinamento: 'tCol' })).body.anexos).toHaveLength(MAX_ANEXOS);
    expect((await pedir('col@x.com', 'POST', { acao: 'iniciar' }, { treinamentoId: 'tCol', nome: 'a', tipo: 'image/jpeg', tamanho: 10 })).code).toBe(409);
  });
});

describe('nome, origem, log (41–48)', () => {
  it('nome sem caminho, controle nem inversão; no Drive o nome é gerado', async () => {
    expect(nomeLimpo('../../Colegio/x.pdf')).toBe('x.pdf');
    expect(nomeLimpo('C:\\a\\b.jpg')).toBe('b.jpg');
    expect(nomeLimpo('a\r\nSet-Cookie: x.pdf')).toBe('aSet-Cookie: x.pdf');
    expect(nomeLimpo('foto\u202Egpj.exe')).toBe('fotogpj.exe');
    expect(Buffer.byteLength(nomeLimpo('ç'.repeat(300)))).toBeLessThanOrEqual(100);
    expect(nomeLimpo('')).toBe('arquivo');
    // Corte na fronteira de um emoji: nada de meio par UTF-16, e o cabeçalho de download não quebra.
    const n = nomeLimpo('a'.repeat(97) + '😀bb');
    expect(n).not.toMatch(/[\uD800-\uDFFF]$/);
    expect(() => disposicao('inline', n)).not.toThrow();
    expect(disposicao('attachment', 'ação "x".pdf')).toBe(`attachment; filename="acao x.pdf"; filename*=UTF-8''a%C3%A7%C3%A3o%20%22x%22.pdf`);
  });
  it('a sessão é aberta com a origem fixa do app, nunca a do pedido (44)', async () => {
    await pedir('col@x.com', 'POST', { acao: 'iniciar' }, { treinamentoId: 'tCol', nome: 'a', tipo: 'image/jpeg', tamanho: 10, url: 'https://evil.example', origem: 'https://evil.example' });
    expect([...sessoes.values()][0].origem).toBe('https://sgpc.teste');
    expect(chamadas.some(c => c.includes('evil'))).toBe(false);
  });
  it('o log não leva nome de arquivo, e-mail nem a URL da sessão (48)', async () => {
    const erro = vi.mocked(console.error);
    const falso = globalThis.fetch;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      if (String(url).startsWith('https://www.googleapis.com/drive/')) throw new Error('falha com foto-da-maria.jpg e col@x.com upload_id=1');
      return falso(url, init);
    }) as typeof fetch;
    expect((await pedir('col@x.com', 'GET', { acao: 'listar', treinamento: 'tCol' })).code).toBe(502);
    expect(erro).toHaveBeenCalled();
    const log = JSON.stringify(erro.mock.calls);
    expect(log).not.toMatch(/maria|col@x|upload_id/);
  });
});

describe('configuração fechada (49)', () => {
  it.each([
    ['sem federação', { GCP_WIF_AUDIENCE: '' }],
    ['sem pasta', { DRIVE_PASTA_UNIVERSIDADE: '' }],
    ['pastas iguais', { DRIVE_PASTA_UNIVERSIDADE: PASTA_COL }],
    ['pastas trocadas', { DRIVE_PASTA_COLEGIO: PASTA_UNI, DRIVE_PASTA_UNIVERSIDADE: PASTA_COL }],
    ['sem origem', { APP_ORIGEM: '' }],
  ])('%s: 503 sem abrir sessão', async (_, env) => {
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    const r = await pedir('col@x.com', 'POST', { acao: 'iniciar' }, { treinamentoId: 'tCol', nome: 'a', tipo: 'image/jpeg', tamanho: 10 });
    expect(r.code).toBe(503);
    expect(sessoes.size).toBe(0);
  });
});

describe('varredura (37, 38)', () => {
  it('pelo endereço próprio do cron (sem depender da query no path)', async () => {
    const { default: cron } = await import('./anexos-varrer');
    const res = resposta();
    await cron({ method: 'GET', query: {}, headers: { authorization: 'Bearer segredo-do-cron' } }, res);
    expect(res.code).toBe(200);
    expect(res.body).toEqual({ lixeira: 0, movidos: 0 });
  });
  it('11º confirmado (busca do Drive atrasada) vai para a lixeira', async () => {
    const ids: string[] = [];
    for (let i = 0; i < MAX_ANEXOS + 1; i++) {
      const s = await pedir('col@x.com', 'POST', { acao: 'iniciar' }, { treinamentoId: 'tCol', nome: 'a', tipo: 'image/jpeg', tamanho: JPG.length });
      ids.push(enviarNaSessao(s.body.sessao, JPG, new Date(Date.now() + i * 1000).toISOString()));
    }
    for (const id of ids) arquivos.get(id)!.appProperties.confirmado = 'sim'; // como se as confirmações não se enxergassem
    expect((await pedir('Bearer segredo-do-cron', 'GET', { acao: 'varrer' })).body).toEqual({ lixeira: 1, movidos: 0 });
    expect(apagado(ids[MAX_ANEXOS])).toBe(true);
    expect(ids.slice(0, MAX_ANEXOS).some(id => apagado(id))).toBe(false);
  });
  it('só com o CRON_SECRET', async () => {
    expect((await pedir('Bearer errado', 'GET', { acao: 'varrer' })).code).toBe(401);
    expect((await pedir(undefined, 'GET', { acao: 'varrer' })).code).toBe(401);
  });
  it('lixeira: sessão nunca confirmada há mais de 24 h e turma apagada; muda de pasta a turma que trocou de unidade', async () => {
    const velho = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
    const s = await pedir('col@x.com', 'POST', { acao: 'iniciar' }, { treinamentoId: 'tCol', nome: 'a', tipo: 'image/jpeg', tamanho: 10 });
    const pendente = enviarNaSessao(s.body.sessao, JPG, velho);
    const s2 = await pedir('col@x.com', 'POST', { acao: 'iniciar' }, { treinamentoId: 'tCol', nome: 'a', tipo: 'image/jpeg', tamanho: 10 });
    const recente = enviarNaSessao(s2.body.sessao, JPG);
    TURMAS.tApagada = doc({ escopo: 'colegio' });
    const orfao = (await anexar('col@x.com', 'tApagada', JPG)).id;
    delete TURMAS.tApagada;
    const mudou = (await anexar('col@x.com', 'tCol', JPG)).id;
    TURMAS.tCol = doc({ escopo: 'universidade' });
    TURMAS.tSemUnidade = doc({ escopo: 'colegio' });
    const fica = (await anexar('col@x.com', 'tSemUnidade', JPG)).id;
    TURMAS.tSemUnidade = doc({ tema: 'x' });

    const r = await pedir('Bearer segredo-do-cron', 'GET', { acao: 'varrer' });
    expect(r.body).toEqual({ lixeira: 2, movidos: 1 });
    expect(apagado(pendente) && apagado(orfao)).toBe(true);
    expect(apagado(recente) || apagado(fica)).toBe(false);
    expect(arquivos.get(mudou)!).toMatchObject({ parents: [colaborador ? PASTA_COL : PASTA_UNI], appProperties: { escopo: 'universidade' } });
    expect((await pedir('col@x.com', 'GET', { acao: 'listar', treinamento: 'tCol' })).code).toBe(403);
  });
});
});
