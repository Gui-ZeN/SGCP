/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Banco de candidatos (16/10/2026) — o histórico de cada pessoa e o "Nunca
 * mais chamar", para TODA tela que mostra ou recebe nomes.
 *
 * Vai por contexto, e não por prop: o aviso aparece na lista de nomes (quatro
 * telas de entrada) e nas três listas do dia; passar prop por cada camada era
 * mexer em meia dúzia de componentes para ler a mesma coisa. Fora do provedor
 * (modo de teste de um componente isolado), não há aviso — e nada quebra.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Candidato, Selecao } from '../types';
import { useFirestoreCollection } from './useFirestoreCollection';
import { isFirebaseEnabled, serverTimestamp } from '../lib/firebase';
import { normalizarNome } from '../utils/catalogo';
import {
  agruparPessoas, indicePorPessoa, marcaDe, avisoDe, separarTelefone, normalizarTelefone,
  type Pessoa, type MarcaNaoChamar, type Aviso,
} from '../utils/bancoCandidatos';
import type { Escopo } from '../utils/unidade';

export interface BancoCandidatos {
  pessoas: Pessoa[];
  marcas: MarcaNaoChamar[];
  /** A pessoa de um nome (ou de uma linha "Nome – telefone"). */
  pessoaDe: (linha: string, telefone?: string) => Pessoa | undefined;
  /** O selo para um nome; `excluir` = a convocação que está na tela. */
  avisoPara: (linha: string, telefone?: string, excluir?: string) => Aviso | null;
  /** A marca ativa de "Não chamar" para o nome/telefone. */
  marcaPara: (nome: string, telefone?: string) => ReturnType<typeof marcaDe>;
  /** Ausente para quem não grava (Visualizador). */
  marcar?: (p: { nome: string; telefone?: string; motivo: string; escopo: Escopo }) => Promise<void>;
  /** Só Coordenador e Administrador recebem. */
  desfazer?: (id: string, motivo: string) => Promise<void>;
  /** Unidade de quem está logado (null = Administrador, que grava nas duas). */
  unidadeDoLeitor: Escopo | null;
  /** A ficha aberta (uma por vez, para o app inteiro) — ver FichaDaPessoa. */
  ficha: { nome: string; telefone: string; pessoa?: Pessoa; marcar?: boolean } | null;
  /** `marcar`: já abre no formulário de "Nunca mais chamar" (botão da linha). */
  abrirFicha: (linha: string, telefone?: string, opcoes?: { marcar?: boolean }) => void;
  fecharFicha: () => void;
}

const Contexto = createContext<BancoCandidatos | null>(null);
export const useBanco = () => useContext(Contexto);

export function useNaoChamar(currentUser: any, escopo: Escopo | null, enabled: boolean) {
  const { items, create, update } = useFirestoreCollection<MarcaNaoChamar>({
    collectionName: 'naoChamar',
    localKey: 'sgcp_nao_chamar_fallback',
    newLocalId: () => `local_nc_${Date.now()}`,
    enabled: enabled && !!currentUser,
    escopo,
    semCopiaLocal: true,
  });
  const email = String(currentUser?.email || '').trim().toLowerCase();
  // Autor e hora conferidos pela regra: o e-mail do token e a hora do servidor.
  const agora = () => (isFirebaseEnabled ? serverTimestamp() : new Date().toISOString());
  const marcar = async ({ nome, telefone, motivo, escopo: e }: { nome: string; telefone?: string; motivo: string; escopo: Escopo }) => {
    const tel = normalizarTelefone(telefone);
    await create({ escopo: e, nome: nome.trim(), nomeNorm: normalizarNome(nome), ...(tel ? { telefone: tel } : {}), motivo: motivo.trim(), por: email, em: agora() } as any);
  };
  const desfazer = (id: string, motivo: string) => update(id, { desfeito: { por: email, em: agora(), motivo: motivo.trim() } } as any);
  return { marcas: items, marcar, desfazer };
}

export function ProvedorBanco({ candidatos, selecoes, marcas, marcar, desfazer, unidadeDoLeitor, children }: {
  candidatos: Candidato[];
  selecoes: Selecao[];
  marcas: MarcaNaoChamar[];
  marcar?: BancoCandidatos['marcar'];
  desfazer?: BancoCandidatos['desfazer'];
  unidadeDoLeitor: Escopo | null;
  children: ReactNode;
}) {
  const [aberta, setAberta] = useState<{ nome: string; telefone: string; marcar?: boolean } | null>(null);
  // Agrupar ~12 mil convocações é a parte cara: só refaz quando os dados
  // mudam, não a cada render do App (marcar/desfazer chegam como funções novas).
  const { pessoas, achar } = useMemo(() => {
    const pessoas = agruparPessoas(candidatos, selecoes);
    return { pessoas, achar: indicePorPessoa(pessoas) };
  }, [candidatos, selecoes]);
  const valor = useMemo<BancoCandidatos>(() => {
    const pessoaDe = (linha: string, telefone?: string) => {
      const s = separarTelefone(linha);
      return achar(s.nome, telefone || s.telefone);
    };
    const marcaPara = (nome: string, telefone?: string) => {
      const s = separarTelefone(nome);
      return marcaDe(marcas, s.nome, telefone || s.telefone);
    };
    return {
      pessoas, marcas, pessoaDe, marcaPara, marcar, desfazer, unidadeDoLeitor,
      ficha: aberta ? { ...aberta, pessoa: achar(aberta.nome, aberta.telefone) } : null,
      abrirFicha: (linha, telefone, opcoes) => { const x = separarTelefone(linha); setAberta({ nome: x.nome, telefone: normalizarTelefone(telefone || x.telefone), marcar: !!opcoes?.marcar }); },
      fecharFicha: () => setAberta(null),
      avisoPara: (linha, telefone, excluir) => {
        const s = separarTelefone(linha);
        if (!s.nome) return null;
        return avisoDe(achar(s.nome, telefone || s.telefone), marcaDe(marcas, s.nome, telefone || s.telefone), excluir);
      },
    };
  }, [pessoas, achar, marcas, marcar, desfazer, unidadeDoLeitor, aberta]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
