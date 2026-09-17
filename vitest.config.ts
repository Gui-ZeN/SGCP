import { defineConfig } from 'vitest/config';

// Testes de unidade dos helpers puros (datas, SLA/funil de vaga). Ambiente node —
// não tocam React/Firebase, então não precisam de DOM.
export default defineConfig({
  test: {
    environment: 'node',
    // `api/` entra junto: a função serverless do disparo das 18h tem teste de
    // carregamento, e ele só vale se rodar com o `npm test` de todo dia.
    include: ['src/**/*.test.ts', 'api/**/*.test.ts']
  }
});
