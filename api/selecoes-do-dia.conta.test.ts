/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * A conta de serviço mal colada derruba o disparo com mensagem útil?
 *
 * Existe porque em 21/09/2026 o cron das 18h rodou e devolveu 500 com
 * "Cannot read properties of undefined (reading 'replace')" — uma mensagem que
 * não aponta para nada. A causa era o valor da variável de ambiente colado com
 * aspas em volta: `JSON.parse` devolvia uma string em vez do objeto, e o
 * estouro só acontecia lá na assinatura do JWT.
 *
 * O que estes testes seguram: (1) esse caso volta a funcionar sozinho, e
 * (2) qualquer outro formato errado morre nomeando o campo que falta, em vez
 * de morrer num `.replace` de undefined.
 */
import { describe, it, expect } from 'vitest';
import { lerContaDeServico } from './selecoes-do-dia';

const CONTA = { client_email: 'x@y.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\\nfalsa\\n-----END PRIVATE KEY-----\\n' };

describe('lerContaDeServico', () => {
  it('lê a conta no formato normal', () => {
    expect(lerContaDeServico(JSON.stringify(CONTA)).client_email).toBe(CONTA.client_email);
  });

  it('recupera o valor colado com aspas em volta (o defeito de 21/09)', () => {
    // JSON dentro de JSON: `JSON.parse` devolve uma string, não o objeto.
    const duplo = JSON.stringify(JSON.stringify(CONTA));
    expect(JSON.parse(duplo)).toBeTypeOf('string');
    expect(lerContaDeServico(duplo).private_key).toBe(CONTA.private_key);
  });

  it('nomeia o campo que falta em vez de estourar adiante', () => {
    expect(() => lerContaDeServico(JSON.stringify({ client_email: CONTA.client_email })))
      .toThrow(/falta private_key/);
    expect(() => lerContaDeServico(JSON.stringify({})))
      .toThrow(/falta client_email e private_key/);
  });

  it('reclama de JSON inválido e de variável ausente', () => {
    expect(() => lerContaDeServico('não é json')).toThrow(/não é JSON válido/);
    expect(() => lerContaDeServico(undefined)).toThrow(/ausente/);
  });

  it('não põe o conteúdo da chave na mensagem de erro', () => {
    const comSegredo = JSON.stringify({ private_key: 'SEGREDO-QUE-NAO-PODE-VAZAR' });
    expect(() => lerContaDeServico(comSegredo)).toThrow();
    try { lerContaDeServico(comSegredo); } catch (e: any) {
      expect(e.message).not.toContain('SEGREDO-QUE-NAO-PODE-VAZAR');
    }
  });
});
