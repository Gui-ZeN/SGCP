/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { dataISOLocal, formatDateBR } from '../utils/date';
import { Vaga, Experiencia, Selecao, Requisicao, Candidato } from '../types';
import { AddVacancyForm } from './AddVacancyForm';
import { Sede, Cargo, Setor } from '../hooks/useMetadata';
import type { SystemLog } from '../hooks/useLogs';
import { EditVacancyModal } from './EditVacancyModal';
import { ConcludeVacancyModal } from './ConcludeVacancyModal';
import { VagaDetailsDrawer } from './vagas/VagaDetailsDrawer';
import { PauseVagaModal, EtapaMoveModal, DragMoveConfirmModal } from './vagas/VagaModals';
import { CartaoVaga, corEtapa, fundoEtapa } from './vagas/CartaoVaga';
import { FunilModal } from './vagas/FunilModal';
import { ModalSelecao, formularioDaVaga, sugestoesDeSelecoes } from './selecoes/ModalSelecao';
import { candidatosDaVaga, naDocumentacao } from '../utils/funilCandidatos';
import { FiltroMultiplo } from './ui/FiltroMultiplo';
import { Modal } from './ui/Modal';
import {
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  ArrowUpDown,
  Plus,
  Download,
  Settings,
  Users,
  ChevronDown
} from 'lucide-react';
import { exportToXlsx } from '../utils/xlsxExporter';
import { SLA_META_DIAS } from '../constants/hr';
import { ReguaFunil, funilDasVagas } from './vagas/ReguaFunil';
import { parseDateDDMMYYYY, isPausedOrSuspended, getDiasEmAberto, ETAPAS_FUNIL, normalizeEtapa, diasNestaEtapa, statusForEtapa, vagaAtrasada } from '../utils/vaga';
import { funilDaVaga, funilEfetivo, selecoesDaVaga, atendeVaga, camposDoFormulario, type FunilDaVaga } from '../utils/selecao';

interface VacancyTableProps {
  vagas: Vaga[];
  updateVaga: (id: string, updatedFields: Partial<Vaga>) => Promise<void>;
  deleteVaga: (id: string) => Promise<void>;
  addVaga: (vaga: Omit<Vaga, 'id' | 'codigo'>) => Promise<void>;
  addExperiencia?: (input: Omit<Experiencia, 'id' | 'termino1' | 'termino2'>) => Promise<void>;
  sedes?: Sede[];
  cargos?: Cargo[];
  setores?: Setor[];
  /** Criar setor direto do formulário de nova vaga. Ausente = sem o botão. */
  addSetor?: (nome: string) => Promise<void>;
  isAdmin?: boolean;
  confirmAction?: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
  triggerAddModal?: number;
  userSede?: string;
  userRole?: string;
  // Foco vindo do Home (alerta de SLA): filtra a tabela pela vaga (token muda a cada clique).
  focusVaga?: { codigo: string; token: number } | null;
  // Logs de auditoria (só carregados para admin) — usados na timeline do painel de detalhes.
  logs?: SystemLog[];
  /**
   * Seleções do escopo. Vaga com seleção ligada tem o funil calculado delas
   * (decisão de 23/09/2026: automático) — ninguém digita chamados/compareceram/
   * aprovados. Sem seleção ligada, o funil segue digitado como antes.
   */
  selecoes?: Selecao[];
  /** Abrir uma seleção no módulo Seleções, já nos candidatos. */
  abrirSelecao?: (id: string) => void;
  /** Requisições (só admin): mostram nos detalhes de qual requisição a vaga veio. */
  requisicoes?: Requisicao[];
  /** Mostra "Nova seleção para esta vaga" nos detalhes. */
  podeVerSelecoes?: boolean;
  /**
   * O funil de candidatos conduzido pelo Kanban (08/10/2026). Sem eles (quem
   * não lê candidatos), as passagens movem a vaga como antes.
   */
  candidatos?: Candidato[];
  /** O formulário único de seleção (Triagem → Entrevista): cria a seleção ligada à vaga, com os nomes. */
  criarSelecao?: (campos: Omit<Selecao, 'id'>, nomes: string[]) => Promise<void>;
  responsavelPadrao?: string;
  registrarCandidatos?: (selecao: Selecao, nomes: string[]) => Promise<void>;
  atualizarCandidatos?: (alteracoes: { candidato: Candidato; campos: Partial<Candidato> }[], resumo: string) => Promise<void>;
}

export const VacancyTable: React.FC<VacancyTableProps> = ({ 
  vagas, 
  updateVaga, 
  deleteVaga,
  addVaga,
  addExperiencia,
  sedes,
  cargos,
  setores,
  addSetor,
  isAdmin = false,
  confirmAction,
  triggerAddModal,
  userSede,
  userRole,
  focusVaga,
  logs,
  selecoes = [],
  abrirSelecao,
  requisicoes,
  podeVerSelecoes = false,
  candidatos,
  criarSelecao,
  responsavelPadrao = '',
  registrarCandidatos,
  atualizarCandidatos
}) => {
  const canManageVagas = isAdmin || userRole === 'Analista' || userRole === 'Administrador';
  // Os nomes já usados entram nas sugestões do formulário: o cadastro de
  // cargos sozinho cobre uma fração do que o RH abre de verdade.
  const nomesDeVagaUsados = useMemo(() => vagas.map(v => v.vaga), [vagas]);
  const getSedeLabel = (nome: string) => {
    const matched = sedes?.find(s => s.nome.toLowerCase() === nome.toLowerCase());
    return matched && matched.sigla ? `${matched.nome} (${matched.sigla})` : nome;
  };

  const getSedeSigla = (nome: string) => {
    const matched = sedes?.find(s => s.nome.toLowerCase() === nome.toLowerCase());
    return matched && matched.sigla ? matched.sigla : nome;
  };

  // Advanced Filter state
  const [searchTerm, setSearchTerm] = useState('');
  // Todo filtro é de múltipla escolha (regra desde 08/10/2026). Lista vazia = todos.
  const [selectedSede, setSelectedSede] = useState<string[]>(() => !isAdmin && userSede ? [userSede] : []);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [selectedSetor, setSelectedSetor] = useState<string[]>([]);

  useEffect(() => {
    if (!isAdmin && userSede) {
      setSelectedSede([userSede]);
    }
  }, [userSede, isAdmin]);
  const sedeMarcada = (v: Vaga) => selectedSede.length === 0 || selectedSede.some(s => (v.sede || '').toLowerCase() === s.toLowerCase());

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; // Dense but cozy layout

  // Sorting state
  const [sortBy, setSortBy] = useState<'codigo' | 'vaga' | 'tempoProcesso'>('codigo');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // New visual and process UI states
  const [viewMode, setViewMode] = useState<'kanban' | 'tabela' | 'grade'>('kanban');
  // Agrupamento do Kanban. Abre POR ETAPA: é a visão que responde "onde esta
  // vaga está travando", que é a pergunta de quem está tocando as Seleções. Por
  // status continua a um clique, para quem quer o retrato administrativo.
  const [kanbanGroupBy, setKanbanGroupBy] = useState<'status' | 'etapa'>('etapa');
  const [showConcluidasEtapa, setShowConcluidasEtapa] = useState(false);
  const [selectedDetailsVaga, setSelectedDetailsVaga] = useState<Vaga | null>(null);
  // Botões de filtro: somam entre si (Em andamento + Atrasadas…). Nenhum = todas.
  const [statusGroupFilter, setStatusGroupFilter] = useState<('ATIVAS' | 'CONCLUIDAS' | 'ALERTA_SLA')[]>([]);

  // Foco vindo de outra tela (#/vagas?vaga=124): filtra pela vaga (o código é
  // único), limpa os demais filtros pra ela não ficar escondida e já abre os
  // detalhes. token muda a cada clique → re-aplica.
  useEffect(() => {
    if (focusVaga && focusVaga.codigo) {
      setSearchTerm(focusVaga.codigo);
      setStatusGroupFilter([]);
      setSelectedStatus([]);
      setSelectedSetor([]);
      setSelectedSede(!isAdmin && userSede ? [userSede] : []);
      setCurrentPage(1);
      const alvo = vagas.find(v => String(v.codigo) === focusVaga.codigo);
      if (alvo) setSelectedDetailsVaga(alvo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusVaga?.token]);

  // Drag and drop states for Kanban Funnel
  const [draggedOverLaneId, setDraggedOverLaneId] = useState<string | null>(null);
  const [draggingVagaId, setDraggingVagaId] = useState<string | null>(null);

  // Edit modal state (original)
  const [showAddVagaModal, setShowAddVagaModal] = useState(false);
  
  useEffect(() => {
    if (triggerAddModal && triggerAddModal > 0) {
      setShowAddVagaModal(true);
    }
  }, [triggerAddModal]);

  const [editingVaga, setEditingVaga] = useState<Vaga | null>(null);
  const [selecaoDaVaga, setSelecaoDaVaga] = useState<FunilDaVaga | null>(null);

  const [dragMoveConfirm, setDragMoveConfirm] = useState<{
    vagaId: string;
    laneId: string;
    vagaTitle: string;
    vagaCodigo: string;
    oldLaneTitle: string;
    newLaneTitle: string;
  } | null>(null);

  // Modal para confirmar a DATA da pausa (nem sempre se registra no mesmo dia).
  const [vagaToPause, setVagaToPause] = useState<Vaga | null>(null);
  const [pauseDateISO, setPauseDateISO] = useState('');
  const openPauseModal = (v: Vaga) => {
    setVagaToPause(v);
    setPauseDateISO(dataISOLocal());
  };

  // Modal de transição de etapa (Kanban por etapa): ao mover, confirma os números
  // do funil (chamou x veio x aprovou) e o motivo de desistência, se houve.
  const [etapaMove, setEtapaMove] = useState<{ vaga: Vaga; novaEtapa: string; tipo: 'funil' | 'desistencia' } | null>(null);
  const [moveChamados, setMoveChamados] = useState(0);
  const [moveCompareceram, setMoveCompareceram] = useState(0);
  const [moveAprovados, setMoveAprovados] = useState(0);
  const [moveMotivo, setMoveMotivo] = useState('');
  const [funilAuto, setFunilAuto] = useState(false);
  const openEtapaMove = (vaga: Vaga, novaEtapa: string, tipo: 'funil' | 'desistencia') => {
    const daSelecao = funilDaVaga(selecoes, vaga);
    const efetivo = funilEfetivo(vaga, selecoes);
    if (efetivo.fonte === 'selecao') {
      // Automático: mostra a soma das seleções, só leitura, e não grava na vaga.
      setSelecaoDaVaga(null);
      setFunilAuto(true);
      setEtapaMove({ vaga, novaEtapa, tipo });
      setMoveChamados(efetivo.chamados); setMoveCompareceram(efetivo.compareceram); setMoveAprovados(efetivo.aprovados);
      setMoveMotivo(vaga.motivoDesistencia || '');
      return;
    }
    setFunilAuto(false);
    // Pré-preenche SÓ quando a vaga ainda não tem número próprio. Se o RH já
    // digitou algo, o que ele escreveu fica — os números da seleção viram uma
    // sugestão com botão, em vez de apagarem o trabalho dele por baixo.
    const vazia = !vaga.candChamados && !vaga.candCompareceram && !vaga.candAprovados;
    const usarSelecao = vazia && daSelecao.selecoes > 0;

    setSelecaoDaVaga(daSelecao.selecoes > 0 ? daSelecao : null);
    setEtapaMove({ vaga, novaEtapa, tipo });
    setMoveChamados(usarSelecao ? daSelecao.chamados : (vaga.candChamados || 0));
    setMoveCompareceram(usarSelecao ? daSelecao.compareceram : (vaga.candCompareceram || 0));
    setMoveAprovados(usarSelecao ? daSelecao.aprovados : (vaga.candAprovados || 0));
    setMoveMotivo(vaga.motivoDesistencia || '');
  };

  const aplicarNumerosDaSelecao = () => {
    if (!selecaoDaVaga) return;
    setMoveChamados(selecaoDaVaga.chamados);
    setMoveCompareceram(selecaoDaVaga.compareceram);
    setMoveAprovados(selecaoDaVaga.aprovados);
  };
  const confirmEtapaMove = async () => {
    if (!etapaMove) return;
    const { vaga, novaEtapa, tipo } = etapaMove;
    setEtapaMove(null);
    // updateVaga carimba etapaDesde sozinho quando a etapa muda. Sincroniza o
    // status (mantém o "Por status" coerente) quando aplicável.
    const novoStatus = statusForEtapa(vaga.status, novaEtapa);
    const base: any = novoStatus ? { etapa: novaEtapa, status: novoStatus } : { etapa: novaEtapa };
    if (tipo === 'funil' && funilAuto) {
      await updateVaga(vaga.id, base);
    } else if (tipo === 'funil') {
      await updateVaga(vaga.id, {
        ...base,
        candChamados: Number(moveChamados) || 0,
        candCompareceram: Number(moveCompareceram) || 0,
        candAprovados: Number(moveAprovados) || 0
      });
    } else {
      await updateVaga(vaga.id, { ...base, motivoDesistencia: moveMotivo });
    }
  };

  const getLaneIdFromVaga = (v: Vaga): string => {
    if (v.status === 'ABERTA' || v.status === 'REABERTA') return 'lane-aberta';
    if (v.status === 'DOCUMENTAÇÃO') return 'lane-doc';
    if (v.status === 'PAUSADA' || v.status === 'SUSPENSA') return 'lane-paused';
    if (v.status === 'FECHADA') return 'lane-closed';
    return 'lane-aberta';
  };

  const handleDragDrop = async (vagaId: string, laneId: string) => {
    const targetVaga = vagas.find(v => v.id === vagaId);
    if (!targetVaga) return;

    const currentLaneId = getLaneIdFromVaga(targetVaga);
    if (currentLaneId === laneId) return; // No real change

    if (laneId === 'lane-closed') {
      // Conclude vacancy flow (has its own full form modal/confirmation)
      handleOpenConcludeModal(targetVaga);
      return;
    }

    if (laneId === 'lane-paused') {
      // Pausar tem modal próprio para confirmar a data da pausa
      openPauseModal(targetVaga);
      return;
    }

    const laneTitles: Record<string, string> = {
      'lane-aberta': 'Ativas / Abertas',
      'lane-doc': 'Admissão / Doc',
      'lane-paused': 'Pausada / Suspensa',
      'lane-closed': 'Concluídas / Fechadas'
    };

    setDragMoveConfirm({
      vagaId,
      laneId,
      vagaTitle: targetVaga.vaga,
      vagaCodigo: String(targetVaga.codigo ?? ''),
      oldLaneTitle: laneTitles[currentLaneId] || targetVaga.status,
      newLaneTitle: laneTitles[laneId] || laneId,
    });
  };

  const executeDragDrop = async (vagaId: string, laneId: string) => {
    const targetVaga = vagas.find(v => v.id === vagaId);
    if (!targetVaga) return;

    if (laneId === 'lane-aberta') {
      if (targetVaga.status !== 'ABERTA' && targetVaga.status !== 'REABERTA') {
        await updateVaga(vagaId, { status: 'ABERTA' });
      }
    } else if (laneId === 'lane-doc') {
      if (targetVaga.status !== 'DOCUMENTAÇÃO') {
        await updateVaga(vagaId, { status: 'DOCUMENTAÇÃO', etapa: 'Contratação / Docs' });
      }
    } else if (laneId === 'lane-paused') {
      if (targetVaga.status !== 'PAUSADA' && targetVaga.status !== 'SUSPENSA') {
        await updateVaga(vagaId, { status: 'PAUSADA' });
      }
    }
  };

  // 1A. STATE DEFINITIONS FOR THE NEW REFINED COMPLETION DIALOG (UX INTERACTION)
  const [vagaToConclude, setVagaToConclude] = useState<Vaga | null>(null);

  // parseDateDDMMYYYY, getDiasEmAberto, isPausedOrSuspended, ETAPAS_FUNIL,
  // normalizeEtapa, diasNestaEtapa e getSlaInfo agora vêm de ../utils/vaga.

  // Arrastar entre colunas no board por etapa. Só a transição Triagem → Entrevista
  // abre o modal de funil (chamou x veio x aprovou + motivo de desistência); as
  // demais movem direto (etapaDesde é carimbado pelo updateVaga).
  const podeConduzirFunil = canManageVagas && !!candidatos && !!criarSelecao && !!registrarCandidatos && !!atualizarCandidatos;
  // Triagem → Entrevista sem entrevista agendada: o formulário único, com a vaga marcada.
  const [entrevistaPara, setEntrevistaPara] = useState<Vaga | null>(null);
  const [funilMove, setFunilMove] = useState<{ vaga: Vaga; de: string; para: 'Entrevista' | 'Testes' | 'Documentação' } | null>(null);
  const moverParaEtapa = async (v: Vaga, etapa: string) => {
    const novoStatus = statusForEtapa(v.status, etapa);
    await updateVaga(v.id, novoStatus ? { etapa, status: novoStatus } : { etapa });
  };

  const handleEtapaDrop = async (vagaId: string, etapa: string) => {
    const v = vagas.find(x => x.id === vagaId);
    if (!v) return;
    const atual = normalizeEtapa(v);
    if (atual === etapa) return;
    const ordem = ETAPAS_FUNIL as readonly string[];
    const atualIdx = ordem.indexOf(atual);
    const destinoIdx = ordem.indexOf(etapa);
    // Retorno (etapa anterior): registra o motivo de desistência.
    if (atualIdx >= 0 && destinoIdx >= 0 && destinoIdx < atualIdx) {
      openEtapaMove(v, etapa, 'desistencia');
      return;
    }
    // Avanço para Entrevista, Testes ou Documentação: o modal do funil de
    // candidatos (marca a entrevista, quem veio, quem vai para os testes, quem
    // segue). Pular etapa pode: o modal avisa.
    if (podeConduzirFunil && (etapa === 'Entrevista' || etapa === 'Testes' || etapa === 'Documentação')) {
      const temAgendada = selecoesDaVaga(selecoes, v).some(s => s.status === 'agendado');
      if (etapa === 'Entrevista' && !temAgendada) setEntrevistaPara(v);
      else setFunilMove({ vaga: v, de: atual, para: etapa });
      return;
    }
    // Sem acesso aos candidatos: Triagem → Entrevista confirma os números, como antes.
    if (atual === 'Triagem' && etapa === 'Entrevista') {
      openEtapaMove(v, etapa, 'funil');
      return;
    }
    // Demais avanços: move direto (sincroniza o status quando aplicável).
    const novoStatus = statusForEtapa(v.status, etapa);
    await updateVaga(vagaId, novoStatus ? { etapa, status: novoStatus } : { etapa });
  };

  // 1B. DIALOG HANDLERS TO REMOVE BROWSER PROMPTS (UPGRADING RECRUITER EXPERIENCE)
  // Quem está na documentação desta vaga (se for uma pessoa só): o "Concluir"
  // já vem com o nome dela, e ela vira "contratada" na seleção.
  const escolhidoParaConcluir = (() => {
    if (!vagaToConclude || !candidatos) return undefined;
    const lista = naDocumentacao(candidatosDaVaga(vagaToConclude, selecoes, candidatos), vagaToConclude.id);
    return lista.length === 1 ? lista[0] : undefined;
  })();

  const handleOpenConcludeModal = (vaga: Vaga) => {
    setVagaToConclude(vaga);
  };

  const handleSaveConclusion = async (
    vagaId: string, 
    candidato: string, 
    dataConclusaoStr: string, 
    dataAdmissaoStr: string, 
    observacoes: string, 
    adicionarNaExperiencia: boolean
  ) => {
    // Generate dates based on input
    let formattedDate = '';
    
    if (dataConclusaoStr) {
      const parts = dataConclusaoStr.split('-');
      if (parts.length === 3) {
        formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    } else {
      formattedDate = new Date().toLocaleDateString('pt-BR');
    }

    let finalAdmissao = formattedDate;
    if (dataAdmissaoStr) {
      const parts = dataAdmissaoStr.split('-');
      if (parts.length === 3) {
        finalAdmissao = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }

    const daysOpen = getDiasEmAberto(vagaToConclude!);

    const updatedFields = {
      status: 'FECHADA' as const,
      aprovado: candidato.trim(),
      conclusao: formattedDate,
      etapa: 'Processo Concluído',
      tempoProcesso: vagaToConclude!.tempoProcesso || daysOpen,
      observacoes: observacoes.trim()
    };

    await updateVaga(vagaId, updatedFields);

    // A pessoa da documentação que foi aprovada vira "contratada" na seleção:
    // os números de contratados saem da lista, sem digitar de novo.
    if (escolhidoParaConcluir && atualizarCandidatos && escolhidoParaConcluir.nome.trim().toLowerCase() === candidato.trim().toLowerCase()) {
      await atualizarCandidatos(
        [{ candidato: escolhidoParaConcluir, campos: { contratado: 'sim' } }],
        `${escolhidoParaConcluir.nome} contratado(a) na vaga #${vagaToConclude!.codigo}.`
      );
    }
    
    if (adicionarNaExperiencia && addExperiencia && vagaToConclude) {
      await addExperiencia({
        colaborador: candidato.trim(),
        funcao: vagaToConclude.vaga,
        setor: vagaToConclude.setor || '',
        sede: vagaToConclude.sede,
        dataAdmissao: finalAdmissao,
        supervisor: vagaToConclude.solicitante || '', // Requester as default supervisor
        status: 'EM_ANALISE',
        observacoes: observacoes.trim(),
        // De qual vaga veio: a Experiência mostra o link e a vaga leva até a pessoa.
        vagaId: vagaToConclude.id,
        vagaCodigo: vagaToConclude.codigo,
      });
    }

    setVagaToConclude(null);
    if (selectedDetailsVaga && selectedDetailsVaga.id === vagaId) {
      setSelectedDetailsVaga({
        ...selectedDetailsVaga,
        ...updatedFields
      });
    }
  };

  const startEditing = (vaga: Vaga) => {
    setEditingVaga(vaga);
  };

  const handleEditSave = async (id: string, updatedFields: Partial<Vaga>) => {
    await updateVaga(id, updatedFields);
    
    if (selectedDetailsVaga && selectedDetailsVaga.id === id) {
      setSelectedDetailsVaga({ ...selectedDetailsVaga, ...updatedFields });
    }
  };

  // 2. AGGREGATING ADVANCED KPIS (Respects selected Sede)
  const stats = useMemo(() => {
    const relevantVagas = vagas.filter(sedeMarcada);

    const total = relevantVagas.length;
    let ativas = 0;
    let concluidas = 0;
    let atrasadas = 0;
    let somaTempoConclusao = 0;
    let countConcluidasComTempo = 0;

    relevantVagas.forEach(v => {
      const days = getDiasEmAberto(v);
      if (v.status === 'FECHADA') {
        concluidas++;
        if (v.tempoProcesso) {
          somaTempoConclusao += v.tempoProcesso;
          countConcluidasComTempo++;
        }
      } else {
        if (v.status === 'ABERTA' || v.status === 'REABERTA' || v.status === 'DOCUMENTAÇÃO') {
          ativas++;
        }
        if (diasNestaEtapa(v) > SLA_META_DIAS && !isPausedOrSuspended(v.status)) {
          atrasadas++;
        }
      }
    });

    const tempoMedio = countConcluidasComTempo > 0 
      ? Math.round(somaTempoConclusao / countConcluidasComTempo) 
      : 0;

    return { total, ativas, concluidas, atrasadas, tempoMedio };
  }, [vagas, selectedSede, userSede, isAdmin]);

  // Derive unique options for filter dropdowns safely
  const sedesList = useMemo(() => {
    let list: string[] = [];
    if (sedes && sedes.length > 0) {
      list = [...sedes.map(s => s.nome)];
    } else {
      const unique = vagas.map(v => v.sede).filter(Boolean);
      list = Array.from(new Set(unique));
    }

    list.sort((a, b) => {
      if (userSede) {
        if (a.toLowerCase() === userSede.toLowerCase()) return -1;
        if (b.toLowerCase() === userSede.toLowerCase()) return 1;
      }
      return a.localeCompare(b);
    });
    return list;
  }, [vagas, sedes, userSede]);

  const setoresList = useMemo(() => {
    if (setores && setores.length > 0) {
      return [...setores.map(s => s.nome)].sort((a, b) => a.localeCompare(b));
    }
    const list = vagas.map(v => v.setor).filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [vagas, setores]);

  const statusList = ['ABERTA', 'FECHADA', 'PAUSADA', 'SUSPENSA', 'DOCUMENTAÇÃO', 'REABERTA'];

  // Handle row sorting
  const handleSort = (field: 'codigo' | 'vaga' | 'tempoProcesso') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Filter & Sort Logic
  const filteredVagas = useMemo(() => {
    let result = [...vagas];

    // Text search (case insensitive)
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter(v => 
        (v.vaga && v.vaga.toLowerCase().includes(term)) ||
        (v.solicitante && v.solicitante.toLowerCase().includes(term)) ||
        (v.codigo && v.codigo.toString().includes(term)) ||
        (v.setor && v.setor.toLowerCase().includes(term))
      );
    }

    // Branch filter
    result = result.filter(sedeMarcada);

    // Status filter
    if (selectedStatus.length) {
      result = result.filter(v => selectedStatus.includes(v.status));
    }

    // Sector filter
    if (selectedSetor.length) {
      result = result.filter(v => selectedSetor.includes(v.setor));
    }

    // Modern KPI Groups Filter
    if (statusGroupFilter.length) {
      const grupo = {
        ATIVAS: (v: Vaga) => v.status === 'ABERTA' || v.status === 'REABERTA' || v.status === 'DOCUMENTAÇÃO',
        CONCLUIDAS: (v: Vaga) => v.status === 'FECHADA',
        ALERTA_SLA: vagaAtrasada,
      };
      result = result.filter(v => statusGroupFilter.some(g => grupo[g](v)));
    }

    // Sorting implementation
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'codigo') {
        comparison = a.codigo - b.codigo;
      } else if (sortBy === 'vaga') {
        comparison = (a.vaga || '').localeCompare(b.vaga || '');
      } else if (sortBy === 'tempoProcesso') {
        comparison = (a.tempoProcesso || 0) - (b.tempoProcesso || 0);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [vagas, searchTerm, selectedSede, selectedStatus, selectedSetor, sortBy, sortOrder, statusGroupFilter, userSede, isAdmin]);

  // Paginated chunk
  const paginatedVagas = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredVagas.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredVagas, currentPage]);

  const totalPages = Math.ceil(filteredVagas.length / itemsPerPage) || 1;

  // Régua do funil: segue os filtros da tela (sede, setor, busca).
  const funil = useMemo(() => funilDasVagas(filteredVagas), [filteredVagas]);

  // Exporta as vagas filtradas para um .xlsx formatado (cabecalho em negrito com
  // fundo, colunas tipadas e larguras, primeira linha fixa), usando
  // write-excel-file (mesmo autor do read-excel-file ja usado no import).
  const handleExportXLSX = async () => {
    const columns = [
      { title: 'Código', width: 10 },
      { title: 'Cargo/Vaga', width: 30 },
      { title: 'Sede', width: 16 },
      { title: 'Status', width: 16 },
      { title: 'Setor', width: 20 },
      { title: 'Sexo Preferencial', width: 18 },
      { title: 'Data Solicitação', width: 16 },
      { title: 'Solicitante', width: 22 },
      { title: 'Motivo', width: 26 },
      { title: 'Funcionário Substituído', width: 26 },
      { title: 'Etapa Atual', width: 24 },
      { title: 'Candidato Aprovado', width: 26 },
      { title: 'Recruiter Responsável', width: 22 },
      { title: 'Data Conclusão', width: 16 },
      { title: 'Dias Processo (SLA)', width: 16 },
      { title: 'Observações', width: 44 },
      { title: 'Cand. Chamados', width: 15 },
      { title: 'Compareceram', width: 15 },
      { title: 'Aprovados', width: 13 },
      { title: 'Motivo Desistência', width: 26 }
    ];

    const dataRows = filteredVagas.map(v => {
      const sla = Number(v.tempoProcesso || getDiasEmAberto(v)) || null;
      return [
        { type: Number, value: v.codigo ?? null },
        { type: String, value: v.vaga || null },
        { type: String, value: v.sede || null },
        { type: String, value: v.status || null },
        { type: String, value: v.setor || null },
        { type: String, value: v.sexo || 'INDIFERENTE' },
        { type: String, value: v.solicitacao || null },
        { type: String, value: v.solicitante || null },
        { type: String, value: v.motivo || null },
        { type: String, value: v.funcionarioSubstituido || null },
        { type: String, value: v.etapa || null },
        { type: String, value: v.aprovado || null },
        { type: String, value: v.responsavel || null },
        { type: String, value: v.conclusao || null },
        { type: Number, value: sla },
        { type: String, value: v.observacoes || null },
        ...(f => [
          { type: Number, value: f.fonte === 'selecao' ? f.chamados : (v.candChamados ?? null) },
          { type: Number, value: f.fonte === 'selecao' ? f.compareceram : (v.candCompareceram ?? null) },
          { type: Number, value: f.fonte === 'selecao' ? f.aprovados : (v.candAprovados ?? null) },
        ])(funilEfetivo(v, selecoes)),
        { type: String, value: v.motivoDesistencia || null }
      ];
    });

    try {
      await exportToXlsx(`relatorio_de_vagas_rh_${new Date().toISOString().slice(0, 10)}.xlsx`, columns, dataRows, { sheet: 'Vagas' });
    } catch (err) {
      console.error('Erro ao exportar XLSX:', err);
      alert('Não foi possível gerar o arquivo Excel. Tente novamente.');
    }
  };

  // Etiqueta de status (tabela e gaveta de detalhes). Sempre com texto; a cor só reforça.
  const getStatusBadge = (status: Vaga['status']) => {
    const [rotulo, cor, fundo] = ({
      ABERTA: ['Aberta', 'var(--etapa-entrevista)', 'var(--etapa-entrevista-fundo)'],
      REABERTA: ['Reaberta', 'var(--etapa-entrevista)', 'var(--etapa-entrevista-fundo)'],
      FECHADA: ['Concluída', 'var(--etapa-admissao)', 'var(--etapa-admissao-fundo)'],
      PAUSADA: ['Pausada', 'var(--etapa-pausa)', 'var(--etapa-pausa-fundo)'],
      SUSPENSA: ['Suspensa', 'var(--etapa-pausa)', 'var(--etapa-pausa-fundo)'],
      'DOCUMENTAÇÃO': ['Admissão', 'var(--etapa-documentacao)', 'var(--etapa-documentacao-fundo)'],
    } as Record<string, [string, string, string]>)[status] ?? [status, 'var(--tinta-2)', 'var(--superficie)'];
    return <span className="etiqueta" style={{ color: cor, background: fundo }}>{rotulo}</span>;
  };

  // ── Visual novo (rework 10/2026) ─────────────────────────────────────────
  // Um seletor só para as quatro visões (antes eram dois controles separados).
  const modo = viewMode === 'kanban' ? kanbanGroupBy : viewMode;
  const mudarModo = (m: 'etapa' | 'status' | 'tabela' | 'grade') => {
    if (m === 'etapa' || m === 'status') { setViewMode('kanban'); setKanbanGroupBy(m); }
    else setViewMode(m);
    setCurrentPage(1);
  };
  const filtrosAtivos = !!(searchTerm || selectedSede.length || selectedSetor.length || selectedStatus.length || statusGroupFilter.length);
  const limparFiltros = () => {
    setSearchTerm('');
    setSelectedSede(!isAdmin && userSede ? [userSede] : []);
    setSelectedSetor([]);
    setSelectedStatus([]);
    setStatusGroupFilter([]);
    setCurrentPage(1);
  };
  const abrirNovaVaga = () => {
    if (!canManageVagas) {
      alert('Só Administradores e Analistas podem criar vagas.');
      return;
    }
    setShowAddVagaModal(true);
  };
  const ROTULO_CURTO: Record<string, string> = { 'Aguardando admissão': 'Admissão' };
  const excluirVaga = (vaga: Vaga) => {
    const msg = `Excluir a vaga nº ${vaga.codigo} (${vaga.vaga})? Não dá para desfazer.`;
    if (confirmAction) confirmAction('Excluir vaga', msg, () => deleteVaga(vaga.id));
    else if (confirm(msg)) deleteVaga(vaga.id);
  };
  const arrastar = (vaga: Vaga) => ({
    arrastando: draggingVagaId === vaga.id,
    onDragStart: (e: React.DragEvent) => {
      if (!canManageVagas) return;
      e.dataTransfer.setData('text/plain', vaga.id);
      setDraggingVagaId(vaga.id);
    },
    onDragEnd: () => setDraggingVagaId(null),
  });
  const soltarEm = (alvo: string, aoSoltar: (vagaId: string) => void) => ({
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDragEnter: () => setDraggedOverLaneId(alvo),
    onDragLeave: () => { if (draggedOverLaneId === alvo) setDraggedOverLaneId(null); },
    onDrop: (e: React.DragEvent) => {
      setDraggedOverLaneId(null);
      if (!canManageVagas) return;
      aoSoltar(e.dataTransfer.getData('text/plain'));
    },
  });
  // Cartão nas visões que contam o tempo TOTAL em aberto (por status e cartões).
  const cartaoPorTempoAberto = (vaga: Vaga, cor: string, comArrasto = false) => (
    <CartaoVaga
      key={vaga.id}
      vaga={vaga}
      sigla={getSedeSigla(vaga.sede)}
      dias={getDiasEmAberto(vaga)}
      rotuloDias="em aberto"
      pausada={isPausedOrSuspended(vaga.status)}
      cor={cor}
      podeGerir={canManageVagas}
      abrir={() => setSelectedDetailsVaga(vaga)}
      editar={() => startEditing(vaga)}
      pausar={() => openPauseModal(vaga)}
      retomar={() => updateVaga(vaga.id, { status: 'ABERTA' })}
      avancar={vaga.status === 'ABERTA' || vaga.status === 'REABERTA'
        ? { rotulo: 'Para Admissão', cor: 'var(--etapa-documentacao)', acao: () => updateVaga(vaga.id, { status: 'DOCUMENTAÇÃO', etapa: 'Contratação / Docs' }) }
        : undefined}
      concluir={vaga.status === 'DOCUMENTAÇÃO' ? () => handleOpenConcludeModal(vaga) : undefined}
      {...(comArrasto ? arrastar(vaga) : {})}
    />
  );
  const paginacao = totalPages > 1 && (
    <div className="paginacao">
      <span>Página {currentPage} de {totalPages} · {filteredVagas.length} vagas</span>
      <div className="flex gap-2">
        <button type="button" className="btn btn-sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}><ChevronLeft />Anterior</button>
        <button type="button" className="btn btn-sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}>Próxima<ChevronRight /></button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <header className="pagina-cab">
        <div>
          <p className="pagina-trilha">Recrutamento › Vagas</p>
          <h2 className="pagina-titulo">Quadro de Vagas</h2>
        </div>
        <div className="pagina-acoes">
          <div className="seg" role="group" aria-label="Como mostrar as vagas">
            {([['etapa', 'Por etapa'], ['status', 'Por status'], ['tabela', 'Tabela'], ['grade', 'Cartões']] as const).map(([id, rotulo]) => (
              <button key={id} type="button" aria-pressed={modo === id} onClick={() => mudarModo(id)}>{rotulo}</button>
            ))}
          </div>
          <button type="button" className="btn" onClick={handleExportXLSX} title="Baixa as vagas filtradas numa planilha .xlsx"><Download />Exportar</button>
          <button type="button" className="btn btn-primario" onClick={abrirNovaVaga}><Plus />Nova vaga</button>
        </div>
      </header>

      {/* Régua do funil: quantas vagas há em cada etapa, na cor da etapa. */}
      <ReguaFunil funil={funil} complemento={stats.tempoMedio > 0 && <> · fechar uma vaga leva {stats.tempoMedio} dias, em média</>} />

      <div className="filtros">
        <button type="button" className="chip" aria-pressed={statusGroupFilter.length === 0} onClick={() => { setStatusGroupFilter([]); setCurrentPage(1); }}>
          Todas <b>{stats.total}</b>
        </button>
        {([
          ['ATIVAS', 'Em andamento', stats.ativas],
          ['ALERTA_SLA', 'Atrasadas', stats.atrasadas],
          ['CONCLUIDAS', 'Concluídas', stats.concluidas],
        ] as const).map(([id, rotulo, n]) => (
          <button
            key={id}
            type="button"
            className="chip"
            aria-pressed={statusGroupFilter.includes(id)}
            onClick={() => { setStatusGroupFilter(g => g.includes(id) ? g.filter(x => x !== id) : [...g, id]); setCurrentPage(1); }}
          >
            {rotulo} <b>{n}</b>
          </button>
        ))}
        <FiltroMultiplo
          rotulo="Sede"
          todos="todas"
          opcoes={sedesList.map(s => ({ valor: s, rotulo: getSedeSigla(s) }))}
          selecionados={selectedSede}
          onChange={v => { setSelectedSede(v); setCurrentPage(1); }}
        />
        <FiltroMultiplo
          rotulo="Setor"
          opcoes={setoresList.map(s => ({ valor: s, rotulo: s }))}
          selecionados={selectedSetor}
          onChange={v => { setSelectedSetor(v); setCurrentPage(1); }}
        />
        <FiltroMultiplo
          rotulo="Status"
          opcoes={statusList.map(st => ({ valor: st, rotulo: st === 'FECHADA' ? 'Concluída' : st.charAt(0) + st.slice(1).toLowerCase() }))}
          selecionados={selectedStatus}
          onChange={v => { setSelectedStatus(v); setCurrentPage(1); }}
        />
        {modo === 'etapa' && (
          <label className="chip">
            <input type="checkbox" checked={showConcluidasEtapa} onChange={e => setShowConcluidasEtapa(e.target.checked)} />
            Mostrar concluídas
          </label>
        )}
        {filtrosAtivos && <button type="button" className="btn-texto" onClick={limparFiltros}>Limpar filtros</button>}
        <label className="campo-busca">
          <Search aria-hidden="true" />
          <input
            type="search"
            className="campo"
            aria-label="Buscar cargo, solicitante, setor ou número"
            placeholder="Buscar cargo, setor ou número"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </label>
      </div>

      {/* Kanban por etapa — a visão principal. Quem espera há mais tempo vem primeiro. */}
      {modo === 'etapa' && (
        <>
          <div className="quadro">
            {ETAPAS_FUNIL.map((etapa, idx) => {
              const lista = filteredVagas
                .filter(v => v.status !== 'FECHADA' && normalizeEtapa(v) === etapa)
                // Pausada vai para o fim: o prazo dela está parado, não pede ação.
                .sort((a, b) => Number(isPausedOrSuspended(a.status)) - Number(isPausedOrSuspended(b.status)) || diasNestaEtapa(b) - diasNestaEtapa(a));
              const proxima = ETAPAS_FUNIL[idx + 1];
              const alvo = `etapa-${etapa}`;
              return (
                <section
                  key={etapa}
                  aria-label={`${etapa}: ${lista.length} vagas`}
                  className={`coluna${draggedOverLaneId === alvo ? ' alvo' : ''}`}
                  style={{ background: fundoEtapa(etapa), color: corEtapa(etapa) }}
                  {...soltarEm(alvo, id => handleEtapaDrop(id, etapa))}
                >
                  <h3 className="coluna-cab">{etapa}<em>{lista.length}</em></h3>
                  <div className="coluna-lista">
                    {lista.length === 0 ? <p className="coluna-vazia">Nenhuma vaga nesta etapa</p> : lista.map(vaga => (
                      <CartaoVaga
                        key={vaga.id}
                        vaga={vaga}
                        sigla={getSedeSigla(vaga.sede)}
                        dias={diasNestaEtapa(vaga)}
                        rotuloDias="na etapa"
                        pausada={isPausedOrSuspended(vaga.status)}
                        cor={corEtapa(etapa)}
                        podeGerir={canManageVagas}
                        abrir={() => setSelectedDetailsVaga(vaga)}
                        editar={() => startEditing(vaga)}
                        pausar={() => openPauseModal(vaga)}
                        retomar={() => updateVaga(vaga.id, { status: 'ABERTA' })}
                        avancar={proxima ? { rotulo: `Para ${ROTULO_CURTO[proxima] ?? proxima}`, cor: corEtapa(proxima), acao: () => handleEtapaDrop(vaga.id, proxima) } : undefined}
                        concluir={proxima ? undefined : () => handleOpenConcludeModal(vaga)}
                        {...arrastar(vaga)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {(showConcluidasEtapa || statusGroupFilter.includes('CONCLUIDAS')) && (() => {
            const concluidas = filteredVagas.filter(v => v.status === 'FECHADA');
            return (
              <section className="painel p-4 space-y-3" aria-label="Vagas concluídas">
                <h3 className="text-[15px] font-bold" style={{ color: 'var(--tinta)' }}>Concluídas <span style={{ color: 'var(--tinta-3)' }}>{concluidas.length}</span></h3>
                {concluidas.length === 0
                  ? <p style={{ color: 'var(--tinta-3)' }} className="text-[13px]">Nenhuma vaga concluída com esses filtros.</p>
                  : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{concluidas.map(v => cartaoPorTempoAberto(v, 'var(--etapa-admissao)'))}</div>}
              </section>
            );
          })()}
        </>
      )}

      {/* Kanban por status — o retrato administrativo. */}
      {modo === 'status' && (
        <div className="quadro" style={{ '--colunas': 4 } as React.CSSProperties}>
          {[
            { id: 'lane-aberta', titulo: 'Abertas', cor: 'var(--etapa-entrevista)', fundo: 'var(--etapa-entrevista-fundo)', cabe: (v: Vaga) => v.status === 'ABERTA' || v.status === 'REABERTA' },
            { id: 'lane-doc', titulo: 'Admissão / documentos', cor: 'var(--etapa-documentacao)', fundo: 'var(--etapa-documentacao-fundo)', cabe: (v: Vaga) => v.status === 'DOCUMENTAÇÃO' },
            { id: 'lane-paused', titulo: 'Pausadas ou suspensas', cor: 'var(--etapa-pausa)', fundo: 'var(--etapa-pausa-fundo)', cabe: (v: Vaga) => isPausedOrSuspended(v.status) },
            { id: 'lane-closed', titulo: 'Concluídas', cor: 'var(--etapa-admissao)', fundo: 'var(--etapa-admissao-fundo)', cabe: (v: Vaga) => v.status === 'FECHADA' },
          ].map(raia => {
            const lista = filteredVagas.filter(raia.cabe).sort((a, b) => Number(isPausedOrSuspended(a.status)) - Number(isPausedOrSuspended(b.status)) || getDiasEmAberto(b) - getDiasEmAberto(a));
            return (
              <section
                key={raia.id}
                aria-label={`${raia.titulo}: ${lista.length} vagas`}
                className={`coluna${draggedOverLaneId === raia.id ? ' alvo' : ''}`}
                style={{ background: raia.fundo, color: raia.cor }}
                {...soltarEm(raia.id, id => handleDragDrop(id, raia.id))}
              >
                <h3 className="coluna-cab">{raia.titulo}<em>{lista.length}</em></h3>
                <div className="coluna-lista">
                  {lista.length === 0 ? <p className="coluna-vazia">Nenhuma vaga aqui</p> : lista.map(v => cartaoPorTempoAberto(v, raia.cor, true))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {modo === 'tabela' && (
        <div className="painel overflow-hidden">
          {/* Sem rolagem de lado (regra de 08/10/2026): em tela estreita, cartão. */}
          <div>
            <table className="tabela tabela-empilha">
              <thead>
                <tr>
                  <th><button type="button" onClick={() => handleSort('codigo')}>Nº <ArrowUpDown className="w-3 h-3" /></button></th>
                  <th><button type="button" onClick={() => handleSort('vaga')}>Cargo <ArrowUpDown className="w-3 h-3" /></button></th>
                  <th>Sede e setor</th>
                  <th>Situação</th>
                  <th>Solicitante</th>
                  <th><button type="button" onClick={() => handleSort('tempoProcesso')}>Tempo <ArrowUpDown className="w-3 h-3" /></button></th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVagas.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10" style={{ color: 'var(--tinta-3)' }}>Nenhuma vaga com esses filtros.</td></tr>
                ) : paginatedVagas.map(vaga => {
                  const dias = getDiasEmAberto(vaga);
                  const atrasada = vaga.status !== 'FECHADA' && !isPausedOrSuspended(vaga.status) && dias > SLA_META_DIAS;
                  return (
                    <tr key={vaga.id}>
                      <td className="num" data-rotulo="Nº">{vaga.codigo}</td>
                      <td>
                        <span>
                          <button type="button" className="font-bold text-left hover:underline" onClick={() => setSelectedDetailsVaga(vaga)}>{vaga.vaga}</button>
                          <span className="sub">{vaga.responsavel || 'Equipe RH'}</span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap" data-rotulo="Sede e setor"><span>{getSedeSigla(vaga.sede)}<span className="sub">{vaga.setor}</span></span></td>
                      <td className="whitespace-nowrap" data-rotulo="Situação">
                        <span>
                          {getStatusBadge(vaga.status)}
                          {vaga.status !== 'FECHADA' && <span className="sub">{vaga.etapa || 'Triagem'}</span>}
                        </span>
                      </td>
                      <td data-rotulo="Solicitante">{vaga.solicitante}</td>
                      <td className="whitespace-nowrap" data-rotulo="Tempo">
                        {vaga.status === 'FECHADA'
                          ? <span>{vaga.tempoProcesso ?? '—'} dias para fechar</span>
                          : <span className={atrasada ? 'etiqueta etiqueta-atraso' : ''}>{dias} dias em aberto</span>}
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <button type="button" className="btn btn-sm" onClick={() => setSelectedDetailsVaga(vaga)}>Detalhes</button>
                          {canManageVagas && (
                            <>
                              <button type="button" className="btn btn-sm" onClick={() => startEditing(vaga)}>Editar</button>
                              {vaga.status !== 'FECHADA' && <button type="button" className="btn btn-sm" onClick={() => handleOpenConcludeModal(vaga)}>Concluir</button>}
                              <button type="button" className="btn btn-sm btn-perigo" onClick={() => excluirVaga(vaga)}>Excluir</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {paginacao}
        </div>
      )}

      {modo === 'grade' && (
        <div className="space-y-3">
          {paginatedVagas.length === 0
            ? <p className="painel text-center py-10" style={{ color: 'var(--tinta-3)' }}>Nenhuma vaga com esses filtros.</p>
            : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">{paginatedVagas.map(v => cartaoPorTempoAberto(v, 'var(--etapa-entrevista)'))}</div>}
          {paginacao && <div className="painel">{paginacao}</div>}
        </div>
      )}

      {/* SECTION 4: SLIDING RIGHT DETAILS DRAWER (THE MAGICAL UX PIECE) */}
      {selectedDetailsVaga && (
        <VagaDetailsDrawer
          vaga={selectedDetailsVaga}
          logs={logs}
          canManage={canManageVagas}
          funil={funilEfetivo(selectedDetailsVaga, selecoes)}
          selecoes={selecoesDaVaga(selecoes, selectedDetailsVaga)}
          onAbrirSelecao={abrirSelecao}
          origem={requisicoes?.find(r => r.vagaId === selectedDetailsVaga.id)}
          podeNovaSelecao={podeVerSelecoes && canManageVagas}
          getSedeLabel={getSedeLabel}
          renderStatusBadge={getStatusBadge}
          onClose={() => setSelectedDetailsVaga(null)}
          onConcluir={handleOpenConcludeModal}
          onEditar={startEditing}
          onExcluir={(v) => {
            if (confirmAction) {
              confirmAction(
                "Excluir vaga",
                `Excluir a vaga nº ${v.codigo} (${v.vaga})? Não dá para desfazer.`,
                async () => {
                  await deleteVaga(v.id);
                  setSelectedDetailsVaga(null);
                }
              );
            } else {
              if (confirm(`Excluir permanentemente?`)) {
                deleteVaga(v.id);
                setSelectedDetailsVaga(null);
              }
            }
          }}
        />
      )}

      {/* SECTION 5: MODALS (ORIGINAL COMPATIBILITY BACKUP) */}
      
      {/* 5A: MODIFY/EDIT VACANCY MODAL */}
      {editingVaga && (
        <EditVacancyModal 
          vaga={editingVaga}
          cargos={cargos}
          sedes={sedes}
          setores={setores}
          funilAutomatico={funilEfetivo(editingVaga, selecoes).fonte === 'selecao' ? funilEfetivo(editingVaga, selecoes) : undefined}
          onClose={() => setEditingVaga(null)}
          onSave={handleEditSave}
        />
      )}

      {/* 5B: CREATE NEW VACANCY DIALOG */}
      {showAddVagaModal && (
        <Modal largura="lg" titulo="Nova vaga" aoFechar={() => setShowAddVagaModal(false)}>
          <AddVacancyForm
            addVaga={addVaga}
            sedes={sedes}
            cargos={cargos}
            setores={setores}
            nomesUsados={nomesDeVagaUsados}
            criarSetor={canManageVagas ? addSetor : undefined}
            onSuccess={() => setShowAddVagaModal(false)}
            userSede={userSede}
          />
        </Modal>
      )}

      {/* Funil de candidatos: cada passagem do Kanban (08/10/2026) */}
      {funilMove && podeConduzirFunil && (
        <FunilModal
          vaga={funilMove.vaga}
          de={funilMove.de}
          para={funilMove.para}
          lista={candidatosDaVaga(funilMove.vaga, selecoes, candidatos!)}
          selecoesLigadas={selecoesDaVaga(selecoes, funilMove.vaga)}
          vagasDaSelecao={s => vagas.filter(v => v.status !== 'FECHADA' && atendeVaga(s, v))}
          funil={funilEfetivo(funilMove.vaga, selecoes)}
          aoFechar={() => setFunilMove(null)}
          marcarOutra={() => { setEntrevistaPara(funilMove.vaga); setFunilMove(null); }}
          registrarNomes={registrarCandidatos!}
          atualizar={atualizarCandidatos!}
          mover={() => moverParaEtapa(funilMove.vaga, funilMove.para)}
          registrarEntrevista={criarSelecao ? async (data, nomes) => {
            // A mesma seleção que o formulário único criaria, com a vaga marcada.
            const { erros, campos } = camposDoFormulario(formularioDaVaga(funilMove.vaga, { data, responsavel: responsavelPadrao, convocados: nomes.length }));
            if (erros.length) throw new Error(erros.join(' '));
            await criarSelecao(campos, nomes);
          } : undefined}
        />
      )}

      {/* Triagem → Entrevista: o formulário único de seleção, com a vaga marcada */}
      {entrevistaPara && criarSelecao && (
        <ModalSelecao
          titulo="Marcar a entrevista"
          antes={<span>Vaga nº {entrevistaPara.codigo} · {entrevistaPara.vaga} · {normalizeEtapa(entrevistaPara)} → Entrevista</span>}
          inicial={formularioDaVaga(entrevistaPara, { data: formatDateBR(dataISOLocal()), responsavel: responsavelPadrao })}
          sedes={sedes || []}
          vagas={vagas}
          sugestoes={sugestoesDeSelecoes(selecoes, (setores || []).map(s => s.nome))}
          comNomes
          rotuloSalvar="Marcar e mover"
          acaoExtra={{ rotulo: 'Só mover, marcar depois', acao: () => moverParaEtapa(entrevistaPara, 'Entrevista') }}
          onSalvar={async (campos, nomes) => {
            await criarSelecao(campos, nomes);
            await moverParaEtapa(entrevistaPara, 'Entrevista');
          }}
          aoFechar={() => setEntrevistaPara(null)}
        />
      )}

      {/* 5C: BEAUTIFUL DIALOG FOR CONCLUDING VACANCY (PROMPT ALTERNATIVE) */}
      {vagaToConclude && (
        <ConcludeVacancyModal
          vaga={vagaToConclude}
          sugestao={escolhidoParaConcluir?.nome}
          onClose={() => setVagaToConclude(null)}
          onConclude={handleSaveConclusion}
        />
      )}

      {/* Modal: confirmar a data da pausa (congela o SLA a partir dela) */}
      {vagaToPause && (
        <PauseVagaModal
          vaga={vagaToPause}
          dateISO={pauseDateISO}
          onDateChange={setPauseDateISO}
          onCancel={() => setVagaToPause(null)}
          onConfirm={async () => {
            const alvo = vagaToPause;
            const data = pauseDateISO || dataISOLocal();
            setVagaToPause(null);
            await updateVaga(alvo.id, { status: 'PAUSADA', pausadaDesde: data });
          }}
        />
      )}

      {/* Modal de transição de etapa: avanço Triagem→Entrevista pede o funil;
          retorno (voltar etapa) pede o motivo de desistência. */}
      {etapaMove && (
        <EtapaMoveModal
          move={etapaMove}
          chamados={moveChamados}
          compareceram={moveCompareceram}
          aprovados={moveAprovados}
          motivo={moveMotivo}
          onChamados={setMoveChamados}
          onCompareceram={setMoveCompareceram}
          onAprovados={setMoveAprovados}
          onMotivo={setMoveMotivo}
          onCancel={() => setEtapaMove(null)}
          onConfirm={confirmEtapaMove}
          selecao={etapaMove.tipo === 'funil' ? selecaoDaVaga : null}
          automatico={funilAuto}
          onUsarSelecao={aplicarNumerosDaSelecao}
        />
      )}

      {/* 5D: KANBAN ACCIDENTAL DRAG PREVENTION CONFIRMATION MODAL */}
      {dragMoveConfirm && (
        <DragMoveConfirmModal
          info={dragMoveConfirm}
          onCancel={() => setDragMoveConfirm(null)}
          onConfirm={async () => {
            const { vagaId, laneId } = dragMoveConfirm;
            setDragMoveConfirm(null);
            await executeDragDrop(vagaId, laneId);
          }}
        />
      )}
    </div>
  );
};
