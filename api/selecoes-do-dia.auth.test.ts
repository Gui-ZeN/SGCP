import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import handler from './selecoes-do-dia';

// Trava 1 do disparo das 18h: só quem tem o CRON_SECRET passa. A comparação
// virou tempo constante na auditoria de 14/10/2026 — estes testes garantem que
// a troca não abriu nem fechou a porta errada.
const resposta = () => {
  const r: any = { codigo: 0, corpo: null };
  r.status = (c: number) => { r.codigo = c; return r; };
  r.json = (b: any) => { r.corpo = b; return r; };
  return r;
};

describe('selecoes-do-dia: segredo do cron', () => {
  const antes = { ...process.env };
  beforeEach(() => {
    process.env.CRON_SECRET = 'segredo-de-teste';
    for (const v of ['SMTP_USER', 'SMTP_APP_PASSWORD', 'GOOGLE_SERVICE_ACCOUNT_JSON']) delete process.env[v];
  });
  afterEach(() => { process.env = { ...antes }; });

  it('sem Authorization: 401', async () => {
    const res = resposta();
    await handler({ headers: {} }, res);
    expect(res.codigo).toBe(401);
  });

  it('segredo errado (mesmo prefixo): 401', async () => {
    const res = resposta();
    await handler({ headers: { authorization: 'Bearer segredo-de-test' } }, res);
    expect(res.codigo).toBe(401);
  });

  it('segredo certo passa da trava (aqui para na falta das outras variáveis)', async () => {
    const res = resposta();
    await handler({ headers: { authorization: 'Bearer segredo-de-teste' } }, res);
    expect(res.codigo).toBe(503);
    expect(res.corpo.faltando).toContain('SMTP_USER');
  });

  it('sem CRON_SECRET no deploy: 503, não 401', async () => {
    delete process.env.CRON_SECRET;
    const res = resposta();
    await handler({ headers: { authorization: 'Bearer qualquer' } }, res);
    expect(res.codigo).toBe(503);
  });
});
