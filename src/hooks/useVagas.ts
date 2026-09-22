/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { dataISOLocal } from '../utils/date';
import { Vaga } from '../types';
import { 
  db, 
  isFirebaseEnabled, 
  collection, 
  getDocs,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  onSnapshot,
  writeBatch,
  handleFirestoreError,
  OperationType
} from '../lib/firebase';
import type { ImportableVaga } from '../lib/spreadsheetImport';
import { resolverSetor } from '../utils/setor';
import { codigosSequenciais } from '../utils/vaga';
import { stripUndefinedFields } from '../lib/firestoreData';

const LOCAL_STORAGE_KEY = 'ats_vagas_fallback';

export function useVagas(user?: any) {
  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFirebase, setUsingFirebase] = useState(isFirebaseEnabled);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Só assina o Firestore quando há usuário autenticado (as regras exigem auth).
  // Re-assina quando o usuário muda (login/logout).
  useEffect(() => {
    if (isFirebaseEnabled && db && user) {
      setLoading(true);
      const vagasCollection = collection(db, 'vagas');

      // Setup realtime Firestore synchronization
      const unsubscribe = onSnapshot(vagasCollection, (snapshot: any) => {
        const firestoreList: Vaga[] = [];
        snapshot.forEach((docSnap: any) => {
          firestoreList.push({ ...docSnap.data(), id: docSnap.id } as Vaga);
        });

        // Sort by code descending so newest are on top
        firestoreList.sort((a, b) => b.codigo - a.codigo);

        setVagas(firestoreList);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(firestoreList));
        setLoading(false);
      }, (error: any) => {
        // Não lançar aqui: lançar deixava o app preso em "loading". Apenas registra
        // e cai no fallback local (que libera o loading).
        console.warn('Erro ao ler vagas do Firestore, usando local fallback:', error);
        setErrorMessage("Erro ao conectar com Firestore. Redirecionando para banco local.");
        loadLocalFallback();
      });

      return () => unsubscribe();
    } else if (!isFirebaseEnabled) {
      loadLocalFallback();
    } else {
      // Firebase ativo, mas sem usuário autenticado: não assina (evita
      // permission-denied). O loading fica TRUE de propósito: a tela de login não
      // depende dele (gate usa authReady) e, no instante em que o login resolve,
      // isso evita 1 frame com o shell vazio antes dos efeitos re-assinarem (piscada).
      setVagas([]);
      setLoading(true);
    }
  }, [user]);

  // Local fallback engine using localStorage and initial JSON data
  const loadLocalFallback = () => {
    setUsingFirebase(false);
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Vaga[];
        parsed.sort((a, b) => b.codigo - a.codigo);
        setVagas(parsed);
      } catch (err) {
        setVagas([]);
      }
      setLoading(false);
      return;
    }

    const isCleanMode = localStorage.getItem('ats_db_clean_mode') === 'true';
    if (isCleanMode) {
      setVagas([]);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([]));
      setLoading(false);
      return;
    }

    // Seed do modo demo carregado SOB DEMANDA (dynamic import): são ~1.500 linhas
    // de dados que não devem pesar no bundle principal de quem usa Firebase.
    import('../data/initial_vagas')
      .then(({ initialVagas }) => {
        const seeded = initialVagas.map((v, index) => ({ id: `local_vaga_${index + 1}`, ...v } as Vaga));
        seeded.sort((a, b) => b.codigo - a.codigo);
        setVagas(seeded);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(seeded));
      })
      .catch(() => setVagas([]))
      .finally(() => setLoading(false));
  };

  /**
   * Abre UMA vaga, ou várias iguais de uma vez.
   *
   * ⚠️ Não dá para repetir `addVagas(x, 1)` num laço para abrir 30. O código
   * sai de `Math.max` sobre o estado `vagas`, e esse estado só muda quando o
   * onSnapshot volta do Firestore — as 30 chamadas leriam o mesmo máximo e
   * nasceriam com o MESMO código. Por isso a quantidade entra aqui dentro, onde
   * a numeração acontece uma vez só para o lote inteiro.
   *
   * Existe porque abrir 30 vagas de temporário preenchendo o formulário 30
   * vezes é, nas palavras da Coordenadora, "um rojão". Cada posição continua
   * sendo um registro próprio: mantém seu aprovado, sua conclusão e seu SLA, e
   * nenhum indicador do painel muda de significado.
   */
  const addVagas = async (vagaInput: Omit<Vaga, 'id' | 'codigo'>, quantidade = 1) => {
    const quantas = Math.max(1, Math.floor(quantidade) || 1);
    const comPadroes: Omit<Vaga, 'id' | 'codigo'> = {
      ...vagaInput,
      ano: vagaInput.ano || new Date().getFullYear(),
      // Marca o início da etapa atual na criação, p/ o "dias nesta etapa" começar do 0.
      etapaDesde: vagaInput.etapaDesde || dataISOLocal(),
    };
    return gravarVagasNumerando(
      Array.from({ length: quantas }, () => ({ ...comPadroes })),
      'vagas',
    );
  };

  const addVaga = async (vagaInput: Omit<Vaga, 'id' | 'codigo'>) => {
    await addVagas(vagaInput, 1);
  };

  /**
   * Numera e grava um conjunto de vagas de uma vez.
   *
   * writeBatch em blocos de 450: com `Promise.all(addDoc)` a importação de 355
   * linhas vira 355 requisições soltas, que foi o que travou a importação de
   * experiências antes. Serve tanto a abertura em lote quanto a importação
   * anual — a numeração sequencial é o problema que as duas têm em comum.
   */
  const gravarVagasNumerando = async (
    novas: Omit<Vaga, 'id' | 'codigo'>[],
    rotuloDoErro: string,
  ): Promise<number> => {
    if (novas.length === 0) return 0;
    const codigos = codigosSequenciais(vagas, novas.length);
    const comCodigo = novas.map((v, i) => ({ ...v, codigo: codigos[i] }));

    if (usingFirebase && db) {
      try {
        for (let i = 0; i < comCodigo.length; i += 450) {
          const batch = writeBatch(db);
          comCodigo.slice(i, i + 450).forEach(item => {
            batch.set(doc(collection(db, 'vagas')), stripUndefinedFields(item as any));
          });
          await batch.commit();
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, rotuloDoErro);
        return 0;
      }
    } else {
      const locais = comCodigo.map((v, i) => ({ id: `local_vaga_${Date.now()}_${i}`, ...v } as Vaga));
      const lista = [...locais, ...vagas].sort((a, b) => b.codigo - a.codigo);
      setVagas(lista);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lista));
    }

    return comCodigo.length;
  };

  // Update an existing vacancy's details or status
  const updateVaga = async (id: string, updatedFields: Partial<Vaga>) => {
    // Carimba etapaDesde automaticamente quando a etapa MUDA (e o chamador não
    // definiu), pro "dias nesta etapa" nascer preciso em qualquer caminho (modal
    // de edição, kanban por status, ações rápidas). Só quando muda de fato — assim
    // editar outros campos não reseta o cronômetro da etapa.
    const fields: Partial<Vaga> = { ...updatedFields };
    const current = vagas.find(v => v.id === id);
    if (
      fields.etapa !== undefined &&
      fields.etapaDesde === undefined &&
      current && fields.etapa !== current.etapa
    ) {
      fields.etapaDesde = dataISOLocal();
    }

    // Congela/retoma o relógio do SLA ao pausar/retomar a vaga. Detecta a
    // transição comparando com o status atual (só age em mudança real).
    if (fields.status !== undefined && current) {
      const PAUSADO = ['PAUSADA', 'SUSPENSA'];
      const eraPausada = PAUSADO.includes(current.status as string);
      const seraPausada = PAUSADO.includes(fields.status as string);
      const hoje = dataISOLocal();
      if (!eraPausada && seraPausada && fields.pausadaDesde === undefined) {
        // começou a pausa agora → marca o início (o SLA para de contar a partir daqui)
        fields.pausadaDesde = hoje;
      } else if (eraPausada && !seraPausada) {
        // retomou → acumula o período pausado e limpa o marcador
        if (current.pausadaDesde) {
          const ini = new Date(current.pausadaDesde).getTime();
          const fim = new Date(hoje).getTime();
          if (!isNaN(ini)) {
            const dias = Math.max(0, Math.floor((fim - ini) / 86400000));
            fields.diasPausados = (current.diasPausados || 0) + dias;
          }
        }
        fields.pausadaDesde = '';
      }
    }

    if (usingFirebase && db) {
      try {
        const docRef = doc(db, 'vagas', id);
        // Clean out ID/code changes to avoid security rule violations
        const filteredPayload: any = { ...fields };
        delete filteredPayload.id;
        delete filteredPayload.codigo;
        // Remove campos undefined: o updateDoc do Firestore lança erro com
        // qualquer valor undefined (era a causa do "Erro no processamento" ao
        // editar vagas pelo modal, que envia o objeto completo).
        await updateDoc(docRef, stripUndefinedFields(filteredPayload));
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `vagas/${id}`);
      }
    } else {
      // Local fallback CRUD
      const updatedList = vagas.map(v => {
        if (v.id === id) {
          return { ...v, ...fields };
        }
        return v;
      });
      setVagas(updatedList);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
    }
  };

  // Delete vacancy permanently
  const deleteVaga = async (id: string) => {
    if (usingFirebase && db) {
      try {
        const docRef = doc(db, 'vagas', id);
        await deleteDoc(docRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `vagas/${id}`);
      }
    } else {
      // Local fallback CRUD
      const updatedList = vagas.filter(v => v.id !== id);
      setVagas(updatedList);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
    }
  };

  const importVagas = async (imported: ImportableVaga[], replace = false) => {
    if (imported.length === 0) return;

    if (usingFirebase && db) {
      try {
        if (replace) {
          const snap = await getDocs(collection(db, 'vagas'));
          await Promise.all(snap.docs.map((docSnap: any) => deleteDoc(doc(db, 'vagas', docSnap.id))));
        }

        const existingCodes = replace ? new Set<number>() : new Set(vagas.map(v => v.codigo));
        const toCreate = imported.filter(v => !existingCodes.has(v.codigo));
        await Promise.all(toCreate.map(({ id, ...vaga }: any) => addDoc(collection(db, 'vagas'), stripUndefinedFields(vaga))));
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'vagas/import');
      }
    } else {
      const existingCodes = replace ? new Set<number>() : new Set(vagas.map(v => v.codigo));
      const toCreate = imported
        .filter(v => !existingCodes.has(v.codigo))
        .map((v, index) => ({ id: `local_import_vaga_${Date.now()}_${index}`, ...v } as Vaga));
      const updatedList = replace ? toCreate : [...toCreate, ...vagas];
      updatedList.sort((a, b) => b.codigo - a.codigo);
      setVagas(updatedList);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
    }
  };

  /**
   * Padroniza o campo `setor` das vagas para os nomes do cadastro (Admin →
   * Setores). Só toca no que TEM correspondência — valores órfãos ficam como
   * estão, de propósito (o admin decide cadastrar ou renomear). writeBatch p/
   * não fazer uma ida ao servidor por vaga.
   */
  const padronizarSetores = async (
    setoresCadastrados: string[]
  ): Promise<{ atualizadas: number }> => {
    const alvos = vagas
      .map(v => ({ v, novo: resolverSetor(v.setor, setoresCadastrados) }))
      .filter(x => x.novo && x.novo !== x.v.setor) as { v: Vaga; novo: string }[];

    if (!alvos.length) return { atualizadas: 0 };

    if (isFirebaseEnabled && db) {
      for (let i = 0; i < alvos.length; i += 450) {
        const batch = writeBatch(db);
        alvos.slice(i, i + 450).forEach(({ v, novo }) => {
          batch.update(doc(db, 'vagas', v.id), { setor: novo });
        });
        await batch.commit();
      }
    } else {
      const mapa = new Map(alvos.map(({ v, novo }) => [v.id, novo]));
      const atualizadas = vagas.map(v => (mapa.has(v.id) ? { ...v, setor: mapa.get(v.id)! } : v));
      setVagas(atualizadas);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(atualizadas));
    }
    return { atualizadas: alvos.length };
  };

  /**
   * Grava um lote de vagas vindas da planilha anual ("Controle de Vagas").
   *
   * Separado do `importVagas`: aquele deduplica por `codigo`, que a planilha
   * anual não tem — a decisão do que entra já foi tomada por
   * `planejarImportacao` (dedup por contagem contra o que existe). Aqui só
   * numeramos e gravamos — e quem numera e grava é `gravarVagasNumerando`,
   * compartilhado com a abertura em lote.
   */
  const importarVagasAnuais = (novas: Omit<Vaga, 'id' | 'codigo'>[]): Promise<number> =>
    gravarVagasNumerando(novas, 'vagas/importAnual');

  return {
    vagas,
    loading,
    usingFirebase,
    errorMessage,
    addVaga,
    addVagas,
    updateVaga,
    deleteVaga,
    importVagas,
    importarVagasAnuais,
    padronizarSetores
  };
}
