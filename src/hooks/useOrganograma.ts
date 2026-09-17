/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Nós do organograma — coleção PRÓPRIA (`organograma`).
 *
 * Separado de `funcionarios` de propósito. O organograma é um desenho da
 * estrutura, e estrutura tem caixa que não corresponde a ninguém do quadro:
 * posição vaga a preencher, cargo que existe no papel antes da pessoa, gente de
 * fora do CNPJ que aparece no desenho. Amarrar as caixas ao roster foi o erro da
 * primeira versão — travava o desenho no cadastro.
 *
 * O quadro de funcionários volta no papel certo: quando o RH escolhe o CARGO,
 * a tela sugere os nomes de quem ocupa aquele cargo. Sugestão, não vínculo.
 */
import { useFirestoreCollection } from './useFirestoreCollection';

export interface NoOrganogramaDoc {
  id: string;
  nome: string;
  cargo?: string;
  sede?: string;
  /** Recorte do desenho: Infra, Pedagógico, Administrativo… um por setor. */
  setor?: string;
  /** id de outro nó. Vazio = topo do desenho. */
  respondeA?: string;
}

export function useOrganograma(currentUser: any, enabled = true) {
  const { items, loading, create, update, remove } = useFirestoreCollection<NoOrganogramaDoc>({
    collectionName: 'organograma',
    localKey: 'sgcp_organograma_fallback',
    newLocalId: () => `local_org_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    sort: (a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'),
    enabled: enabled && !!currentUser,
  });

  return {
    nos: items,
    loading,
    adicionarNo: create,
    atualizarNo: update,
    removerNo: remove,
  };
}
