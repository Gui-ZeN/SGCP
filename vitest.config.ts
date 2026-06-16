import { defineConfig } from 'vitest/config';

// Testes de unidade dos helpers puros (datas, SLA/funil de vaga). Ambiente node —
// não tocam React/Firebase, então não precisam de DOM.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
