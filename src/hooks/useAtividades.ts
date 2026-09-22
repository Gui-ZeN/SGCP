/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Atividades do dia — coleção PRÓPRIA (`atividades`).
 *
 * O que o RH fez no dia e não foi seleção: montar os kits do Setembro Amarelo,
 * força-tarefa de documentação, visita a uma sede, treinamento interno.
 *
 * ⚠️ Separado de `selecoes` de propósito, e não é preciosismo. Seleção tem
 * cargo, vaga, convocados e comparecimento; atividade não tem nenhum dos
 * quatro. Gravada na mesma coleção, ela entraria na contagem de seleções do
 * dia, na taxa de comparecimento e na tabela QUANTI como uma linha de colunas
 * vazias — misturando duas unidades diferentes no mesmo indicador, que é
 * justamente o que não pode acontecer nos números do RH.
 *
 * As duas aparecem juntas na tela e no e-mail das 18h. Juntas na LEITURA;
 * nunca somadas.
 */
import { useFirestoreCollection } from './useFirestoreCollection';

export interface Atividade {
  id: string;
  /** DD/MM/AAAA — mesmo formato de `Selecao.data`, é o que casa as duas na tela. */
  data: string;
  /** O que foi feito. "Montagem dos kits do Setembro Amarelo." */
  titulo: string;
  /** Detalhe opcional: quantos kits, quem ajudou, o que ficou pendente. */
  detalhe?: string;
  /** Quem tocou. Vazio quando foi a equipe toda. */
  responsavel?: string;
  /** Sede, para o recorte por unidade valer aqui também. */
  sede?: string;
}

export function useAtividades(currentUser: any, enabled = true) {
  const { items, loading, create, update, remove } = useFirestoreCollection<Atividade>({
    collectionName: 'atividades',
    localKey: 'sgcp_atividades_fallback',
    newLocalId: () => `local_ativ_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    // Mais recente primeiro dentro do mesmo dia não importa; o que importa é a
    // ordem estável, senão a lista dança a cada gravação.
    sort: (a, b) => (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR'),
    enabled: enabled && !!currentUser,
  });

  return {
    atividades: items,
    loading,
    adicionarAtividade: create,
    atualizarAtividade: update,
    removerAtividade: remove,
  };
}
