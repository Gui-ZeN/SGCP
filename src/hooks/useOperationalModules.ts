/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Treinamento, Experiencia, Entrevista, Turnover } from '../types';
import {
  db,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  handleFirestoreError,
  OperationType
} from '../lib/firebase';
import type { ImportableEntrevista, ImportableTreinamento } from '../lib/spreadsheetImport';
import { stripUndefinedFields } from '../lib/firestoreData';
import { useFirestoreCollection } from './useFirestoreCollection';
import { addDaysToDate, DIAS_EXPERIENCIA_1, DIAS_EXPERIENCIA_2 } from '../utils/date';
// Re-export para compatibilidade (definições movidas para utils/date, testáveis sem firebase).
export { addDaysToDate, DIAS_EXPERIENCIA_1, DIAS_EXPERIENCIA_2 };

const TREINAMENTOS_LOCAL_KEY = 'ats_treinamentos_fallback';
const EXPERIENCIA_LOCAL_KEY = 'ats_experiencia_fallback';
const ENTREVISTAS_LOCAL_KEY = 'ats_entrevistas_fallback';
const TURNOVER_LOCAL_KEY = 'ats_turnover_fallback';


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
    termino1: addDaysToDate('12/04/2026', DIAS_EXPERIENCIA_1),
    termino2: addDaysToDate('12/04/2026', DIAS_EXPERIENCIA_2)
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
    termino1: addDaysToDate('01/03/2026', DIAS_EXPERIENCIA_1),
    termino2: addDaysToDate('01/03/2026', DIAS_EXPERIENCIA_2)
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
    termino1: addDaysToDate('10/05/2026', DIAS_EXPERIENCIA_1),
    termino2: addDaysToDate('10/05/2026', DIAS_EXPERIENCIA_2)
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
  { id: 'to_1', mesAno: '01/2026', totalFuncionarios: 154, totalAdmissao: 8, pediramSair: 3, foramDesligados: 2 },
  { id: 'to_2', mesAno: '02/2026', totalFuncionarios: 157, totalAdmissao: 6, pediramSair: 1, foramDesligados: 2 },
  { id: 'to_3', mesAno: '03/2026', totalFuncionarios: 160, totalAdmissao: 7, pediramSair: 2, foramDesligados: 1 },
  { id: 'to_4', mesAno: '04/2026', totalFuncionarios: 164, totalAdmissao: 9, pediramSair: 4, foramDesligados: 3 },
  { id: 'to_5', mesAno: '05/2026', totalFuncionarios: 168, totalAdmissao: 12, pediramSair: 2, foramDesligados: 2 }
];

const turnoverSort = (a: Turnover, b: Turnover) => {
  const pa = a.mesAno.split('/');
  const pb = b.mesAno.split('/');
  const yearDiff = parseInt(pa[1] || '0', 10) - parseInt(pb[1] || '0', 10);
  if (yearDiff !== 0) return yearDiff;
  return parseInt(pa[0] || '0', 10) - parseInt(pb[0] || '0', 10);
};

export function useOperationalModules(user?: any) {
  const enabled = !!user;

  const treina = useFirestoreCollection<Treinamento>({
    collectionName: 'treinamentos',
    localKey: TREINAMENTOS_LOCAL_KEY,
    seed: initialTreinamentos,
    sort: (a, b) => b.codigo - a.codigo,
    newLocalId: () => `local_t_${Date.now()}`,
    stripOnUpdate: ['codigo'],
    enabled
  });

  const exp = useFirestoreCollection<Experiencia>({
    collectionName: 'experiencia',
    localKey: EXPERIENCIA_LOCAL_KEY,
    seed: initialExperiencia,
    newLocalId: () => `local_exp_${Date.now()}`,
    enabled
  });

  const ent = useFirestoreCollection<Entrevista>({
    collectionName: 'entrevistas',
    localKey: ENTREVISTAS_LOCAL_KEY,
    seed: initialEntrevistas,
    sort: (a, b) => b.codigo - a.codigo,
    newLocalId: () => `local_ent_${Date.now()}`,
    stripOnUpdate: ['codigo'],
    enabled
  });

  const turn = useFirestoreCollection<Turnover>({
    collectionName: 'turnover',
    localKey: TURNOVER_LOCAL_KEY,
    seed: initialTurnover,
    sort: turnoverSort,
    newLocalId: () => `local_to_${Date.now()}`,
    prepend: false,
    enabled
  });

  const loading = treina.loading || exp.loading || ent.loading || turn.loading;

  // ==================== CRUD TREINAMENTOS ====================
  const addTreinamento = (input: Omit<Treinamento, 'id' | 'codigo'>) => {
    const nextCodigo = treina.items.length > 0 ? Math.max(...treina.items.map(t => t.codigo)) + 1 : 101;
    return treina.create({ ...input, codigo: nextCodigo });
  };
  const updateTreinamento = (id: string, updatedFields: Partial<Treinamento>) => treina.update(id, updatedFields);
  const deleteTreinamento = (id: string) => treina.remove(id);

  // ==================== CRUD EXPERIENCIA ====================
  const addExperiencia = (input: Omit<Experiencia, 'id' | 'termino1' | 'termino2'>) =>
    exp.create({
      ...input,
      termino1: addDaysToDate(input.dataAdmissao, DIAS_EXPERIENCIA_1),
      termino2: addDaysToDate(input.dataAdmissao, DIAS_EXPERIENCIA_2)
    });
  const updateExperiencia = (id: string, updatedFields: Partial<Experiencia>) =>
    exp.update(
      id,
      updatedFields.dataAdmissao
        ? {
            ...updatedFields,
            termino1: addDaysToDate(updatedFields.dataAdmissao, DIAS_EXPERIENCIA_1),
            termino2: addDaysToDate(updatedFields.dataAdmissao, DIAS_EXPERIENCIA_2)
          }
        : updatedFields
    );
  const deleteExperiencia = (id: string) => exp.remove(id);

  // Import em lote de experiências (planilha da Universidade): grava termino1/2
  // COMO VIERAM da planilha (lá o 2º período é 75 dias, não os 90 do Colégio).
  // Dedupe por colaborador+admissão+sede contra o que já existe.
  const importExperiencias = async (imported: Omit<Experiencia, 'id'>[]): Promise<{ adicionadas: number; puladas: number }> => {
    const chave = (e: { colaborador: string; dataAdmissao: string; sede?: string }) =>
      `${e.colaborador.toLowerCase().trim()}|${e.dataAdmissao}|${(e.sede || '').toLowerCase()}`;
    const existentes = new Set(exp.items.map(chave));
    const aceitos = imported.filter(e => {
      const k = chave(e);
      if (existentes.has(k)) return false;
      existentes.add(k);
      return true;
    });
    for (const item of aceitos) await exp.create(item as any);
    return { adicionadas: aceitos.length, puladas: imported.length - aceitos.length };
  };

  // ==================== CRUD ENTREVISTAS ====================
  const addEntrevista = (input: Omit<Entrevista, 'id' | 'codigo'>) => {
    const nextCodigo = ent.items.length > 0 ? Math.max(...ent.items.map(e => e.codigo)) + 1 : 301;
    return ent.create({ ...input, codigo: nextCodigo });
  };
  const updateEntrevista = (id: string, updatedFields: Partial<Entrevista>) => ent.update(id, updatedFields);
  const deleteEntrevista = (id: string) => ent.remove(id);

  // ==================== CRUD TURNOVER ====================
  const addTurnover = (input: Omit<Turnover, 'id'>) => turn.create(input);
  const updateTurnover = (id: string, updatedFields: Partial<Turnover>) => turn.update(id, updatedFields);
  const deleteTurnover = (id: string) => turn.remove(id);

  // ==================== IMPORTS (dedup específico) ====================
  const importTreinamentos = async (imported: ImportableTreinamento[], replace = false) => {
    if (imported.length === 0) return;

    if (treina.usingFirebase && db) {
      try {
        if (replace) {
          const snap = await getDocs(collection(db, 'treinamentos'));
          await Promise.all(snap.docs.map((docSnap: any) => deleteDoc(doc(db, 'treinamentos', docSnap.id))));
        }
        const existingCodes = replace ? new Set<number>() : new Set(treina.items.map(t => t.codigo));
        const toCreate = imported.filter(t => !existingCodes.has(t.codigo));
        await Promise.all(toCreate.map(({ id, ...treinamento }: any) => addDoc(collection(db, 'treinamentos'), stripUndefinedFields(treinamento))));
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'treinamentos/import');
      }
    } else {
      const existingCodes = replace ? new Set<number>() : new Set(treina.items.map(t => t.codigo));
      const toCreate = imported
        .filter(t => !existingCodes.has(t.codigo))
        .map((t, index) => ({ id: `local_import_t_${Date.now()}_${index}`, ...t } as Treinamento));
      const updated = (replace ? toCreate : [...toCreate, ...treina.items]).sort((a, b) => b.codigo - a.codigo);
      treina.setItems(updated);
      localStorage.setItem(TREINAMENTOS_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  const importEntrevistas = async (imported: ImportableEntrevista[], replace = false) => {
    if (imported.length === 0) return;

    const dedupKey = (e: { colaborador: string; dataEntrevista: string; funcao: string }) =>
      `${e.colaborador}|${e.dataEntrevista}|${e.funcao}`.toLowerCase();

    if (ent.usingFirebase && db) {
      try {
        if (replace) {
          const snap = await getDocs(collection(db, 'entrevistas'));
          await Promise.all(snap.docs.map((docSnap: any) => deleteDoc(doc(db, 'entrevistas', docSnap.id))));
        }
        const existingKeys = replace ? new Set<string>() : new Set(ent.items.map(dedupKey));
        const toCreate = imported.filter(e => !existingKeys.has(dedupKey(e)));
        await Promise.all(toCreate.map(({ id, ...entrevista }: any) => addDoc(collection(db, 'entrevistas'), stripUndefinedFields(entrevista))));
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'entrevistas/import');
      }
    } else {
      const existingKeys = replace ? new Set<string>() : new Set(ent.items.map(dedupKey));
      const toCreate = imported
        .filter(e => !existingKeys.has(dedupKey(e)))
        .map((e, index) => ({ id: `local_import_ent_${Date.now()}_${index}`, ...e } as Entrevista));
      const updated = (replace ? toCreate : [...toCreate, ...ent.items]).sort((a, b) => b.codigo - a.codigo);
      ent.setItems(updated);
      localStorage.setItem(ENTREVISTAS_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  return {
    treinamentos: treina.items,
    experiencias: exp.items,
    entrevistas: ent.items,
    turnover: turn.items,
    loading,
    addTreinamento,
    updateTreinamento,
    deleteTreinamento,
    importTreinamentos,
    addExperiencia,
    updateExperiencia,
    deleteExperiencia,
    importExperiencias,
    addEntrevista,
    updateEntrevista,
    deleteEntrevista,
    importEntrevistas,
    addTurnover,
    updateTurnover,
    deleteTurnover
  };
}
