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
  origem?: string; // Fonte do registro. Ex.: 'planilha-universidade' (sincronizado de planilha externa; somente-leitura no SGCP). Vazio/ausente = criado no próprio sistema.
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
  hora?: string; // horário da turma (a Universidade roda o mesmo tema em sessões: 13h, 14h…)
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

// Requisição de abertura de vaga (preenchida pelo gestor num formulário público;
// o RH/admin aceita -> vira uma Vaga, ou recusa). Espelha o "Modelo - Requisição".
export interface Requisicao {
  id: string;
  criadaEm: string; // ISO
  cargo: string;
  sede: string;
  setor: string;
  selecao: 'Interna' | 'Externa' | 'Mista';
  tipoContratacao: string; // origem da vaga (substituição, ampliação, temporária...)
  justificativa?: string;
  jornada?: string;
  idade?: string;
  experiencia?: string;
  salarioBeneficios?: string;
  hardSkills?: string;
  softSkills?: string;
  responsabilidades?: string;
  gestorSolicitante: string;
  gestorEmail?: string;
  status: 'pendente' | 'aceita' | 'recusada';
  motivoRecusa?: string;
  decididaEm?: string;  // ISO
  decididaPor?: string; // e-mail do admin que decidiu
  vagaId?: string;      // vaga criada ao aceitar
}

// Treinamento de Integração (onboarding) — módulo EXCLUSIVO da Universidade.
// Espelha a planilha "Treinamento de integração" (uma aba por campus).
export interface Integracao {
  id: string;
  nome: string;            // colaborador
  funcao?: string;
  setor?: string;
  sede: string;            // campus (nome canônico da sede no sistema)
  admissao?: string;       // DD/MM/YYYY
  supervisor?: string;
  status: 'Realizado' | 'Não realizado' | 'Desligado';
  dataIntegracao?: string; // texto livre (ex.: "19/08 às 14h")
  responsavel?: string;    // quem aplicou a integração
  contato?: string;
  observacao?: string;
}

// Cadastro de colaboradores (roster). Base p/ aniversariantes (avisar o RH) e
// futuras features. Datas em DD/MM/YYYY (o ano do nascimento é opcional).
export interface Funcionario {
  id: string;
  nome: string;
  dataNascimento: string; // DD/MM/YYYY ou DD/MM
  sede: string;
  setor?: string;
  cargo?: string;
  admissao?: string;      // DD/MM/YYYY
  ativo?: boolean;        // false = desligado (mantém histórico sem aparecer nos avisos)
  observacoes?: string;
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
