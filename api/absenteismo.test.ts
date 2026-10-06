import { describe, it, expect, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import handler, { verificarIdToken, instituicaoDe } from './absenteismo';

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
const valido = (extra: Record<string, unknown> = {}) => ({
  aud: PROJ, iss: `https://securetoken.google.com/${PROJ}`, sub: 'u1',
  exp: Math.floor(Date.now() / 1000) + 600, email: 'Fulana@Christus.com.br', email_verified: true, ...extra,
});
const chaves = (async () => Response.json({ k1: publicKey })) as unknown as typeof fetch;

describe('verificarIdToken (porteiro da ponte com o Chromos)', () => {
  it('token bom devolve o e-mail em minúsculas', async () => {
    expect(await verificarIdToken(token(valido()), PROJ, chaves)).toBe('fulana@christus.com.br');
  });
  it('recusa alg none, outro projeto, vencido e e-mail não confirmado', async () => {
    await expect(verificarIdToken(token(valido(), { alg: 'none', kid: 'k1' }), PROJ, chaves)).rejects.toThrow();
    await expect(verificarIdToken(token(valido({ aud: 'outro' })), PROJ, chaves)).rejects.toThrow();
    await expect(verificarIdToken(token(valido({ exp: 1 })), PROJ, chaves)).rejects.toThrow();
    await expect(verificarIdToken(token(valido({ email_verified: false })), PROJ, chaves)).rejects.toThrow();
  });
  it('recusa assinatura adulterada', async () => {
    const [c, , s] = token(valido()).split('.');
    await expect(verificarIdToken(`${c}.${b64(valido({ email: 'outra@x.com' }))}.${s}`, PROJ, chaves)).rejects.toThrow();
  });
});

describe('instituicaoDe — Colégio e Universidade separados', () => {
  const uni = new Set(['u@x.com']);
  it('Administrador vê a rede; Universidade vê Unichristus; o resto, Christus', () => {
    expect(instituicaoDe({ email: 'a@x.com', role: 'Administrador' }, uni)).toBeUndefined();
    expect(instituicaoDe({ email: 'u@x.com', role: 'Coordenador' }, uni)).toBe('Unichristus');
    expect(instituicaoDe({ email: 'c@x.com', role: 'Analista' }, uni)).toBe('Christus');
  });
});

describe('handler', () => {
  const resposta = () => {
    const r: any = { code: 0, body: null, headers: {} };
    r.status = (c: number) => { r.code = c; return r; };
    r.json = (b: unknown) => { r.body = b; return r; };
    r.setHeader = () => r;
    return r;
  };
  afterEach(() => vi.unstubAllEnvs());

  it('sem a integração configurada: 503, sem olhar o resto', async () => {
    vi.stubEnv('CROMOS_ABSENTEISMO_URL', '');
    const r = resposta();
    await handler({ method: 'GET', headers: {}, query: {} }, r);
    expect(r.code).toBe(503);
  });
  it('sem token: 401; período inválido: 400', async () => {
    vi.stubEnv('CROMOS_ABSENTEISMO_URL', 'https://cromos/api/absenteismo-externo');
    vi.stubEnv('CROMOS_ABSENTEISMO_TOKEN', 's');
    const a = resposta();
    await handler({ method: 'GET', headers: {}, query: { de: '2026-01', ate: '2026-09' } }, a);
    expect(a.code).toBe(401);
    const b = resposta();
    await handler({ method: 'GET', headers: { authorization: 'Bearer x' }, query: { de: '2026-09', ate: '2026-01' } }, b);
    expect(b.code).toBe(400);
  });
});
