/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * A função serverless CARREGA e responde?
 *
 * Existe porque em 17/09/2026 o cron das 18h disparou e a Vercel devolveu
 * FUNCTION_INVOCATION_FAILED — falha ao invocar, não erro da lógica. Esse tipo
 * de quebra (import que o empacotador não resolve, dependência fora do
 * `dependencies`, formato de módulo incompatível) não aparece no `tsc` nem nos
 * testes normais: só na primeira execução em produção, e a evidência é um
 * e-mail que ninguém recebeu.
 *
 * O teste empacota a função com o mesmo alvo da Vercel (Node, ESM), carrega o
 * bundle num processo limpo e invoca. Se o import quebrar, quebra aqui.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

describe('api/selecoes-do-dia', () => {
  it('empacota, carrega e responde sem variáveis de ambiente', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sgpc-fn-'));
    try {
      const bundle = join(dir, 'fn.mjs');
      execFileSync('npx', [
        'esbuild', 'api/selecoes-do-dia.ts',
        '--bundle', '--platform=node', '--format=esm', '--target=node20',
        `--outfile=${bundle}`,
      ], { stdio: 'pipe', shell: process.platform === 'win32' });

      // Processo separado: o carregamento do módulo é o que está sob teste.
      const roteiro = join(dir, 'rodar.mjs');
      writeFileSync(roteiro, `
        const m = await import(${JSON.stringify(pathToFileURL(bundle).href)});
        let status = 0, corpo = null;
        const res = { status(s){ status = s; return this; }, json(b){ corpo = b; return this; } };
        await m.default({ headers: {} }, res);
        console.log(JSON.stringify({ tipo: typeof m.default, status, corpo }));
      `);
      const saida = execFileSync(process.execPath, [roteiro], {
        encoding: 'utf-8',
        env: { ...process.env, CRON_SECRET: '', SMTP_USER: '', SMTP_APP_PASSWORD: '', GOOGLE_SERVICE_ACCOUNT_JSON: '' },
      });

      const r = JSON.parse(saida.trim().split('\n').pop()!);
      expect(r.tipo).toBe('function');
      // Sem CRON_SECRET: 503 "não configurado" — nunca 500, e nunca enviando.
      expect(r.status).toBe(503);
      expect(r.corpo.erro).toContain('não configurado');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
