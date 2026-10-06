import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ⚠️ O PACOTE É "type": "module" E A VERCEL NÃO REESCREVE OS IMPORTS.
 * Em 06/10/2026 `api/absenteismo.ts` e `api/vagas-externas.ts` subiram com
 * `from './selecoes-do-dia'` (sem extensão): os testes passavam — o Vitest
 * resolve sozinho —, e em produção as duas funções morriam no carregamento
 * com FUNCTION_INVOCATION_FAILED (ERR_MODULE_NOT_FOUND). Import relativo em
 * `api/` precisa terminar em `.js`.
 */
describe('imports das funções da Vercel', () => {
  const dir = join(__dirname);
  const arquivos = readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  it.each(arquivos)('%s: todo import relativo termina em .js', (f) => {
    const src = readFileSync(join(dir, f), 'utf8');
    const relativos = [...src.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)].map(m => m[1]);
    expect(relativos.filter(r => !r.endsWith('.js'))).toEqual([]);
  });
});
