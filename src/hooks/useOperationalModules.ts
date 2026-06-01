/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Treinamento, Experiencia, Entrevista, Turnover } from '../types';
import { 
  db, 
  isFirebaseEnabled, 
  collection, 
  onSnapshot,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  handleFirestoreError,
  OperationType
} from '../lib/firebase';
import type { ImportableEntrevista, ImportableTreinamento } from '../lib/spreadsheetImport';
import { stripUndefinedFields } from '../lib/firestoreData';

const TREINAMENTOS_LOCAL_KEY = 'ats_treinamentos_fallback';
const EXPERIENCIA_LOCAL_KEY = 'ats_experiencia_fallback';
const ENTREVISTAS_LOCAL_KEY = 'ats_entrevistas_fallback';
const TURNOVER_LOCAL_KEY = 'ats_turnover_fallback';

// Helper to add days to a DD/MM/YYYY date
export function addDaysToDate(dateStr: string, days: number): string {
  try {
    // Expected format DD/MM/YYYY or YYYY-MM-DD
    let parts: string[] = [];
    if (dateStr.includes('/')) {
      parts = dateStr.split('/');
    } else if (dateStr.includes('-')) {
      parts = dateStr.split('-');
      // Convert YYYY-MM-DD to [DD, MM, YYYY]
      parts = [parts[2], parts[1], parts[0]];
    }

    if (parts.length !== 3) return dateStr;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);

    const date = new Date(year, month, day);
    date.setDate(date.getDate() + days);

    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();

    return `${d}/${m}/${y}`;
  } catch (e) {
    return dateStr;
  }
}

// ---------------------- PRESETS ----------------------
const initialTreinamentos: Treinamento[] = [
  {
    id: 't_1',
    codigo: 101,
    dataInicio: '10/05/2026',
    dataTermino: '12/05/2026',
    mesReferencia: 'maio',
    tema: 'Liderança Situacional e Feedbacks Eficazes',
    tipo: 'Liderança',
    facilitador: 'Arlana Carvalho (RH)',
    publico: 'Supervisores de Posto',
    unidade: 'DT',
    cargaHoraria: 12,
    qtdPrevista: 18,
    qtdRealizada: 16,
    totalHorasFormacao: 192,
    valorInvestido: 2500
  },
  {
    id: 't_2',
    codigo: 102,
    dataInicio: '18/05/2026',
    dataTermino: '18/05/2026',
    mesReferencia: 'maio',
    tema: 'Integração de Novos Talentos e Cultura',
    tipo: 'Integração',
    facilitador: 'Larissa Moura (RH)',
    publico: 'Novos Colaboradores',
    unidade: 'Construtora',
    cargaHoraria: 4,
    qtdPrevista: 10,
    qtdRealizada: 10,
    totalHorasFormacao: 40,
    valorInvestido: 450
  },
  {
    id: 't_3',
    codigo: 103,
    dataInicio: '22/05/2026',
    dataTermino: '24/05/2026',
    mesReferencia: 'maio',
    tema: 'Operação Segura de Equipamentos de Altura',
    tipo: 'Técnico',
    facilitador: 'Valdemar Gomes (Seg. Trabalho)',
    publico: 'Oficiais de Manutenção',
    unidade: 'PQL 1',
    cargaHoraria: 16,
    qtdPrevista: 8,
    qtdRealizada: 7,
    totalHorasFormacao: 112,
    valorInvestido: 1800
  }
];

const initialExperiencia: Experiencia[] = [
  {
    id: 'exp_1',
    colaborador: 'Marcos Vinícius Silva',
    funcao: 'Auxiliar Administrativo',
    setor: 'TI',
    dataAdmissao: '12/04/2026',
    supervisor: 'Guilherme Zen',
    observacoes: 'Excelente pontualidade e dedicação.',
    status: 'EM_ANALISE',
    termino1: addDaysToDate('12/04/2026', 45),
    termino2: addDaysToDate('12/04/2026', 90)
  },
  {
    id: 'exp_2',
    colaborador: 'Camila Ferreira Ramos',
    funcao: 'Analista de RH',
    setor: 'Coordenação',
    dataAdmissao: '01/03/2026',
    supervisor: 'Arlana Carvalho',
    observacoes: 'Avaliada positivamente pela gerência. Efetivação solicitada antecipadamente.',
    status: 'EFETIVADO',
    termino1: addDaysToDate('01/03/2026', 45),
    termino2: addDaysToDate('01/03/2026', 90)
  },
  {
    id: 'exp_3',
    colaborador: 'Renato Oliveira Souza',
    funcao: 'Oficial de Manutenção',
    setor: 'Infra',
    dataAdmissao: '10/05/2026',
    supervisor: 'Valdemar Gomes',
    observacoes: 'Em fase de adaptação prática no posto de trabalho.',
    status: 'EM_ANALISE',
    termino1: addDaysToDate('10/05/2026', 45),
    termino2: addDaysToDate('10/05/2026', 90)
  }
];

const initialEntrevistas: Entrevista[] = [
  {
    id: 'ent_1',
    codigo: 301,
    colaborador: 'Daniela Souza Santos',
    dataEntrevista: '15/05/2026',
    funcao: 'Analista de Sistemas',
    unidade: 'TI',
    admissao: '15/03/2024',
    desligamento: '10/05/2026',
    motivoSaida: 'Melhor proposta salarial no mercado',
    gostavaTrabalho: 'Sim',
    oqMaisGostava: 'Clima da equipe de tecnologia e liberdade criativa.',
    oqMenosGostava: 'Falta de plano de carreira estruturado para sêniors.',
    notaSalario: 3,
    notaTreinamento: 4,
    notaCrescimento: 2,
    notaRelacionamentoColegas: 5,
    notaRelacionamentoChefia: 4,
    notaClimaOrg: 5,
    voltaria: 'Sim',
    sugestoes: 'Estruturar um plano de cargos e salários transparente.',
    entrevistador: 'Larissa Moura'
  },
  {
    id: 'ent_2',
    codigo: 302,
    colaborador: 'José Roberto de Oliveira',
    dataEntrevista: '22/05/2026',
    funcao: 'Auxiliar de Serviços Gerais',
    unidade: 'D. Valéria',
    admissao: '10/08/2025',
    desligamento: '20/05/2026',
    motivoSaida: 'Mudança de cidade/residência',
    gostavaTrabalho: 'Sim',
    oqMaisGostava: 'Do cuidado da supervisora e benefícios.',
    oqMenosGostava: 'Carga horária exaustiva de transporte público.',
    notaSalario: 4,
    notaTreinamento: 3,
    notaCrescimento: 3,
    notaRelacionamentoColegas: 5,
    notaRelacionamentoChefia: 5,
    notaClimaOrg: 4,
    voltaria: 'Sim',
    sugestoes: 'Não há, fui muito bem acolhido.',
    entrevistador: 'Arlana Carvalho'
  }
];

const initialTurnover: Turnover[] = [
  {
    id: 'to_1',
    mesAno: '01/2026',
    totalFuncionarios: 154,
    totalAdmissao: 8,
    pediramSair: 3,
    foramDesligados: 2
  },
  {
    id: 'to_2',
    mesAno: '02/2026',
    totalFuncionarios: 157,
    totalAdmissao: 6,
    pediramSair: 1,
    foramDesligados: 2
  },
  {
    id: 'to_3',
    mesAno: '03/2026',
    totalFuncionarios: 160,
    totalAdmissao: 7,
    pediramSair: 2,
    foramDesligados: 1
  },
  {
    id: 'to_4',
    mesAno: '04/2026',
    totalFuncionarios: 164,
    totalAdmissao: 9,
    pediramSair: 4,
    foramDesligados: 3
  },
  {
    id: 'to_5',
    mesAno: '05/2026',
    totalFuncionarios: 168,
    totalAdmissao: 12,
    pediramSair: 2,
    foramDesligados: 2
  }
];

export function useOperationalModules() {
  const [treinamentos, setTreinamentos] = useState<Treinamento[]>([]);
  const [experiencias, setExperiencias] = useState<Experiencia[]>([]);
  const [entrevistas, setEntrevistas] = useState<Entrevista[]>([]);
  const [turnover, setTurnover] = useState<Turnover[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFirebase, setUsingFirebase] = useState(isFirebaseEnabled);

  useEffect(() => {
    if (isFirebaseEnabled && db) {
      setLoading(true);

      // --- 1. Treinamentos Realtime Sync ---
      const unsubTreinamentos = onSnapshot(collection(db, 'treinamentos'), (snapshot) => {
        const list: Treinamento[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as Treinamento);
        });
        list.sort((a, b) => b.codigo - a.codigo);
        setTreinamentos(list);
        localStorage.setItem(TREINAMENTOS_LOCAL_KEY, JSON.stringify(list));
      }, (err) => {
        console.warn("Erro ao ler Treinamentos do Firestore, usando local fallback:", err);
        loadLocalFallback();
      });

      // --- 2. Experiencia Realtime Sync ---
      const unsubExperiencia = onSnapshot(collection(db, 'experiencia'), (snapshot) => {
        const list: Experiencia[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as Experiencia);
        });
        setExperiencias(list);
        localStorage.setItem(EXPERIENCIA_LOCAL_KEY, JSON.stringify(list));
      }, (err) => {
        console.warn("Erro ao ler Experiencia do Firestore, usando local fallback:", err);
        loadLocalFallback();
      });

      // --- 3. Entrevistas Realtime Sync ---
      const unsubEntrevistas = onSnapshot(collection(db, 'entrevistas'), (snapshot) => {
        const list: Entrevista[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as Entrevista);
        });
        list.sort((a, b) => b.codigo - a.codigo);
        setEntrevistas(list);
        localStorage.setItem(ENTREVISTAS_LOCAL_KEY, JSON.stringify(list));
      }, (err) => {
        console.warn("Erro ao ler Entrevistas do Firestore, usando local fallback:", err);
        loadLocalFallback();
      });

      // --- 4. Turnover Realtime Sync ---
      const unsubTurnover = onSnapshot(collection(db, 'turnover'), (snapshot) => {
        const list: Turnover[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as Turnover);
        });
        // Sort by date key (represented as mm/yyyy)
        list.sort((a, b) => {
          const partsA = a.mesAno.split('/');
          const partsB = b.mesAno.split('/');
          const yearDiff = parseInt(partsA[1] || '0') - parseInt(partsB[1] || '0');
          if (yearDiff !== 0) return yearDiff;
          return parseInt(partsA[0] || '0') - parseInt(partsB[0] || '0');
        });
        setTurnover(list);
        localStorage.setItem(TURNOVER_LOCAL_KEY, JSON.stringify(list));
        setLoading(false);
      }, (err) => {
        console.warn("Erro ao ler Turnover do Firestore, usando local fallback:", err);
        loadLocalFallback();
      });

      return () => {
        unsubTreinamentos();
        unsubExperiencia();
        unsubEntrevistas();
        unsubTurnover();
      };
    } else {
      loadLocalFallback();
    }
  }, []);

  const loadLocalFallback = () => {
    setUsingFirebase(false);
    const isCleanMode = localStorage.getItem('ats_db_clean_mode') === 'true';

    // Treinamentos
    const storedT = localStorage.getItem(TREINAMENTOS_LOCAL_KEY);
    if (storedT) {
      setTreinamentos(JSON.parse(storedT));
    } else {
      const initial = isCleanMode ? [] : initialTreinamentos;
      setTreinamentos(initial);
      localStorage.setItem(TREINAMENTOS_LOCAL_KEY, JSON.stringify(initial));
    }

    // Experiencia
    const storedE = localStorage.getItem(EXPERIENCIA_LOCAL_KEY);
    if (storedE) {
      setExperiencias(JSON.parse(storedE));
    } else {
      const initial = isCleanMode ? [] : initialExperiencia;
      setExperiencias(initial);
      localStorage.setItem(EXPERIENCIA_LOCAL_KEY, JSON.stringify(initial));
    }

    // Entrevistas
    const storedEnt = localStorage.getItem(ENTREVISTAS_LOCAL_KEY);
    if (storedEnt) {
      setEntrevistas(JSON.parse(storedEnt));
    } else {
      const initial = isCleanMode ? [] : initialEntrevistas;
      setEntrevistas(initial);
      localStorage.setItem(ENTREVISTAS_LOCAL_KEY, JSON.stringify(initial));
    }

    // Turnover
    const storedTo = localStorage.getItem(TURNOVER_LOCAL_KEY);
    if (storedTo) {
      setTurnover(JSON.parse(storedTo));
    } else {
      const initial = isCleanMode ? [] : initialTurnover;
      setTurnover(initial);
      localStorage.setItem(TURNOVER_LOCAL_KEY, JSON.stringify(initial));
    }

    setLoading(false);
  };

  // ==================== CRUD TREINAMENTOS ====================
  const addTreinamento = async (input: Omit<Treinamento, 'id' | 'codigo'>) => {
    const nextCodigo = treinamentos.length > 0 ? Math.max(...treinamentos.map(t => t.codigo)) + 1 : 101;
    const body = {
      ...input,
      codigo: nextCodigo
    };

    if (usingFirebase && db) {
      try {
        await addDoc(collection(db, 'treinamentos'), body);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'treinamentos');
      }
    } else {
      const newItem: Treinamento = { id: `local_t_${Date.now()}`, ...body };
      const updated = [newItem, ...treinamentos];
      setTreinamentos(updated);
      localStorage.setItem(TREINAMENTOS_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  const updateTreinamento = async (id: string, updatedFields: Partial<Treinamento>) => {
    if (usingFirebase && db) {
      try {
        const ref = doc(db, 'treinamentos', id);
        const payload = { ...updatedFields };
        delete payload.id;
        delete payload.codigo;
        await updateDoc(ref, payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `treinamentos/${id}`);
      }
    } else {
      const updated = treinamentos.map(t => t.id === id ? { ...t, ...updatedFields } : t);
      setTreinamentos(updated);
      localStorage.setItem(TREINAMENTOS_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  const deleteTreinamento = async (id: string) => {
    if (usingFirebase && db) {
      try {
        await deleteDoc(doc(db, 'treinamentos', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `treinamentos/${id}`);
      }
    } else {
      const updated = treinamentos.filter(t => t.id !== id);
      setTreinamentos(updated);
      localStorage.setItem(TREINAMENTOS_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  // ==================== CRUD EXPERIENCIA ====================
  const addExperiencia = async (input: Omit<Experiencia, 'id' | 'termino1' | 'termino2'>) => {
    const term1 = addDaysToDate(input.dataAdmissao, 45);
    const term2 = addDaysToDate(input.dataAdmissao, 90);
    const body = {
      ...input,
      termino1: term1,
      termino2: term2
    };

    if (usingFirebase && db) {
      try {
        await addDoc(collection(db, 'experiencia'), body);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'experiencia');
      }
    } else {
      const newItem: Experiencia = { id: `local_exp_${Date.now()}`, ...body };
      const updated = [newItem, ...experiencias];
      setExperiencias(updated);
      localStorage.setItem(EXPERIENCIA_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  const updateExperiencia = async (id: string, updatedFields: Partial<Experiencia>) => {
    if (usingFirebase && db) {
      try {
        const ref = doc(db, 'experiencia', id);
        const payload = { ...updatedFields };
        delete payload.id;
        await updateDoc(ref, payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `experiencia/${id}`);
      }
    } else {
      const updated = experiencias.map(e => e.id === id ? { ...e, ...updatedFields } : e);
      setExperiencias(updated);
      localStorage.setItem(EXPERIENCIA_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  const deleteExperiencia = async (id: string) => {
    if (usingFirebase && db) {
      try {
        await deleteDoc(doc(db, 'experiencia', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `experiencia/${id}`);
      }
    } else {
      const updated = experiencias.filter(e => e.id !== id);
      setExperiencias(updated);
      localStorage.setItem(EXPERIENCIA_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  // ==================== CRUD ENTREVISTAS ====================
  const addEntrevista = async (input: Omit<Entrevista, 'id' | 'codigo'>) => {
    const nextCodigo = entrevistas.length > 0 ? Math.max(...entrevistas.map(e => e.codigo)) + 1 : 301;
    const body = {
      ...input,
      codigo: nextCodigo
    };

    if (usingFirebase && db) {
      try {
        await addDoc(collection(db, 'entrevistas'), body);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'entrevistas');
      }
    } else {
      const newItem: Entrevista = { id: `local_ent_${Date.now()}`, ...body };
      const updated = [newItem, ...entrevistas];
      setEntrevistas(updated);
      localStorage.setItem(ENTREVISTAS_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  const deleteEntrevista = async (id: string) => {
    if (usingFirebase && db) {
      try {
        await deleteDoc(doc(db, 'entrevistas', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `entrevistas/${id}`);
      }
    } else {
      const updated = entrevistas.filter(e => e.id !== id);
      setEntrevistas(updated);
      localStorage.setItem(ENTREVISTAS_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  const importTreinamentos = async (imported: ImportableTreinamento[], replace = false) => {
    if (imported.length === 0) return;

    if (usingFirebase && db) {
      try {
        if (replace) {
          const snap = await getDocs(collection(db, 'treinamentos'));
          await Promise.all(snap.docs.map((docSnap: any) => deleteDoc(doc(db, 'treinamentos', docSnap.id))));
        }

        const existingCodes = replace ? new Set<number>() : new Set(treinamentos.map(t => t.codigo));
        const toCreate = imported.filter(t => !existingCodes.has(t.codigo));
        await Promise.all(toCreate.map(({ id, ...treinamento }: any) => addDoc(collection(db, 'treinamentos'), stripUndefinedFields(treinamento))));
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'treinamentos/import');
      }
    } else {
      const existingCodes = replace ? new Set<number>() : new Set(treinamentos.map(t => t.codigo));
      const toCreate = imported
        .filter(t => !existingCodes.has(t.codigo))
        .map((t, index) => ({ id: `local_import_t_${Date.now()}_${index}`, ...t } as Treinamento));
      const updated = replace ? toCreate : [...toCreate, ...treinamentos];
      updated.sort((a, b) => b.codigo - a.codigo);
      setTreinamentos(updated);
      localStorage.setItem(TREINAMENTOS_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  const importEntrevistas = async (imported: ImportableEntrevista[], replace = false) => {
    if (imported.length === 0) return;

    if (usingFirebase && db) {
      try {
        if (replace) {
          const snap = await getDocs(collection(db, 'entrevistas'));
          await Promise.all(snap.docs.map((docSnap: any) => deleteDoc(doc(db, 'entrevistas', docSnap.id))));
        }

        const existingKeys = replace ? new Set<string>() : new Set(entrevistas.map(e => `${e.colaborador}|${e.dataEntrevista}|${e.funcao}`.toLowerCase()));
        const toCreate = imported.filter(e => !existingKeys.has(`${e.colaborador}|${e.dataEntrevista}|${e.funcao}`.toLowerCase()));
        await Promise.all(toCreate.map(({ id, ...entrevista }: any) => addDoc(collection(db, 'entrevistas'), stripUndefinedFields(entrevista))));
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'entrevistas/import');
      }
    } else {
      const existingKeys = replace ? new Set<string>() : new Set(entrevistas.map(e => `${e.colaborador}|${e.dataEntrevista}|${e.funcao}`.toLowerCase()));
      const toCreate = imported
        .filter(e => !existingKeys.has(`${e.colaborador}|${e.dataEntrevista}|${e.funcao}`.toLowerCase()))
        .map((e, index) => ({ id: `local_import_ent_${Date.now()}_${index}`, ...e } as Entrevista));
      const updated = replace ? toCreate : [...toCreate, ...entrevistas];
      updated.sort((a, b) => b.codigo - a.codigo);
      setEntrevistas(updated);
      localStorage.setItem(ENTREVISTAS_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  // ==================== CRUD TURNOVER ====================
  const addTurnover = async (input: Omit<Turnover, 'id'>) => {
    if (usingFirebase && db) {
      try {
        await addDoc(collection(db, 'turnover'), input);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'turnover');
      }
    } else {
      const newItem: Turnover = { id: `local_to_${Date.now()}`, ...input };
      const updated = [...turnover, newItem];
      setTurnover(updated);
      localStorage.setItem(TURNOVER_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  const deleteTurnover = async (id: string) => {
    if (usingFirebase && db) {
      try {
        await deleteDoc(doc(db, 'turnover', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `turnover/${id}`);
      }
    } else {
      const updated = turnover.filter(t => t.id !== id);
      setTurnover(updated);
      localStorage.setItem(TURNOVER_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  return {
    treinamentos,
    experiencias,
    entrevistas,
    turnover,
    loading,
    addTreinamento,
    updateTreinamento,
    deleteTreinamento,
    importTreinamentos,
    addExperiencia,
    updateExperiencia,
    deleteExperiencia,
    addEntrevista,
    deleteEntrevista,
    importEntrevistas,
    addTurnover,
    deleteTurnover
  };
}
