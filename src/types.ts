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
  // Quem tomou a iniciativa do encerramento (só faz sentido em ENCERRADO).
  // 'a_pedido' = o colaborador pediu demissão antes de fechar 45/90 dias.
  // Ausente = encerramentos antigos/importados (iniciativa desconhecida).
  tipoEncerramento?: 'a_pedido' | 'empresa';
  dataPedidoRescisao?: string; // DD/MM/YYYY — data em que o colaborador pediu
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
  // 'form-publico' = respondida pelo próprio ex-colaborador no formulário aberto
  // (/entrevista), sem passar pelo RH. Ausente = registrada por alguém do RH.
  origem?: string;
  // Respondida sem se identificar: `colaborador` vem como 'Anônimo'.
  anonima?: boolean;
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

/**
 * Consulta solicitada por um funcionário do Colégio. Registro simples de fila:
 * quem pediu, o que pediu, quando pediu, se já foi atendido e quando.
 *
 * "Consulta" aqui NÃO tem sentido médico — é só o registro da solicitação.
 * São exatamente os cinco campos pedidos, sem nada além. Funcionário e
 * especialidade são texto livre (não há catálogo de especialidades, e o roster
 * `/funcionarios` ainda não tem tela de cadastro).
 */
export interface Consulta {
  id: string;
  funcionario: string;
  especialidade: string;   // especialidade solicitada
  dataSolicitacao: string; // DD/MM/YYYY
  status: 'No aguardo' | 'Atendido';
  dataAtendimento?: string; // DD/MM/YYYY — só preenchida quando Atendido
}

export interface Turnover {
  id: string;
  mesAno: string; // e.g. "05/2026"
  totalFuncionarios: number;
  totalAdmissao: number;
  pediramSair: number;
  foramDesligados: number;
  /**
   * Unidade do registro. OPCIONAL de propósito: os meses cadastrados antes de
   * 31/08/2026 são consolidados (Colégio + Universidade no mesmo número) e não
   * há como dividi-los depois — ninguém sabe quanto de cada um está ali dentro.
   * Ausente = consolidado; a tela mostra isso em vez de fingir uma unidade.
   *
   * Para separar de verdade, cadastra-se DOIS registros por mês, um de cada
   * unidade. A soma continua dando o total do grupo.
   */
  unidade?: 'colegio' | 'universidade';
}

/**
 * Evento de seleção — um DIA de seleção numa sede, com quantos foram chamados e
 * quantos apareceram. Vem das abas "QUANTI" da planilha de Seleções.
 *
 * Não se liga a uma Vaga de propósito: medido em 27/08/2026, são 220 eventos
 * para 17 vagas pedagógicas, 56 deles com cargo genérico "Professor(a)", e
 * NENHUM cai na mesma data de uma solicitação. A informação que ligaria os dois
 * — qual vaga cada candidato disputava — nunca foi registrada. Ficam como
 * agregado para os indicadores, que é o que a planilha de fato é.
 */
export interface Selecao {
  id: string;
  data: string;            // DD/MM/AAAA — o dia da seleção
  cargo: string;
  sede: string;
  responsavel: string;     // quem do RH conduziu
  origem: 'geral' | 'pedagogico';   // qual aba QUANTI originou
  /** Setor que pediu (a aba GERAL da planilha tem a coluna). Opcional: o histórico importado não tem. */
  setor?: string;
  /** Gestor que pediu a seleção. Opcional, pelo mesmo motivo. */
  gestor?: string;
  convocados: number;
  compareceram: number;
  ausentes: number;
  contratados: number;     // só a aba Geral tem esta coluna; pedagógico vem 0
  desistiram: number;
  /** Motivos de desistência discriminados: { motivo: quantidade }. */
  motivos?: Record<string, number>;
  /**
   * Momento do registro. AUSENTE = realizado: os 220 eventos importados da
   * planilha já tinham acontecido.
   *
   * Existe porque `compareceram: 0` é ambíguo sem ele — um dia agendado que
   * ainda não chegou e um dia em que ninguém apareceu são opostos com o mesmo
   * número. Sem separar, os agendamentos futuros entrariam no funil como 0% e
   * derrubariam a taxa de comparecimento.
   */
  status?: 'agendado' | 'realizado';
  /**
   * Vagas que originaram a convocação, quando agendada a partir delas.
   *
   * É LISTA porque um dia de seleção atende VÁRIAS vagas: chamar 20 pessoas
   * para as 2 vagas de ASG da mesma sede é uma seleção só, não duas. O campo
   * único de antes obrigava a escolher uma vaga e descartar a outra — o vínculo
   * ficava incompleto justamente onde há mais gente envolvida.
   *
   * O vínculo seleção↔vaga foi impossível de reconstruir no histórico (89
   * eventos para 17 vagas, cargo genérico, nenhuma data coincidindo). Quem
   * AGENDA sabe para quais vagas está chamando, então daqui pra frente o
   * vínculo nasce junto. Opcional: no pedagógico chamam "Professor(a)" sem vaga.
   */
  vagaIds?: string[];
  vagaCodigos?: number[];
  /**
   * Os números deste dia saem da lista de candidatos (`numerosDoDia`).
   *
   * Liga quando o primeiro candidato do dia é lançado PELO SISTEMA. Os dias
   * de 2026 importados da planilha têm os nomes só para consulta e ficam sem
   * ele: medido em 23/09/2026, recalcular o passado pela aba nominal derrubava
   * "contratados" de 40 para 24 — a coluna CONTRATADO não era mantida com o
   * mesmo cuidado da QUANTI.
   */
  numerosPelaLista?: boolean;
  /** @deprecated Formato de vínculo único, anterior à lista. Só leitura. */
  vagaId?: string;
  /** @deprecated Ver `vagaCodigos`. */
  vagaCodigo?: number;
}

/**
 * Um candidato convocado para um dia de seleção — as abas nominais da planilha
 * ("GERAL 2026", "PEDAGÓGICO 2026"). Os números do dia saem desta lista: ver
 * `numerosDoDia` em utils/candidatos.
 *
 * ⚠️ Nome de quem não é funcionário e resultado de teste psicológico: a regra
 * do banco deixa só o RH (sem Visualizador) ler.
 */
export interface Candidato {
  id: string;
  selecaoId: string;
  /** DD/MM/AAAA — copiado do dia de seleção, para listar sem buscá-lo. */
  data: string;
  nome: string;
  resultado: import('./utils/candidatos').ResultadoCandidato;
  contratado?: import('./utils/candidatos').Contratacao;
  /** Rótulo do motivo, quando desistiu. */
  motivo?: string;
  observacao?: string;
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
