/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Números sequenciais (#1234 da vaga, do treinamento) num contador ÚNICO do
 * banco, `contadores/{coleção}`, reservados numa transação.
 *
 * ⚠️ Antes o próximo número saía do maior da lista carregada. Com o
 * isolamento Colégio × Universidade no servidor (14/10/2026), cada unidade
 * passou a carregar só a sua lista — as duas gerariam o MESMO número. O
 * contador enxerga as duas; a transação impede duas reservas iguais.
 */
import { db, doc, runTransaction } from './firebase';

/**
 * Reserva `quantidade` números seguidos e devolve o primeiro. `piso`: o maior
 * número que quem reserva enxerga — importação de planilha grava números
 * próprios sem passar pelo contador, e ele não pode ficar para trás deles.
 */
export async function reservarCodigos(colecao: 'vagas' | 'treinamentos', quantidade: number, piso = 0): Promise<number> {
  const ref = doc(db, 'contadores', colecao);
  return runTransaction(db, async (tx: any) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error(`Contador de ${colecao} não existe — rode scripts/escopo-por-unidade.mjs.`);
    const guardado = Number(snap.data().ultimo) || 0;
    // O piso só vale perto do contador: um número absurdo na lista (vaga
    // importada com código gigante) não pode empurrar a numeração — a regra
    // limita o salto a 5000 e a reserva inteira seria recusada.
    const ultimo = piso > guardado && piso - guardado <= 4000 ? piso : guardado;
    tx.update(ref, { ultimo: ultimo + quantidade });
    return ultimo + 1;
  });
}
