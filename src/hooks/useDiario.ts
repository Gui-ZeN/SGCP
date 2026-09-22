/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * "Meu dia" — o que cada pessoa do RH informa à mão, um documento por pessoa
 * por dia (`diario/{email}__{AAAA-MM-DD}`).
 *
 * Só o que o SGPC NÃO registra sozinho: atendimentos a colaboradores, testes
 * psicológicos aplicados, vagas divulgadas e acolhimentos. Todo o resto do
 * relato diário vem do log de auditoria. Decidido na reunião de 22/09/2026 com
 * a direção: "não queria que o RH passasse uma hora todo dia preenchendo um
 * papel" — são quatro números, menos de um minuto.
 *
 * Id determinístico (e não addDoc): reabrir o dia e mudar um número EDITA o
 * registro, em vez de criar um segundo que o relato somaria em dobro.
 */
import { useFirestoreCollection } from './useFirestoreCollection';

export interface DiarioDoc {
  id: string;
  email: string;
  /** DD/MM/AAAA — mesmo formato das seleções e atividades. */
  data: string;
  /**
   * Tarefa (id da lista da equipe) → quantidade no dia. Mapa, e não campos
   * fixos, porque a lista é da equipe e cresce: cada tarefa nova seria uma
   * coluna nova no documento e uma regra nova no banco.
   */
  contagens: Record<string, number>;
  atualizadoEm?: string;
}

/** DD/MM/AAAA → id do documento daquela pessoa naquele dia. */
export function idDoDiario(email: string, data: string): string {
  const [d, m, a] = data.split('/');
  return `${email.trim().toLowerCase()}__${a}-${m}-${d}`;
}

export function useDiario(currentUser: any, enabled = true) {
  const { items, loading, upsert } = useFirestoreCollection<DiarioDoc>({
    collectionName: 'diario',
    localKey: 'sgcp_diario_fallback',
    newLocalId: () => `local_diario_${Date.now()}`,
    sort: (a, b) => (a.data || '').localeCompare(b.data || ''),
    enabled: enabled && !!currentUser,
  });

  /**
   * Grava o dia da pessoa logada — cria na primeira vez, edita depois.
   *
   * Manda TODAS as tarefas do formulário, inclusive as zeradas: o `upsert`
   * mescla, e uma tarefa que baixou de 3 para 0 e não fosse enviada ficaria
   * com o 3 antigo no banco.
   */
  const salvarMeuDia = async (data: string, contagens: Record<string, number>) => {
    const email = String(currentUser?.email || '').trim().toLowerCase();
    if (!email) throw new Error('sem usuário logado');
    const limpas = Object.fromEntries(
      Object.entries(contagens).map(([id, n]) => [id, Math.max(0, Math.min(999, Math.floor(Number(n)) || 0))])
    );
    await upsert(idDoDiario(email, data), { contagens: limpas, email, data, atualizadoEm: new Date().toISOString() });
  };

  return { diarios: items, loading, salvarMeuDia };
}
