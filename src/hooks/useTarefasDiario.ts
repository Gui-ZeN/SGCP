/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * A lista de tarefas do "Meu dia" — da EQUIPE, não de cada pessoa
 * (`tarefasDiario/{id}`).
 *
 * Qualquer pessoa do RH cria uma tarefa nova direto do formulário, e ela passa
 * a aparecer para todas. Admin e Coordenador renomeiam, arquivam e APAGAM.
 * Arquivar some do formulário e mantém o histórico; apagar tira os números da
 * tarefa do acumulado (o relato ignora contagem de tarefa que não existe mais,
 * em vez de mostrar o id interno) — a tela avisa quantas contagens se perdem.
 *
 * As quatro padrão (`TAREFAS_PADRAO`) vivem no código; um documento com o
 * MESMO id aqui as renomeia ou arquiva.
 */
import { useMemo } from 'react';
import { useFirestoreCollection } from './useFirestoreCollection';
import { listaDeTarefas, TAREFAS_PADRAO, type Tarefa } from '../utils/resumoDia';

export function useTarefasDiario(currentUser: any, enabled = true) {
  const { items, create, upsert, remove } = useFirestoreCollection<Tarefa>({
    collectionName: 'tarefasDiario',
    localKey: 'sgcp_tarefas_diario_fallback',
    newLocalId: () => `local_tarefa_${Date.now()}`,
    enabled: enabled && !!currentUser,
  });

  /** Todas (inclusive arquivadas): o relato precisa do nome das antigas. */
  const tarefas = useMemo(() => listaDeTarefas(items), [items]);

  /** Tarefa nova da equipe — vai para o fim do formulário. */
  const criarTarefa = async (nome: string) => {
    const limpo = nome.trim().replace(/\s+/g, ' ');
    if (!limpo) return;
    // Mesmo nome já existe (ignorando caixa e acento)? Não duplica: é
    // exatamente a bagunça que a lista da equipe existe para evitar.
    const chave = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (tarefas.some(t => chave(t.nome) === chave(limpo))) throw new Error(`"${limpo}" já está na lista.`);
    const ordem = Math.max(0, ...tarefas.map(t => t.ordem ?? 0)) + 1;
    await create({ nome: limpo, ordem, arquivada: false } as Omit<Tarefa, 'id'>);
  };

  /** Renomear ou arquivar — Admin e Coordenador (a regra do banco confere). */
  const ajustarTarefa = async (id: string, campos: Partial<Pick<Tarefa, 'nome' | 'arquivada'>>) => {
    const atual = tarefas.find(t => t.id === id);
    if (!atual) return;
    await upsert(id, { nome: atual.nome, ordem: atual.ordem, ...campos });
  };

  /** Apaga uma tarefa da equipe. As quatro padrão vivem no código e não se apagam. */
  const apagarTarefa = async (id: string) => {
    if (TAREFAS_PADRAO.some(t => t.id === id)) return;
    await remove(id);
  };

  return { tarefas, criarTarefa, ajustarTarefa, apagarTarefa };
}
