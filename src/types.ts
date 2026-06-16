/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Vaga {
  id: string; // Document ID from Firestore
  codigo: number; // Single code
  vaga: string; // Job title
  sede: string; // Branch/Sede
  status: 'ABERTA' | 'FECHADA' | 'PAUSADA' | 'SUSPENSA' | 'DOCUMENTAÇÃO' | 'REABERTA';
  setor: string; // Department
  sexo?: 'INDIFERENTE' | 'FEMININO' | 'MASCULINO';
  solicitacao: string; // Request date (DD/MM/YYYY)
  solicitante: string; // Requesting manager
  motivo?: string; // Reason
  funcionarioSubstituido?: string; // Employee replaced
  etapa?: string; // Recruitment stage
  etapaDesde?: string; // ISO date (YYYY-MM-DD) da última mudança de etapa — base do "dias nesta etapa" no Kanban por etapa
  pausadaDesde?: string; // ISO date em que foi pausada ('' = não pausada). Congela o relógio do SLA.
  diasPausados?: number; // dias acumulados em pausa, descontados do SLA
  aprovado?: string; // Approved candidate
  observacoes?: string; // Notes
  responsavel?: string; // Handler recruiter
  conclusao?: string; // Completion date
  tempoProcesso?: number; // Days spent
  mesSolicitacao?: string; // Month name text
  mesConclusao?: string; // Month name text completion
  categoria?: string; // Category
  tempoSla?: number; // SLA days
  diasEmAberto?: number; // Open days
  ano?: number; // Fiscal year
  categoriaMotivo?: string; // General motive
  // Funil de candidatos (indicadores do processo): chamados x compareceram x aprovados
  candChamados?: number;
  candCompareceram?: number;
  candAprovados?: number;
  motivoDesistencia?: string; // Motivo padronizado de desistência (lista fixa)
}

export interface Treinamento {
  id: string;
  codigo: number;
  dataInicio: string;
  dataTermino?: string;
  mesReferencia: string;
  tema: string;
  tipo: 'Liderança' | 'Integração' | 'Técnico' | 'Operacional' | 'Comportamental';
  facilitador: string;
  publico: string;
  unidade: string;
  cargaHoraria: number;
  qtdPrevista: number;
  qtdRealizada: number;
  totalHorasFormacao: number;
  valorInvestido: number;
}

export interface Experiencia {
  id: string;
  colaborador: string;
  funcao: string;
  setor: string;
  sede?: string;
  dataAdmissao: string;
  supervisor: string;
  observacoes?: string;
  status: 'EM_ANALISE' | 'PRORROGADO' | 'EFETIVADO' | 'ENCERRADO';
  termino1: string; // Calc: +45 days
  termino2: string; // Calc: +90 days
}

export interface Entrevista {
  id: string;
  codigo: number;
  colaborador: string;
  dataEntrevista: string;
  funcao: string;
  unidade: string; // Sector/Branch
  admissao?: string;
  desligamento?: string;
  motivoSaida: string;
  gostavaTrabalho: 'Sim' | 'Não' | 'Parcialmente';
  oqMaisGostava?: string;
  oqMenosGostava?: string;
  notaSalario: number; // 1-5
  notaTreinamento: number; // 1-5
  notaCrescimento: number; // 1-5
  notaRelacionamentoColegas: number; // 1-5
  notaRelacionamentoChefia: number; // 1-5
  notaClimaOrg: number; // 1-5
  voltaria: 'Sim' | 'Não' | 'Talvez';
  sugestoes?: string;
  entrevistador: string;
}

export interface Turnover {
  id: string;
  mesAno: string; // e.g. "05/2026"
  totalFuncionarios: number;
  totalAdmissao: number;
  pediramSair: number;
  foramDesligados: number;
}

export interface RecruiterStats {
  responsavel: string;
  totalVagasConcluidas: number;
  totalVagasAndamento: number;
  tempoMedioFechamento: number;
}

export interface DepartmentStats {
  setor: string;
  totalVagas: number;
  tempoMedioFechamento: number;
  vagasPorStatus: Record<string, number>;
}

export interface BranchStats {
  sede: string;
  totalVagas: number;
  tempoMedioFechamento: number;
}
