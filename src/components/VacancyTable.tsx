/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Vaga, Experiencia } from '../types';
import { AddVacancyForm } from './AddVacancyForm';
import { Sede, Cargo, Setor } from '../hooks/useMetadata';
import type { SystemLog } from '../hooks/useLogs';
import { EditVacancyModal } from './EditVacancyModal';
import { ConcludeVacancyModal } from './ConcludeVacancyModal';
import { 
  Search, 
  MapPin, 
  Layers, 
  User, 
  Calendar, 
  Edit2, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  CheckCircle,
  HelpCircle,
  Pause,
  AlertCircle,
  FileCode,
  ArrowUpDown,
  PlusCircle,
  Eye,
  LayoutGrid,
  Kanban,
  Table,
  Download,
  Settings,
  Check,
  Users,
  Play,
  Clock,
  AlertTriangle,
  History,
  UserCheck,
  SlidersHorizontal,
  X,
  ChevronDown,
  Workflow,
  Building,
  CheckCircle2,
  FileText,
  GripVertical
} from 'lucide-react';
import { exportToXlsx } from '../utils/xlsxExporter';
import { SLA_META_DIAS, MOTIVOS_DESISTENCIA } from '../constants/hr';
import { parseDateDDMMYYYY, isPausedOrSuspended, getDiasEmAberto, getSlaInfo, ETAPAS_FUNIL, normalizeEtapa, diasNestaEtapa } from '../utils/vaga';

interface VacancyTableProps {
  vagas: Vaga[];
  updateVaga: (id: string, updatedFields: Partial<Vaga>) => Promise<void>;
  deleteVaga: (id: string) => Promise<void>;
  addVaga: (vaga: Omit<Vaga, 'id' | 'codigo'>) => Promise<void>;
  addExperiencia?: (input: Omit<Experiencia, 'id' | 'termino1' | 'termino2'>) => Promise<void>;
  sedes?: Sede[];
  cargos?: Cargo[];
  setores?: Setor[];
  isAdmin?: boolean;
  confirmAction?: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
  triggerAddModal?: number;
  userSede?: string;
  userRole?: string;
  // Foco vindo do Home (alerta de SLA): filtra a tabela pela vaga (token muda a cada clique).
  focusVaga?: { codigo: string; token: number } | null;
  // Logs de auditoria (só carregados para admin) — usados na timeline do painel de detalhes.
  logs?: SystemLog[];
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
  isAdmin = false,
  confirmAction,
  triggerAddModal,
  userSede,
  userRole,
  focusVaga,
  logs
}) => {
  const canManageVagas = isAdmin || userRole === 'Analista' || userRole === 'Administrador';
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
  const [selectedSede, setSelectedSede] = useState(() => {
    return !isAdmin && userSede ? userSede : '';
  });
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedSetor, setSelectedSetor] = useState('');

  useEffect(() => {
    if (!isAdmin && userSede) {
      setSelectedSede(userSede);
    }
  }, [userSede, isAdmin]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; // Dense but cozy layout

  // Sorting state
  const [sortBy, setSortBy] = useState<'codigo' | 'vaga' | 'tempoProcesso'>('codigo');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // New visual and process UI states
  const [viewMode, setViewMode] = useState<'kanban' | 'tabela' | 'grade'>('kanban');
  // Agrupamento do Kanban: 'status' (atual, padrão) ou 'etapa' (novo funil). Toggle.
  const [kanbanGroupBy, setKanbanGroupBy] = useState<'status' | 'etapa'>('status');
  const [showConcluidasEtapa, setShowConcluidasEtapa] = useState(false);
  const [selectedDetailsVaga, setSelectedDetailsVaga] = useState<Vaga | null>(null);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [statusGroupFilter, setStatusGroupFilter] = useState<'TODAS' | 'ATIVAS' | 'CONCLUIDAS' | 'ALERTA_SLA'>('TODAS');

  // Foco vindo do Home: filtra pela vaga (busca pelo código, que é único) e limpa
  // os demais filtros pra ela não ficar escondida. token muda a cada clique → re-aplica.
  useEffect(() => {
    if (focusVaga && focusVaga.codigo) {
      setSearchTerm(focusVaga.codigo);
      setStatusGroupFilter('TODAS');
      setSelectedStatus('');
      setSelectedSetor('');
      setCurrentPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusVaga?.token]);

  // Drag and drop states for Kanban Funnel
  const [draggedOverLaneId, setDraggedOverLaneId] = useState<string | null>(null);
  const [draggingVagaId, setDraggingVagaId] = useState<string | null>(null);

  // Column visibility configuration
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    codigo: true,
    vaga: true,
    sede: true,
    status: true,
    setor: true,
    sexo: false, // Default hidden to avoid wider screens scrolling
    solicitacao: true,
    solicitante: true,
    motivo: false,
    funcionarioSubstituido: false,
    etapa: true,
    aprovado: false,
    observacoes: false,
    responsavel: true,
    conclusao: false,
    tempoProcesso: true
  });

  // Edit modal state (original)
  const [showAddVagaModal, setShowAddVagaModal] = useState(false);
  
  useEffect(() => {
    if (triggerAddModal && triggerAddModal > 0) {
      setShowAddVagaModal(true);
    }
  }, [triggerAddModal]);

  const [editingVaga, setEditingVaga] = useState<Vaga | null>(null);

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
    setPauseDateISO(new Date().toISOString().slice(0, 10));
  };

  // Modal de transição de etapa (Kanban por etapa): ao mover, confirma os números
  // do funil (chamou x veio x aprovou) e o motivo de desistência, se houve.
  const [etapaMove, setEtapaMove] = useState<{ vaga: Vaga; novaEtapa: string; tipo: 'funil' | 'desistencia' } | null>(null);
  const [moveChamados, setMoveChamados] = useState(0);
  const [moveCompareceram, setMoveCompareceram] = useState(0);
  const [moveAprovados, setMoveAprovados] = useState(0);
  const [moveMotivo, setMoveMotivo] = useState('');
  const openEtapaMove = (vaga: Vaga, novaEtapa: string, tipo: 'funil' | 'desistencia') => {
    setEtapaMove({ vaga, novaEtapa, tipo });
    setMoveChamados(vaga.candChamados || 0);
    setMoveCompareceram(vaga.candCompareceram || 0);
    setMoveAprovados(vaga.candAprovados || 0);
    setMoveMotivo(vaga.motivoDesistencia || '');
  };
  const confirmEtapaMove = async () => {
    if (!etapaMove) return;
    const { vaga, novaEtapa, tipo } = etapaMove;
    setEtapaMove(null);
    // updateVaga carimba etapaDesde sozinho quando a etapa muda.
    if (tipo === 'funil') {
      await updateVaga(vaga.id, {
        etapa: novaEtapa,
        candChamados: Number(moveChamados) || 0,
        candCompareceram: Number(moveCompareceram) || 0,
        candAprovados: Number(moveAprovados) || 0
      });
    } else {
      await updateVaga(vaga.id, { etapa: novaEtapa, motivoDesistencia: moveMotivo });
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
      vagaCodigo: targetVaga.codigo || '',
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
  const handleEtapaDrop = async (vagaId: string, etapa: string) => {
    const v = vagas.find(x => x.id === vagaId);
    if (!v) return;
    const atual = normalizeEtapa(v);
    if (atual === etapa) return;
    const ordem = ETAPAS_FUNIL as readonly string[];
    const atualIdx = ordem.indexOf(atual);
    const destinoIdx = ordem.indexOf(etapa);
    // Avanço-chave Triagem → Entrevista: confirma o funil.
    if (atual === 'Triagem' && etapa === 'Entrevista') {
      openEtapaMove(v, etapa, 'funil');
      return;
    }
    // Retorno (etapa anterior): registra o motivo de desistência.
    if (atualIdx >= 0 && destinoIdx >= 0 && destinoIdx < atualIdx) {
      openEtapaMove(v, etapa, 'desistencia');
      return;
    }
    // Demais avanços: move direto.
    await updateVaga(vagaId, { etapa });
  };

  // 1B. DIALOG HANDLERS TO REMOVE BROWSER PROMPTS (UPGRADING RECRUITER EXPERIENCE)
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
    
    if (adicionarNaExperiencia && addExperiencia && vagaToConclude) {
      await addExperiencia({
        colaborador: candidato.trim(),
        funcao: vagaToConclude.vaga,
        setor: vagaToConclude.setor || '',
        sede: vagaToConclude.sede,
        dataAdmissao: finalAdmissao,
        supervisor: vagaToConclude.solicitante || '', // Requester as default supervisor
        status: 'EM_ANALISE',
        observacoes: observacoes.trim()
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
    const relevantVagas = vagas.filter(v => {
      if (selectedSede) {
        return v.sede && v.sede.toLowerCase() === selectedSede.toLowerCase();
      }
      return true;
    });

    const total = relevantVagas.length;
    let ativas = 0;
    let concluidas = 0;
    let alertas = 0;
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
        if (days > SLA_META_DIAS && !isPausedOrSuspended(v.status)) {
          alertas++;
        }
      }
    });

    const tempoMedio = countConcluidasComTempo > 0 
      ? Math.round(somaTempoConclusao / countConcluidasComTempo) 
      : 0;

    return { total, ativas, concluidas, alertas, tempoMedio };
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

  // Toggle single column visibility
  const toggleColumn = (col: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [col]: !prev[col]
    }));
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
    if (selectedSede) {
      result = result.filter(v => v.sede && v.sede.toLowerCase() === selectedSede.toLowerCase());
    }

    // Status filter
    if (selectedStatus) {
      result = result.filter(v => v.status === selectedStatus);
    }

    // Sector filter
    if (selectedSetor) {
      result = result.filter(v => v.setor === selectedSetor);
    }

    // Modern KPI Groups Filter
    if (statusGroupFilter === 'ATIVAS') {
      result = result.filter(v => v.status === 'ABERTA' || v.status === 'REABERTA' || v.status === 'DOCUMENTAÇÃO');
    } else if (statusGroupFilter === 'CONCLUIDAS') {
      result = result.filter(v => v.status === 'FECHADA');
    } else if (statusGroupFilter === 'ALERTA_SLA') {
      result = result.filter(v => getDiasEmAberto(v) > SLA_META_DIAS && v.status !== 'FECHADA' && !isPausedOrSuspended(v.status));
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
        { type: Number, value: v.candChamados ?? null },
        { type: Number, value: v.candCompareceram ?? null },
        { type: Number, value: v.candAprovados ?? null },
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

  // Status Badge helper
  const getStatusBadge = (status: Vaga['status']) => {
    switch (status) {
      case 'ABERTA':
      case 'REABERTA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></span>
            Aberta
          </span>
        );
      case 'FECHADA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Check className="w-3 h-3 text-emerald-600" />
            Concluída
          </span>
        );
      case 'PAUSADA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Pause className="w-3 h-3 text-slate-500" />
            Pausada
          </span>
        );
      case 'SUSPENSA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <AlertCircle className="w-3 text-slate-500" />
            Suspensa
          </span>
        );
      case 'DOCUMENTAÇÃO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
            <FileCode className="w-3 h-3 text-indigo-600" />
            Admissão
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Quadro de Vagas</h2>
          <p className="text-slate-500 text-sm font-medium">Gestão de posições e processos seletivos.</p>
        </div>
        <button
          onClick={() => {
            if (!canManageVagas) {
              alert("Apenas Administradores e Analistas podem criar vagas. Altere o perfil para Admin ou Analista para simular!");
              return;
            }
            setShowAddVagaModal(true);
          }}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-sm hover:shadow transition-all"
        >
          <PlusCircle className="w-5 h-5 shrink-0" />
          <span>Nova Vaga</span>
        </button>
      </div>
      
      {/* SECTION 1: MODERN STATS PANEL (INTERACTIVE DECK) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Metric Card */}
        <div 
          onClick={() => { setStatusGroupFilter('TODAS'); setCurrentPage(1); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
            statusGroupFilter === 'TODAS' 
              ? 'bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-900/10' 
              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80 font-sans">Cadastradas</span>
            <Building className={`w-4 h-4 ${statusGroupFilter === 'TODAS' ? 'text-orange-400' : 'text-slate-400'}`} />
          </div>
          <p className="text-2xl font-bold mt-2 font-sans">{stats.total}</p>
          <div className="text-[10px] opacity-70 mt-1">Todas as vagas no banco</div>
          {statusGroupFilter === 'TODAS' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-500"></div>}
        </div>

        {/* Active Metric Card */}
        <div 
          onClick={() => { setStatusGroupFilter('ATIVAS'); setCurrentPage(1); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
            statusGroupFilter === 'ATIVAS' 
              ? 'bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-600/10' 
              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Em Aberto</span>
            <Play className={`w-4 h-4 ${statusGroupFilter === 'ATIVAS' ? 'text-white' : 'text-amber-500 animate-pulse'}`} />
          </div>
          <p className="text-2xl font-bold mt-2">{stats.ativas}</p>
          <div className="text-[10px] opacity-70 mt-1">Contratações ativas</div>
          {statusGroupFilter === 'ATIVAS' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-white"></div>}
        </div>

        {/* Closed Metric Card */}
        <div 
          onClick={() => { setStatusGroupFilter('CONCLUIDAS'); setCurrentPage(1); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
            statusGroupFilter === 'CONCLUIDAS' 
              ? 'bg-emerald-700 border-emerald-700 text-white shadow-md shadow-emerald-700/10' 
              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Concluídas</span>
            <CheckCircle2 className={`w-4 h-4 ${statusGroupFilter === 'CONCLUIDAS' ? 'text-white' : 'text-emerald-500'}`} />
          </div>
          <p className="text-2xl font-bold mt-2">{stats.concluidas}</p>
          <div className="text-[10px] opacity-70 mt-1">Vagas fechadas</div>
          {statusGroupFilter === 'CONCLUIDAS' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-white"></div>}
        </div>

        {/* Medium SLA Card */}
        <div className="p-4 rounded-2xl border bg-white border-slate-200 text-slate-700 hover:shadow-xs transition-all col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tempo Médio SLA</span>
            <Clock className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-2xl font-bold mt-2">{stats.tempoMedio} dias</p>
          <div className="text-[10px] text-slate-400 mt-1">Para preencher vagas</div>
        </div>

        {/* SLA Breaches Card */}
        <div 
          onClick={() => { setStatusGroupFilter('ALERTA_SLA'); setCurrentPage(1); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group col-span-2 lg:col-span-1 ${
            statusGroupFilter === 'ALERTA_SLA' 
              ? 'bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-600/10' 
              : 'bg-white border-slate-200 text-slate-705 hover:border-slate-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Atendimento SLA</span>
            <AlertTriangle className={`w-4 h-4 ${statusGroupFilter === 'ALERTA_SLA' ? 'text-white animate-bounce' : 'text-rose-500 animate-pulse'}`} />
          </div>
          <p className="text-2xl font-bold mt-2">{stats.alertas}</p>
          <div className="text-[10px] opacity-70 mt-1">Vagas &gt; {SLA_META_DIAS} dias abertas</div>
          {statusGroupFilter === 'ALERTA_SLA' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-white"></div>}
        </div>
      </div>

      {/* SECTION 2: CONTROL FILTERS BAR + ACTION BAR */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        
        {/* Filter Title & Quick Views Toggles */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-6 bg-orange-500 rounded-full"></div>
            <div>
              <p className="text-sm font-bold text-slate-800 tracking-tight">Painel operacional de recrutamento</p>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">Gestão por pipeline Kanban ou listagem</p>
            </div>
          </div>

          {/* Interactive Toggle for View Modes */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl self-start lg:self-center">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase cursor-pointer transition-all ${
                viewMode === 'kanban' 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Kanban Board"
            >
              <Kanban className="w-3.5 h-3.5 text-orange-500" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('tabela')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase cursor-pointer transition-all ${
                viewMode === 'tabela' 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Comprehensive Table"
            >
              <Table className="w-3.5 h-3.5 text-blue-500" />
              <span>Lista / Tabela</span>
            </button>
            <button
              onClick={() => setViewMode('grade')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase cursor-pointer transition-all ${
                viewMode === 'grade' 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Bento Grid Card"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-purple-650" />
              <span>Cartões</span>
            </button>
          </div>
        </div>

        {/* Advanced Filter Fields Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Term Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-700 font-medium transition"
              placeholder="Pesquisar Cargo, Solicitante ou Código..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>

          {/* Sede Dropdown */}
          <select
            className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-700 font-medium transition disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
            value={selectedSede}
            onChange={(e) => { setSelectedSede(e.target.value); setCurrentPage(1); }}
          >
            <option value="">Todas as Sedes ({sedesList.length})</option>
            {sedesList.map((s, idx) => (
              <option key={idx} value={s}>{getSedeSigla(s)}</option>
            ))}
          </select>

          {/* Sector Dropdown */}
          <select
            className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-700 font-medium transition"
            value={selectedSetor}
            onChange={(e) => { setSelectedSetor(e.target.value); setCurrentPage(1); }}
          >
            <option value="">Todos os Setores ({setoresList.length})</option>
            {setoresList.map((s, idx) => (
              <option key={idx} value={s}>{s}</option>
            ))}
          </select>

          {/* Specific status filter */}
          <select
            className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-700 font-medium transition"
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
          >
            <option value="">Status da Vaga: Todos</option>
            {statusList.map((st, idx) => (
              <option key={idx} value={st}>{st === 'FECHADA' ? 'CONCLUÍDA' : st}</option>
            ))}
          </select>
        </div>

        {/* Row of actionable tools (CSV export, column management, creator, clear) */}
        <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-100 gap-3">
          
          <div className="flex items-center gap-2">
            {/* XLSX export */}
            <button
              onClick={handleExportXLSX}
              className="px-3.5 py-2 text-xs font-bold uppercase tracking-wider bg-slate-100 hover:bg-slate-200 text-slate-750 rounded-xl border border-slate-250 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Baixar planilha Excel (.xlsx) formatada"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Exportar Excel (.xlsx)</span>
            </button>

            {/* Column Manager Toggle (only relevant in table view) */}
            {viewMode === 'tabela' && (
              <div className="relative">
                <button
                  onClick={() => setShowColumnManager(!showColumnManager)}
                  className={`px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-xl border transition-colors flex items-center gap-1.5 cursor-pointer ${
                    showColumnManager 
                      ? 'bg-slate-900 text-white border-slate-905' 
                      : 'bg-slate-150/60 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Personalizar Colunas</span>
                </button>
                
                {/* Column Selection Dialog Bubble */}
                {showColumnManager && (
                  <div className="absolute left-0 mt-2 bg-white border border-slate-200 p-4 rounded-2xl shadow-xl z-50 w-64 animate-in fade-in zoom-in-95 duration-100">
                    <div className="flex items-center justify-between border-b border-sidebar-divider pb-2 mb-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Colunas no Relatório</span>
                      <button onClick={() => setShowColumnManager(false)} className="text-slate-400 hover:text-slate-700">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto">
                      {Object.keys(visibleColumns).map((col) => {
                        const translateMap: Record<string, string> = {
                          codigo: "Código da Vaga",
                          vaga: "Cargo / Nome",
                          sede: "Sede de Operação",
                          status: "Status Geral",
                          setor: "Setor / Área",
                          sexo: "Sexo Preferencial",
                          solicitacao: "Data da Solicitação",
                          solicitante: "Gestor Requerente",
                          motivo: "Motivo Reclut.",
                          funcionarioSubstituido: "Substituído",
                          etapa: "Etapa de Seleção",
                          aprovado: "Candidato Aprovado",
                          observacoes: "Anotações / Notas",
                          responsavel: "Recruiter RH",
                          conclusao: "Data de Fechamento",
                          tempoProcesso: "SLA / Dias Processo"
                        };
                        return (
                          <label key={col} className="flex items-center gap-2 px-1 py-0.5 hover:bg-slate-50 rounded-lg cursor-pointer text-xs font-medium text-slate-700">
                            <input 
                              type="checkbox" 
                              checked={visibleColumns[col]} 
                              onChange={() => toggleColumn(col)}
                              className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 h-3.5 w-3.5 cursor-pointer"
                            />
                            <span>{translateMap[col] || col}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* If filter active, show reset indicator */}
            {(searchTerm || selectedSede || selectedSetor || selectedStatus || statusGroupFilter !== 'TODAS') && (
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setSelectedSede('');
                  setSelectedSetor('');
                  setSelectedStatus('');
                  setStatusGroupFilter('TODAS');
                  setCurrentPage(1);
                }}
                className="text-xs font-bold text-rose-600 hover:text-rose-800 underline uppercase tracking-wider cursor-pointer ml-1"
              >
                Limpar Filtros
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Register Action Button */}
            <button
              onClick={() => {
                if (canManageVagas) {
                  setShowAddVagaModal(true);
                } else {
                  alert("Acesso restrito: Apenas Administradores e Analistas podem cadastrar novas vagas! Selecione um perfil adequado no topo para habilitar.");
                }
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all ${
                canManageVagas 
                  ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-md' 
                  : 'bg-slate-100 text-slate-400 border border-slate-205 cursor-not-allowed'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-orange-500 shrink-0" />
              <span>Nova Vaga {!canManageVagas && "🔒"}</span>
            </button>
          </div>

        </div>
      </div>

      {/* SECTION 3: CORE WORKSPACE VIEWS */}
      
      {/* Sub-toggle do Kanban: agrupar por status (atual) ou por etapa (funil novo) */}
      {viewMode === 'kanban' && (
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setKanbanGroupBy('status')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase cursor-pointer transition-all ${
                kanbanGroupBy === 'status' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Colunas por status da vaga (visão atual)"
            >
              <Workflow className="w-3.5 h-3.5 text-slate-500" />
              <span>Por status</span>
            </button>
            <button
              onClick={() => setKanbanGroupBy('etapa')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase cursor-pointer transition-all ${
                kanbanGroupBy === 'etapa' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Colunas por etapa do processo (funil): mostra onde a vaga está travando"
            >
              <Layers className="w-3.5 h-3.5 text-orange-500" />
              <span>Por etapa</span>
            </button>
          </div>
          {kanbanGroupBy === 'etapa' && (
            <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showConcluidasEtapa}
                onChange={(e) => setShowConcluidasEtapa(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-emerald-600"
              />
              Mostrar concluídas
            </label>
          )}
        </div>
      )}

      {/* 3A: PIPELINE KANBAN VIEW (Por status — atual) */}
      {viewMode === 'kanban' && kanbanGroupBy === 'status' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Kanban Lanes definitions based on Recruiting Statuses */}
          {[
            {
              id: 'lane-aberta',
              title: "Ativas / Abertas",
              color: "border-t-4 border-t-amber-500",
              dot: "bg-amber-500 animate-pulse",
              evals: (v: Vaga) => v.status === 'ABERTA' || v.status === 'REABERTA',
              desc: "Procura ativa em andamento"
            },
            {
              id: 'lane-doc',
              title: "Admissão / Doc",
              color: "border-t-4 border-t-indigo-500",
              dot: "bg-indigo-500",
              evals: (v: Vaga) => v.status === 'DOCUMENTAÇÃO',
              desc: "Fase de recolha de documentos"
            },
            {
              id: 'lane-paused',
              title: "Pausada / Suspensa",
              color: "border-t-4 border-t-slate-400",
              dot: "bg-slate-400",
              evals: (v: Vaga) => v.status === 'PAUSADA' || v.status === 'SUSPENSA',
              desc: "Paralizado temporariamente"
            },
            {
              id: 'lane-closed',
              title: "Concluídas / Fechadas",
              color: "border-t-4 border-t-emerald-500",
              dot: "bg-emerald-500",
              evals: (v: Vaga) => v.status === 'FECHADA',
              desc: "Recrutamento concluído!"
            }
          ].map(lane => {
            const laneVagas = filteredVagas.filter(lane.evals);
            const isDraggedOver = draggedOverLaneId === lane.id;
            
            return (
              <div 
                key={lane.id} 
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDragEnter={() => {
                  setDraggedOverLaneId(lane.id);
                }}
                onDragLeave={() => {
                  if (draggedOverLaneId === lane.id) {
                    setDraggedOverLaneId(null);
                  }
                }}
                onDrop={(e) => {
                  if (!canManageVagas) return;
                  const vagaId = e.dataTransfer.getData('text/plain');
                  handleDragDrop(vagaId, lane.id);
                  setDraggedOverLaneId(null);
                }}
                className={`bg-slate-50 border p-3 rounded-2xl flex flex-col space-y-3 min-h-[480px] transition-all duration-200 ${
                  isDraggedOver 
                    ? 'border-dashed border-orange-500 bg-orange-50/20 shadow-md ring-4 ring-orange-500/5' 
                    : 'border-slate-200/80'
                }`}
              >
                {/* Lane Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                   <div className="flex items-center gap-2">
                     <span className={`w-2 h-2 rounded-full ${lane.dot}`}></span>
                     <h3 className="font-extrabold text-slate-850 text-xs tracking-tight">{lane.title}</h3>
                   </div>
                   <span className="text-[10px] font-extrabold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                     {laneVagas.length}
                   </span>
                </div>

                <p className="text-[10px] text-slate-400 font-semibold uppercase italic leading-none">{lane.desc}</p>

                {/* Lane card container (scrollable vertically if large volume) */}
                <div className="flex-1 overflow-y-auto space-y-3 max-h-[600px] scrollbar-thin pr-1">
                  {laneVagas.length === 0 ? (
                    <div className="h-28 border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-slate-400 italic text-[11px] p-4 text-center">
                      Nenhuma vaga nesta fase
                    </div>
                  ) : (
                    laneVagas.map(vaga => {
                      const daysOpen = getDiasEmAberto(vaga);
                      const sla = getSlaInfo(daysOpen, vaga.status === 'FECHADA', isPausedOrSuspended(vaga.status));
                      const isCurrentlyDragging = draggingVagaId === vaga.id;

                      let borderLeftColor = 'border-l-emerald-500';
                      if (isPausedOrSuspended(vaga.status)) {
                        borderLeftColor = 'border-l-slate-300';
                      } else if (vaga.status === 'FECHADA') {
                        borderLeftColor = 'border-l-indigo-500';
                      } else if (daysOpen > SLA_META_DIAS) {
                        borderLeftColor = 'border-l-rose-500';
                      } else if (daysOpen > 10) {
                        borderLeftColor = 'border-l-amber-500';
                      }

                      return (
                        <div 
                          key={vaga.id} 
                          draggable={canManageVagas}
                          onDragStart={(e) => {
                            if (!canManageVagas) return;
                            e.dataTransfer.setData('text/plain', vaga.id);
                            setDraggingVagaId(vaga.id);
                          }}
                          onDragEnd={() => {
                            setDraggingVagaId(null);
                          }}
                          className={`bg-white p-4 border border-slate-200 border-l-4 ${borderLeftColor} rounded-2xl shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-150 flex flex-col space-y-3 relative group cursor-grab active:cursor-grabbing ${
                            isCurrentlyDragging ? 'opacity-30 scale-95 border-dashed border-orange-200' : ''
                          }`}
                        >
                          {/* Card ID & Title */}
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex items-center gap-1 min-w-0">
                              <GripVertical className="w-3 h-3 text-slate-300 shrink-0" />
                              <span className="text-[10px] font-mono text-slate-400 font-bold tracking-widest shrink-0">#{vaga.codigo}</span>
                            </div>
                            <span className="text-[9px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-100 uppercase truncate">
                              {vaga.etapa || 'Triagem'}
                            </span>
                          </div>

                          <div 
                            className="cursor-pointer" 
                            onClick={() => setSelectedDetailsVaga(vaga)}
                            title="Clique para ver detalhes completo"
                          >
                            <h4 className="font-bold text-slate-800 text-xs hover:text-orange-500 transition line-clamp-2 leading-tight">
                              {vaga.vaga}
                            </h4>
                          </div>

                          {/* Location, Sector Icons */}
                          <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-500 font-medium pb-2 border-b border-slate-100">
                            <div className="flex items-center gap-1 min-w-0" title={`Sede: ${vaga.sede}`}>
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{getSedeSigla(vaga.sede)}</span>
                            </div>
                            <div className="flex items-center gap-1 min-w-0" title={`Setor: ${vaga.setor}`}>
                              <Layers className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{vaga.setor}</span>
                            </div>
                          </div>

                          {/* SLA Gauge indicator */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-400">Tempo de Processo</span>
                              <span className={`px-1.5 py-0.5 font-bold rounded-lg ${sla.color} text-[8px] uppercase tracking-wider`}>
                                {daysOpen} dias • {sla.label}
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                              <div className={`h-full ${sla.progressBar}`} style={{ width: `${sla.percent}%` }}></div>
                            </div>
                          </div>

                          {/* Approved Candidate info if closed */}
                          {vaga.status === 'FECHADA' && (
                            <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100/70 flex items-center gap-1.5 text-[10px]">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <div className="truncate text-slate-700">
                                <span className="font-extrabold text-emerald-800">Contratado: </span>
                                <span className="font-semibold">{vaga.aprovado || 'Não especificado'}</span>
                              </div>
                            </div>
                          )}

                          {/* Requester name, Recruiter */}
                          <div className="flex items-center justify-between text-[10px] pt-1 text-slate-600 font-bold font-sans">
                            <div className="flex items-center gap-1 truncate max-w-[60%]">
                              <User className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate" title={`Solicitante: ${vaga.solicitante}`}>{vaga.solicitante}</span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-500 text-[9px] shrink-0 font-medium">
                              <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded leading-none text-slate-650" title={`Responsável: ${vaga.responsavel || 'RH'}`}>
                                RH: {vaga.responsavel || 'RH'}
                              </span>
                            </div>
                          </div>

                          {/* Quick Interactive Transition Actions & Shortcuts */}
                          <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-100">
                            {/* Short detail buttons */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setSelectedDetailsVaga(vaga)}
                                className="p-1 px-2 border border-slate-200 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors"
                                title="Visualização Rápida Lateral"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                              {canManageVagas && (
                                <button
                                  onClick={() => startEditing(vaga)}
                                  className="p-1 px-2 border border-slate-200 text-orange-600 hover:text-white rounded-lg hover:bg-orange-500 hover:border-orange-500 transition-colors"
                                  title="Editar Vaga"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            {/* Direct state switcher */}
                            {canManageVagas && (
                              <div className="flex items-center gap-1.5">
                                {vaga.status === 'ABERTA' && (
                                  <button
                                    onClick={() => updateVaga(vaga.id, { status: 'DOCUMENTAÇÃO', etapa: 'Contratação / Docs' })}
                                    className="p-1 px-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white text-[8px] font-bold uppercase rounded transition-colors"
                                    title="Mover para admissão de documentos"
                                  >
                                    Admitir &rarr;
                                  </button>
                                )}
                                {vaga.status === 'DOCUMENTAÇÃO' && (
                                  <button
                                    onClick={() => handleOpenConcludeModal(vaga)}
                                    className="p-1 px-1.5 bg-emerald-55 border border-emerald-150 text-emerald-800 hover:bg-emerald-600 hover:text-white text-[8px] font-extrabold uppercase rounded transition-colors shadow-sm"
                                    title="Concluir e fechar vaga"
                                  >
                                    Concluir ✓
                                  </button>
                                )}
                                {vaga.status === 'PAUSADA' && (
                                  <button
                                    onClick={() => updateVaga(vaga.id, { status: 'ABERTA' })}
                                    className="p-1 px-1.5 bg-amber-50 border border-amber-100 text-amber-700 hover:bg-amber-600 hover:text-white text-[8px] font-bold uppercase rounded transition"
                                    title="Reativar vaga"
                                  >
                                    Reabrir &rarr;
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3A-bis: KANBAN POR ETAPA (visão alternativa — funil do processo) */}
      {viewMode === 'kanban' && kanbanGroupBy === 'etapa' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {ETAPAS_FUNIL.map((etapa, idx) => {
              const etapaVagas = filteredVagas.filter(v => v.status !== 'FECHADA' && normalizeEtapa(v) === etapa);
              const isDraggedOver = draggedOverLaneId === `etapa-${etapa}`;
              const topAccent = ['border-t-slate-400', 'border-t-amber-500', 'border-t-indigo-500', 'border-t-blue-500', 'border-t-emerald-500'][idx] || 'border-t-slate-400';
              const dotColor = ['bg-slate-400', 'bg-amber-500', 'bg-indigo-500', 'bg-blue-500', 'bg-emerald-500'][idx] || 'bg-slate-400';
              return (
                <div
                  key={etapa}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnter={() => setDraggedOverLaneId(`etapa-${etapa}`)}
                  onDragLeave={() => { if (draggedOverLaneId === `etapa-${etapa}`) setDraggedOverLaneId(null); }}
                  onDrop={(e) => {
                    if (!canManageVagas) return;
                    const vagaId = e.dataTransfer.getData('text/plain');
                    handleEtapaDrop(vagaId, etapa);
                    setDraggedOverLaneId(null);
                  }}
                  className={`bg-slate-50 border border-t-4 ${topAccent} p-3 rounded-2xl flex flex-col space-y-3 min-h-[480px] transition-all duration-200 ${
                    isDraggedOver ? 'border-dashed border-orange-500 bg-orange-50/20 ring-4 ring-orange-500/5' : 'border-slate-200/80'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                      <h3 className="font-extrabold text-slate-850 text-xs tracking-tight">{etapa}</h3>
                    </div>
                    <span className="text-[10px] font-extrabold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">{etapaVagas.length}</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 max-h-[600px] scrollbar-thin pr-1">
                    {etapaVagas.length === 0 ? (
                      <div className="h-24 border border-dashed border-slate-300 rounded-2xl flex items-center justify-center text-slate-400 italic text-[11px] p-4 text-center">Nenhuma vaga nesta etapa</div>
                    ) : (
                      etapaVagas.map(vaga => {
                        const dias = diasNestaEtapa(vaga);
                        const paused = isPausedOrSuspended(vaga.status);
                        const sla = getSlaInfo(dias, false, paused);
                        let borderLeftColor = 'border-l-emerald-500';
                        if (paused) borderLeftColor = 'border-l-slate-300';
                        else if (dias > SLA_META_DIAS) borderLeftColor = 'border-l-rose-500';
                        else if (dias > 10) borderLeftColor = 'border-l-amber-500';
                        const isCurrentlyDragging = draggingVagaId === vaga.id;
                        return (
                          <div
                            key={vaga.id}
                            draggable={canManageVagas}
                            onDragStart={(e) => { if (!canManageVagas) return; e.dataTransfer.setData('text/plain', vaga.id); setDraggingVagaId(vaga.id); }}
                            onDragEnd={() => setDraggingVagaId(null)}
                            className={`bg-white p-4 border border-slate-200 border-l-4 ${borderLeftColor} rounded-2xl shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-150 flex flex-col space-y-2.5 relative cursor-grab active:cursor-grabbing ${
                              isCurrentlyDragging ? 'opacity-30 scale-95' : ''
                            } ${paused ? 'bg-slate-50/60' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex items-center gap-1 min-w-0">
                                <GripVertical className="w-3 h-3 text-slate-300 shrink-0" />
                                <span className="text-[10px] font-mono text-slate-400 font-bold tracking-widest shrink-0">#{vaga.codigo}</span>
                              </div>
                              {paused ? (
                                <span className="text-[9px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase flex items-center gap-1"><Pause className="w-2.5 h-2.5" /> Pausada</span>
                              ) : (
                                <span className="text-[9px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-100 uppercase truncate">{etapa}</span>
                              )}
                            </div>

                            <div className="cursor-pointer" onClick={() => setSelectedDetailsVaga(vaga)} title="Ver detalhes">
                              <h4 className="font-bold text-slate-800 text-xs hover:text-orange-500 transition line-clamp-2 leading-tight">{vaga.vaga}</h4>
                            </div>

                            <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-500 font-medium pb-2 border-b border-slate-100">
                              <div className="flex items-center gap-1 min-w-0" title={`Sede: ${vaga.sede}`}><MapPin className="w-3 h-3 text-slate-400 shrink-0" /><span className="truncate">{getSedeSigla(vaga.sede)}</span></div>
                              <div className="flex items-center gap-1 min-w-0" title={`Setor: ${vaga.setor}`}><Layers className="w-3 h-3 text-slate-400 shrink-0" /><span className="truncate">{vaga.setor}</span></div>
                            </div>

                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-400">Nesta etapa</span>
                              <span className={`px-1.5 py-0.5 font-bold rounded-lg ${sla.color} text-[8px] uppercase tracking-wider`}>{dias} dias</span>
                            </div>

                            {canManageVagas && (
                              <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                                <button onClick={() => handleOpenConcludeModal(vaga)} className="flex-1 flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase rounded-lg py-1.5 transition-colors cursor-pointer" title="Concluir / contratar"><Check className="w-3 h-3" /> Concluir</button>
                                {paused ? (
                                  <button onClick={() => updateVaga(vaga.id, { status: 'ABERTA' })} className="flex-1 flex items-center justify-center gap-1 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 text-[10px] font-bold uppercase rounded-lg py-1.5 transition-colors cursor-pointer" title="Retomar vaga"><Play className="w-3 h-3" /> Retomar</button>
                                ) : (
                                  <button onClick={() => openPauseModal(vaga)} className="flex-1 flex items-center justify-center gap-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 text-[10px] font-bold uppercase rounded-lg py-1.5 transition-colors cursor-pointer" title="Pausar vaga"><Pause className="w-3 h-3" /> Pausar</button>
                                )}
                                <button onClick={() => startEditing(vaga)} className="p-1.5 border border-slate-200 text-slate-500 hover:text-orange-600 hover:border-orange-300 rounded-lg transition-colors shrink-0 cursor-pointer" title="Editar"><Edit2 className="w-3 h-3" /></button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {showConcluidasEtapa && (() => {
            const concluidas = filteredVagas.filter(v => v.status === 'FECHADA');
            return (
              <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-tight">Concluídas / Fechadas</h3>
                  <span className="text-[10px] font-extrabold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">{concluidas.length}</span>
                </div>
                {concluidas.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">Nenhuma vaga concluída no filtro atual.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {concluidas.map(vaga => (
                      <div key={vaga.id} onClick={() => setSelectedDetailsVaga(vaga)} className="border border-slate-200 border-l-4 border-l-emerald-500 rounded-xl p-2.5 cursor-pointer hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-mono text-slate-400 font-bold">#{vaga.codigo}</span>
                          <span className="text-[9px] text-emerald-700 font-bold uppercase">{vaga.tempoProcesso ? `${vaga.tempoProcesso}d` : ''}</span>
                        </div>
                        <h4 className="font-bold text-slate-800 text-xs truncate mt-0.5">{vaga.vaga}</h4>
                        <p className="text-[10px] text-slate-500 truncate">{getSedeSigla(vaga.sede)} · {vaga.aprovado || '—'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}

      {/* 3B: ADJUSTABLE DETAILED TABLE LIST */}
      {viewMode === 'tabela' && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto select-none">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  <th className="py-3 px-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('codigo')}>
                    <div className="flex items-center gap-1">
                      Cód <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('vaga')}>
                    <div className="flex items-center gap-1">
                      Cargo / Vaga <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Sede / Setor</th>
                  <th className="py-3 px-4">Status & Etapa</th>
                  <th className="py-3 px-4">Gestor Solicitante</th>
                  <th className="py-3 px-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('tempoProcesso')}>
                    <div className="flex items-center gap-1">
                      SLA Atual <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                {paginatedVagas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400 font-medium italic">
                      Nenhuma vaga localizada para os critérios ativos.
                    </td>
                  </tr>
                ) : (
                  paginatedVagas.map((vaga) => {
                    const diffDays = getDiasEmAberto(vaga);
                    const sla = getSlaInfo(diffDays, vaga.status === 'FECHADA', isPausedOrSuspended(vaga.status));

                    return (
                      <tr key={vaga.id} className="hover:bg-slate-50/60 transition-colors odd:bg-white even:bg-slate-50/15">
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-400 font-bold">#{vaga.codigo}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800 hover:text-orange-500 transition cursor-pointer leading-tight mb-0.5" onClick={() => setSelectedDetailsVaga(vaga)}>
                            {vaga.vaga}
                          </div>
                          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{vaga.responsavel || 'Equipe RH'}</div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1 font-semibold text-slate-700 leading-tight">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{getSedeSigla(vaga.sede)}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 leading-tight">
                              <Layers className="w-3 h-3 shrink-0" />
                              {vaga.setor}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1 items-start">
                             {getStatusBadge(vaga.status)}
                             {vaga.status !== 'FECHADA' && (
                               <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1 line-clamp-1">
                                  <Workflow className="w-3 h-3 text-slate-400" />
                                  {vaga.etapa || 'Triagem'}
                               </span>
                             )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-700 font-bold">{vaga.solicitante}</td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {vaga.status === 'FECHADA' ? (
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full text-[11px] border border-emerald-150">
                              {vaga.tempoProcesso} dias
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 font-bold rounded-lg text-[9px] uppercase border font-sans ${sla.color}`}>
                              {diffDays} dias ({sla.label.split(' ').pop()})
                            </span>
                          )}
                        </td>

                        {/* Actions block */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedDetailsVaga(vaga)}
                              className="p-1.5 px-2.5 border border-slate-200 bg-white shadow-sm text-slate-700 hover:text-orange-600 hover:border-orange-200 hover:bg-orange-50 rounded-xl text-[10px] font-bold cursor-pointer inline-flex items-center gap-1 transition"
                              title="Visualizar Informações Completas"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-400" />
                              Detalhes
                            </button>

                            {canManageVagas && (
                              <>
                                <button
                                  onClick={() => startEditing(vaga)}
                                  className="p-1.5 px-2.5 text-slate-700 bg-white shadow-sm hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 rounded-xl text-[10px] font-bold cursor-pointer inline-flex items-center gap-1 transition"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                  Editar
                                </button>
                                {vaga.status !== 'FECHADA' && (
                                  <button
                                    onClick={() => handleOpenConcludeModal(vaga)}
                                    className="p-1 px-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 rounded-lg cursor-pointer inline-flex items-center gap-0.5 transition"
                                    title="Concluir e fechar vaga"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    if (confirmAction) {
                                      confirmAction(
                                        "Excluir Vaga Permanentemente",
                                        `Você tem certeza de que deseja remover permanentemente o registro da vaga #${vaga.codigo} - "${vaga.vaga}"? Esta ação é irreversível.`,
                                        () => deleteVaga(vaga.id)
                                      );
                                    } else {
                                      if(confirm(`Deletar a vaga #${vaga.codigo} permanentemente?`)) {
                                        deleteVaga(vaga.id);
                                      }
                                    }
                                  }}
                                  className="p-1.5 px-2.5 text-rose-600 bg-rose-50/50 border border-rose-150 hover:border-rose-300 hover:bg-rose-50 shadow-sm rounded-xl text-[10px] font-bold cursor-pointer inline-flex items-center gap-1 transition"
                                  title="Deletar permanentemente"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                  Excluir
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Simple Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Página {currentPage} de {totalPages}</span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="p-1.5 px-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="p-1.5 px-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3C: GRADE/BENTO CARD FLOW VIEW */}
      {viewMode === 'grade' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedVagas.length === 0 ? (
              <div className="col-span-full text-center py-12 text-slate-400 font-semibold italic">
                Nenhuma vaga encontrada para exibir em cartões.
              </div>
            ) : (
              paginatedVagas.map(vaga => {
                const diffDays = getDiasEmAberto(vaga);
                const sla = getSlaInfo(diffDays, vaga.status === 'FECHADA', isPausedOrSuspended(vaga.status));

                let borderLeftColor = 'border-l-emerald-500';
                if (isPausedOrSuspended(vaga.status)) {
                  borderLeftColor = 'border-l-slate-300';
                } else if (vaga.status === 'FECHADA') {
                  borderLeftColor = 'border-l-indigo-500';
                } else if (diffDays > SLA_META_DIAS) {
                  borderLeftColor = 'border-l-rose-500';
                } else if (diffDays > 10) {
                  borderLeftColor = 'border-l-amber-500';
                }

                return (
                  <div key={vaga.id} className={`bg-white rounded-3xl border border-slate-200 border-l-4 ${borderLeftColor} p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4`}>
                    {/* Header bar of card */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-slate-400 tracking-wider">#{vaga.codigo}</span>
                      <div>{getStatusBadge(vaga.status)}</div>
                    </div>

                    {/* Vaga Info */}
                    <div className="space-y-1 cursor-pointer" onClick={() => setSelectedDetailsVaga(vaga)}>
                      <h4 className="font-bold text-slate-850 hover:text-orange-500 transition line-clamp-1 text-sm">{vaga.vaga}</h4>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-150 rounded-lg px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          {getSedeSigla(vaga.sede)}
                        </span>
                        <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-150 rounded-lg px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          <Layers className="w-3 h-3 text-slate-400 shrink-0" />
                          {vaga.setor}
                        </span>
                      </div>
                    </div>

                    {/* SLA Progress Bar inside Card */}
                    <div className="space-y-1 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between text-[9px] font-bold">
                        <span className="text-slate-405 leading-none">Dias Processo</span>
                        <span className={`px-1.5 py-0.5 rounded leading-none ${sla.color} font-extrabold uppercase`}>
                          {diffDays} dias
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                        <div className={`h-full ${sla.progressBar}`} style={{ width: `${sla.percent}%` }}></div>
                      </div>
                      <p className="text-[8px] text-slate-400 leading-none">{sla.desc}</p>
                    </div>

                    {/* Hired Candidate info if closed */}
                    {vaga.status === 'FECHADA' && (
                      <div className="bg-emerald-50/50 p-2 rounded-xl border border-emerald-100/70 flex items-center justify-between text-[10px]">
                        <span className="text-emerald-700 font-extrabold uppercase text-[8px] tracking-wider shrink-0">Contratado</span>
                        <span className="truncate max-w-[140px] text-emerald-800 font-bold flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600 inline-block shrink-0" />
                          <span>{vaga.aprovado || 'Não especificado'}</span>
                        </span>
                      </div>
                    )}

                    {/* Footer managers line */}
                    <div className="space-y-1 pb-1 text-[10px] font-sans">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-semibold uppercase text-[8px] tracking-wider">Gestor</span>
                        <span className="text-slate-700 font-bold truncate max-w-[120px]">{vaga.solicitante}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-semibold uppercase text-[8px] tracking-wider">Recrutado</span>
                        <span className="text-slate-600 font-medium italic">{vaga.responsavel || 'RH'}</span>
                      </div>
                    </div>

                    {/* Card action footer link */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] font-bold">
                      <button 
                        onClick={() => setSelectedDetailsVaga(vaga)}
                        className="text-orange-500 hover:text-orange-700 transition cursor-pointer flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Detalhes</span>
                      </button>

                      {canManageVagas && (
                        <div className="flex items-center gap-2">
                          {vaga.status !== 'FECHADA' && (
                            <button 
                              onClick={() => handleOpenConcludeModal(vaga)}
                              className="text-emerald-600 hover:text-emerald-800 transition cursor-pointer flex items-center gap-0.5"
                              title="Concluir e fechar vaga"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Concluir</span>
                            </button>
                          )}
                          <button 
                            onClick={() => startEditing(vaga)}
                            className="text-slate-705 hover:text-slate-900 transition cursor-pointer flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3 text-slate-400" />
                            <span>Editar</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Simple Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center p-4 gap-4">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold font-sans disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer"
              >
                Anterior
              </button>
              <span className="text-xs font-semibold text-slate-500 uppercase">Página {currentPage} de {totalPages}</span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold font-sans disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer"
              >
                Próximo
              </button>
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: SLIDING RIGHT DETAILS DRAWER (THE MAGICAL UX PIECE) */}
      {selectedDetailsVaga && (
        <div className="fixed inset-0 z-[120] flex justify-end animate-fade-in">
          {/* Backdrop Overlay */}
          <div 
            onClick={() => setSelectedDetailsVaga(null)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
          ></div>

          {/* Drawer Panel */}
          <div className="w-full max-w-lg bg-white h-full relative shadow-2xl z-[130] flex flex-col justify-between animate-in slide-in-from-right duration-300 transform">
            
            {/* Header Area */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-orange-100 rounded-2xl text-orange-600">
                  <Workflow className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-mono text-xs font-bold">VAGA #{selectedDetailsVaga.codigo}</span>
                    {getStatusBadge(selectedDetailsVaga.status)}
                  </div>
                  <h3 className="text-base font-bold text-slate-800 leading-snug mt-0.5">{selectedDetailsVaga.vaga}</h3>
                </div>
              </div>
              <button 
                onClick={() => setSelectedDetailsVaga(null)}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-850 cursor-pointer shadow-sm transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Attributes Body */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6 scrollbar-thin">
              
              {/* Thermometer block of SLA */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <History className="w-4 h-4 text-orange-500" />
                    <span>Cronômetro de SLA</span>
                  </div>
                  <span className={`px-2 py-0.5 font-bold rounded-lg text-[9px] uppercase border font-sans ${
                    getSlaInfo(getDiasEmAberto(selectedDetailsVaga), selectedDetailsVaga.status === 'FECHADA', isPausedOrSuspended(selectedDetailsVaga.status)).color
                  }`}>
                    {getSlaInfo(getDiasEmAberto(selectedDetailsVaga), selectedDetailsVaga.status === 'FECHADA', isPausedOrSuspended(selectedDetailsVaga.status)).label}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${getSlaInfo(getDiasEmAberto(selectedDetailsVaga), selectedDetailsVaga.status === 'FECHADA', isPausedOrSuspended(selectedDetailsVaga.status)).progressBar}`} 
                      style={{ width: `${getSlaInfo(getDiasEmAberto(selectedDetailsVaga), selectedDetailsVaga.status === 'FECHADA', isPausedOrSuspended(selectedDetailsVaga.status)).percent}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Abertura: {selectedDetailsVaga.solicitacao}</span>
                    <span className="font-bold text-slate-800">{getDiasEmAberto(selectedDetailsVaga)} dias decorridos</span>
                    {selectedDetailsVaga.conclusao && <span>Fechada: {selectedDetailsVaga.conclusao}</span>}
                  </div>
                </div>

                <p className="text-xs text-slate-500 font-medium italic">
                  {getSlaInfo(getDiasEmAberto(selectedDetailsVaga), selectedDetailsVaga.status === 'FECHADA', isPausedOrSuspended(selectedDetailsVaga.status)).desc}
                </p>
              </div>

              {/* General details grid (Bento Section 1) */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Origem & Identidade</h4>
                <div className="grid grid-cols-2 gap-3 text-xs leading-relaxed">
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider mb-0.5">Sede Organizacional</span>
                    <span className="text-slate-700 font-bold">{getSedeLabel(selectedDetailsVaga.sede)}</span>
                  </div>
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider mb-0.5">Setor / Departamento</span>
                    <span className="text-slate-700 font-bold">{selectedDetailsVaga.setor}</span>
                  </div>
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider mb-0.5">Sexo Preferencial</span>
                    <span className={`font-bold inline-flex ${selectedDetailsVaga.sexo === 'FEMININO' ? 'text-pink-700' : selectedDetailsVaga.sexo === 'MASCULINO' ? 'text-indigo-700' : 'text-slate-700'}`}>
                      {selectedDetailsVaga.sexo || 'Indiferente'}
                    </span>
                  </div>
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider mb-0.5">Recruiter Responsável</span>
                    <span className="text-slate-700 font-bold">{selectedDetailsVaga.responsavel || 'Equipe RH'}</span>
                  </div>
                </div>
              </div>

              {/* Requester details grid (Bento Section 2) */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Detalhes da Requisição</h4>
                <div className="grid grid-cols-2 gap-3 text-xs leading-relaxed">
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 col-span-2">
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider mb-0.5">Gestor Solicitante</span>
                    <span className="text-slate-750 font-bold">{selectedDetailsVaga.solicitante}</span>
                  </div>
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider mb-0.5">Motivo de Abertura</span>
                    <span className="text-slate-750 font-semibold">{selectedDetailsVaga.motivo || 'Substituição'}</span>
                  </div>
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider mb-0.5">Funcional Substituído</span>
                    <span className="text-slate-750 font-semibold italic">{selectedDetailsVaga.funcionarioSubstituido || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Dynamic workflow attributes (Bento Section 3) */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Status & Contratação</h4>
                <div className="grid grid-cols-2 gap-3 text-xs leading-relaxed">
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider mb-0.5">Etapa Atual no SGPC</span>
                    <span className="text-orange-700 font-bold bg-orange-50 px-2 py-0.5 rounded border border-orange-150 uppercase text-[9px] inline-block mt-0.5">
                      {selectedDetailsVaga.etapa || 'Triagem'}
                    </span>
                  </div>
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider mb-0.5">Candidato Selecionado</span>
                    <span className={`font-bold flex items-center gap-1.5 ${selectedDetailsVaga.status === 'FECHADA' ? 'text-emerald-850' : 'text-slate-700'}`}>
                      {selectedDetailsVaga.aprovado ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>{selectedDetailsVaga.aprovado}</span>
                        </>
                      ) : selectedDetailsVaga.status === 'FECHADA' ? (
                        <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 text-[10px] uppercase font-extrabold flex items-center gap-1">
                          ⚠️ Não informado
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium italic">Ainda em aberto</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Funil de candidatos (indicadores do processo) */}
              {(!!selectedDetailsVaga.candChamados || !!selectedDetailsVaga.candCompareceram || !!selectedDetailsVaga.candAprovados || !!selectedDetailsVaga.motivoDesistencia) && (
                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Funil de Candidatos</h4>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                      <span className="block text-lg font-extrabold text-slate-800">{selectedDetailsVaga.candChamados || 0}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Chamados</span>
                    </div>
                    <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                      <span className="block text-lg font-extrabold text-blue-700">{selectedDetailsVaga.candCompareceram || 0}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Compareceram</span>
                    </div>
                    <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                      <span className="block text-lg font-extrabold text-emerald-700">{selectedDetailsVaga.candAprovados || 0}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Aprovados</span>
                    </div>
                  </div>
                  {selectedDetailsVaga.motivoDesistencia && (
                    <div className="flex items-center gap-2 text-[11px] bg-rose-50/50 border border-rose-100 rounded-xl px-3 py-2">
                      <span className="font-bold text-rose-700 uppercase text-[9px]">Desistência:</span>
                      <span className="text-slate-700 font-semibold">{selectedDetailsVaga.motivoDesistencia}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Notes block */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Informações Complementares</h4>
                <div className="bg-orange-50/15 border border-orange-100/70 rounded-2xl p-4 text-xs text-slate-700 font-medium relative italic leading-relaxed">
                  <FileText className="absolute right-4 top-4 text-slate-205 w-5 h-5 shrink-0 opacity-40" />
                  <p className="whitespace-pre-line">
                    {selectedDetailsVaga.observacoes || "Nenhuma anotação adicional registrada para o processo seletivo deste cargo."}
                  </p>
                </div>
              </div>

              {/* Histórico / timeline a partir dos logs (carregados só para admin) */}
              {logs && logs.length > 0 && (() => {
                const marca = `#${selectedDetailsVaga.codigo}`;
                const vagaLogs = logs
                  .filter(l => l.modulo === 'Vagas' && l.detalhes.includes(marca))
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .slice(0, 12);
                return (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Histórico da Vaga</h4>
                    {vagaLogs.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">Nenhum registro de alteração para esta vaga.</p>
                    ) : (
                      <ul className="space-y-2.5 pt-1">
                        {vagaLogs.map(l => (
                          <li key={l.id} className="flex gap-2.5 text-[11px]">
                            <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${l.acao === 'EXCLUIU' ? 'bg-rose-500' : l.acao === 'CRIOU' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                            <div className="min-w-0">
                              <p className="text-slate-700 font-semibold leading-snug">{l.detalhes}</p>
                              <p className="text-[10px] text-slate-400 font-medium mt-0.5">{new Date(l.timestamp).toLocaleString('pt-BR')} · {l.usuario}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })()}

            </div>

            {/* Quick Actions Footer inside Drawer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                onClick={() => setSelectedDetailsVaga(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold rounded-xl text-slate-650 cursor-pointer transition"
              >
                Fechar Detalhes
              </button>

              {canManageVagas && (
                <div className="flex items-center gap-2">
                  {selectedDetailsVaga.status !== 'FECHADA' && (
                    <button
                      onClick={() => handleOpenConcludeModal(selectedDetailsVaga)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 font-bold text-white text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Concluir Vaga
                    </button>
                  )}
                  <button
                    onClick={() => {
                      startEditing(selectedDetailsVaga);
                    }}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 font-bold text-white text-xs rounded-xl flex items-center gap-1 cursor-pointer transition shadow-none"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Editar Registro
                  </button>
                  <button
                    onClick={() => {
                      if (confirmAction) {
                        confirmAction(
                          "Deletar Vaga",
                          `Confirmar remoção permanente da vaga de "${selectedDetailsVaga.vaga}"?`,
                          async () => {
                            await deleteVaga(selectedDetailsVaga.id);
                            setSelectedDetailsVaga(null);
                          }
                        );
                      } else {
                        if(confirm(`Excluir permanentemente?`)) {
                          deleteVaga(selectedDetailsVaga.id);
                          setSelectedDetailsVaga(null);
                        }
                      }
                    }}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition"
                    title="Excluir Vaga"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir Vaga
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* SECTION 5: MODALS (ORIGINAL COMPATIBILITY BACKUP) */}
      
      {/* 5A: MODIFY/EDIT VACANCY MODAL */}
      {editingVaga && (
        <EditVacancyModal 
          vaga={editingVaga}
          cargos={cargos}
          sedes={sedes}
          setores={setores}
          onClose={() => setEditingVaga(null)}
          onSave={handleEditSave}
        />
      )}

      {/* 5B: CREATE NEW VACANCY DIALOG */}
      {showAddVagaModal && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 block">
          <div className="w-full max-w-3xl transform transition-all duration-200 scale-100 flex flex-col relative">
            <button 
              onClick={() => setShowAddVagaModal(false)}
              className="absolute right-5 top-5 bg-slate-50 border border-slate-200 hover:bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center text-slate-550 hover:text-slate-800 text-xl font-semibold leading-none cursor-pointer z-10 shadow-sm"
              aria-label="Fecar formulário"
            >
              &times;
            </button>
            <div className="max-h-[85vh] overflow-y-auto rounded-3xl shadow-2xl">
              <AddVacancyForm 
                addVaga={addVaga} 
                sedes={sedes}
                cargos={cargos}
                setores={setores}
                onSuccess={() => setShowAddVagaModal(false)}
                userSede={userSede}
              />
            </div>
          </div>
        </div>
      )}

      {/* 5C: BEAUTIFUL DIALOG FOR CONCLUDING VACANCY (PROMPT ALTERNATIVE) */}
      {vagaToConclude && (
        <ConcludeVacancyModal
          vaga={vagaToConclude}
          onClose={() => setVagaToConclude(null)}
          onConclude={handleSaveConclusion}
        />
      )}

      {/* Modal: confirmar a data da pausa (congela o SLA a partir dela) */}
      {vagaToPause && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center">
                <Pause className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-800">Pausar vaga</h3>
                <p className="text-[11px] text-slate-500 font-semibold truncate">#{vagaToPause.codigo} · {vagaToPause.vaga}</p>
              </div>
            </div>
            <div className="p-6 space-y-2">
              <label htmlFor="pause-date" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Pausada desde</label>
              <input
                id="pause-date"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={pauseDateISO}
                onChange={(e) => setPauseDateISO(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-slate-500/10 focus:border-slate-500 focus:outline-none rounded-xl cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 font-medium leading-relaxed">A partir desta data o SLA fica congelado. Ajuste se a vaga foi pausada num dia anterior.</p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setVagaToPause(null)}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold rounded-xl text-slate-650 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const alvo = vagaToPause;
                  const data = pauseDateISO || new Date().toISOString().slice(0, 10);
                  setVagaToPause(null);
                  await updateVaga(alvo.id, { status: 'PAUSADA', pausadaDesde: data });
                }}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-bold rounded-xl text-white shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <Pause className="w-4 h-4" /> Pausar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de transição de etapa: avanço Triagem→Entrevista pede o funil;
          retorno (voltar etapa) pede o motivo de desistência. */}
      {etapaMove && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${etapaMove.tipo === 'desistencia' ? 'bg-rose-100 text-rose-600' : 'bg-orange-100 text-orange-600'}`}>
                {etapaMove.tipo === 'desistencia' ? <AlertTriangle className="w-5 h-5" /> : <Workflow className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-800">
                  {etapaMove.tipo === 'desistencia' ? `Voltar para "${etapaMove.novaEtapa}"` : `Mover para "${etapaMove.novaEtapa}"`}
                </h3>
                <p className="text-[11px] text-slate-500 font-semibold truncate">#{etapaMove.vaga.codigo} · {etapaMove.vaga.vaga}</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {etapaMove.tipo === 'funil' ? (
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Funil de candidatos</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="move-chamados" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Chamados</label>
                      <input id="move-chamados" type="number" min={0} value={moveChamados} onChange={(e) => setMoveChamados(Number(e.target.value))} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl" />
                    </div>
                    <div>
                      <label htmlFor="move-compareceram" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Compareceram</label>
                      <input id="move-compareceram" type="number" min={0} value={moveCompareceram} onChange={(e) => setMoveCompareceram(Number(e.target.value))} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl" />
                    </div>
                    <div>
                      <label htmlFor="move-aprovados" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Aprovados</label>
                      <input id="move-aprovados" type="number" min={0} value={moveAprovados} onChange={(e) => setMoveAprovados(Number(e.target.value))} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl" />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label htmlFor="move-motivo" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Por que a vaga voltou de etapa?</label>
                  <select id="move-motivo" value={moveMotivo} onChange={(e) => setMoveMotivo(e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:outline-none rounded-xl cursor-pointer">
                    <option value="">— Não se aplica —</option>
                    {MOTIVOS_DESISTENCIA.map((m, i) => (<option key={i} value={m}>{m}</option>))}
                  </select>
                  <p className="text-[11px] text-slate-400 font-medium mt-2 leading-relaxed">Use quando um candidato desistiu/caiu e o processo precisou retroceder.</p>
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setEtapaMove(null)} className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold rounded-xl text-slate-650 transition cursor-pointer">Cancelar</button>
              {etapaMove.tipo === 'desistencia' ? (
                <button type="button" onClick={confirmEtapaMove} className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-xs font-bold rounded-xl text-white shadow-md transition cursor-pointer flex items-center gap-1.5">
                  <ChevronLeft className="w-4 h-4" /> Voltar etapa
                </button>
              ) : (
                <button type="button" onClick={confirmEtapaMove} className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-xs font-bold rounded-xl text-white shadow-md transition cursor-pointer flex items-center gap-1.5">
                  <ChevronRight className="w-4 h-4" /> Mover
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5D: KANBAN ACCIDENTAL DRAG PREVENTION CONFIRMATION MODAL */}
      {dragMoveConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            {/* Header */}
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
                  <Workflow className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Confirmar Mudança de Fase</h3>
                  <p className="text-[11px] text-slate-500 font-semibold">Evite movimentações acidentais</p>
                </div>
              </div>
              <button 
                onClick={() => setDragMoveConfirm(null)}
                className="w-7 h-7 rounded-full bg-white border border-slate-205 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-5">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col gap-1.5 text-center">
                <span className="text-[10px] font-mono text-slate-400 font-bold tracking-widest">VAGA #{dragMoveConfirm.vagaCodigo}</span>
                <span className="text-xs font-extrabold text-slate-800 leading-tight">{dragMoveConfirm.vagaTitle}</span>
              </div>

              <div className="space-y-2">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center">Transição do Processo</span>
                
                <div className="grid grid-cols-7 items-center gap-2 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                  {/* Origin */}
                  <div className="col-span-3 text-center p-2.5 bg-white border border-slate-200/80 rounded-xl flex flex-col justify-center items-center gap-1 min-h-[64px]">
                    <span className="text-[9px] text-slate-400 uppercase font-bold">Origem</span>
                    <span className="text-xs font-bold text-slate-600 line-clamp-2 leading-tight">{dragMoveConfirm.oldLaneTitle}</span>
                  </div>

                  {/* Arrow Indicator */}
                  <div className="col-span-1 flex flex-col items-center justify-center text-slate-350">
                    <ChevronRight className="w-5 h-5 text-orange-500" />
                  </div>

                  {/* Destination */}
                  <div className="col-span-3 text-center p-2.5 bg-orange-50/30 border border-orange-200 rounded-xl flex flex-col justify-center items-center gap-1 min-h-[64px]">
                    <span className="text-[9px] text-orange-600 uppercase font-bold">Destino</span>
                    <span className="text-xs font-extrabold text-orange-700 line-clamp-2 leading-tight">{dragMoveConfirm.newLaneTitle}</span>
                  </div>
                </div>
              </div>

              <p className="text-xs font-semibold text-slate-500 leading-relaxed text-center px-2">
                Tem certeza que deseja mover esta vaga para a coluna <span className="font-extrabold text-slate-700">{dragMoveConfirm.newLaneTitle}</span>?
              </p>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDragMoveConfirm(null)}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold rounded-xl text-slate-650 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const { vagaId, laneId } = dragMoveConfirm;
                  setDragMoveConfirm(null);
                  await executeDragDrop(vagaId, laneId);
                }}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-xs font-bold rounded-xl text-white shadow-md shadow-orange-600/10 transition cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 text-white" />
                <span>Confirmar Transição</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
