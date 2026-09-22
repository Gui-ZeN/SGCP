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

  it('aceita o valor em base64, que é o formato sem nada a escapar', () => {
    const b64 = Buffer.from(JSON.stringify(CONTA), 'utf-8').toString('base64');
    expect(b64).not.toMatch(/[\n\r"]/);
    expect(lerContaDeServico(b64).client_email).toBe(CONTA.client_email);
  });

  it('diz em QUAL camada o valor está torto', () => {
    // Objeto com quebra de linha real dentro da string: o caso de 22/09.
    expect(() => lerContaDeServico('{"private_key":"-----BEGIN\nreal-----"}'))
      .toThrow(/começa como objeto mas não é JSON válido/);
    // Entre aspas, com miolo que não é JSON: distingue do caso acima.
    expect(() => lerContaDeServico(JSON.stringify('isto não é json')))
      .toThrow(/está entre aspas, e o que está dentro não é JSON/);
    // Nem uma coisa nem outra: sobra base64, e ele também não cola.
    expect(() => lerContaDeServico('-----BEGIN PRIVATE KEY-----'))
      .toThrow(/nem base64 de um JSON/);
  });

  it('nomeia o campo que falta em vez de estourar adiante', () => {
    expect(() => lerContaDeServico(JSON.stringify({ client_email: CONTA.client_email })))
      .toThrow(/falta private_key/);
    expect(() => lerContaDeServico(JSON.stringify({})))
      .toThrow(/falta client_email e private_key/);
  });

  it('reclama de variável ausente ou em branco', () => {
    expect(() => lerContaDeServico(undefined)).toThrow(/ausente/);
    expect(() => lerContaDeServico('   ')).toThrow(/ausente/);
  });

  it('não põe o conteúdo da chave na mensagem de erro', () => {
    const comSegredo = JSON.stringify({ private_key: 'SEGREDO-QUE-NAO-PODE-VAZAR' });
    expect(() => lerContaDeServico(comSegredo)).toThrow();
    try { lerContaDeServico(comSegredo); } catch (e: any) {
      expect(e.message).not.toContain('SEGREDO-QUE-NAO-PODE-VAZAR');
    }
  });
});
