/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useVagas } from './hooks/useVagas';
import { AddVacancyForm } from './components/AddVacancyForm';
import { HomeSection } from './components/HomeSection';
import { LoginPage } from './components/LoginPage';
// Seções pesadas carregadas sob demanda (code-splitting). Export nomeado → default.
const RecruitmentDashboard = lazy(() => import('./components/RecruitmentDashboard').then(m => ({ default: m.RecruitmentDashboard })));
const VacancyTable = lazy(() => import('./components/VacancyTable').then(m => ({ default: m.VacancyTable })));
const AdminPanel = lazy(() => import('./components/AdminPanel').then(m => ({ default: m.AdminPanel })));
import { useMetadata, type UserRole } from './hooks/useMetadata';
import { useLogs } from './hooks/useLogs';
import { useRequisicoes } from './hooks/useRequisicoes';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Bandeirinhas } from './components/Bandeirinhas';
import { useAppConfig } from './hooks/useAppConfig';

// Enfeites de época (sazonais). Para adicionar um novo: importe o componente e
// acrescente { id, nome, Comp, padrao } aqui — o admin liga/desliga no painel.
const ENFEITES = [
  { id: 'sao-joao', nome: 'São João — bandeirinhas no topo', Comp: Bandeirinhas, padrao: true },
];
import { useOperationalModules, addDaysToDate, DIAS_EXPERIENCIA_1, DIAS_EXPERIENCIA_2 } from './hooks/useOperationalModules';
const TreinamentosSection = lazy(() => import('./components/TreinamentosSection').then(m => ({ default: m.TreinamentosSection })));
const ExperienciasSection = lazy(() => import('./components/ExperienciasSection').then(m => ({ default: m.ExperienciasSection })));
const EntrevistasSection = lazy(() => import('./components/EntrevistasSection').then(m => ({ default: m.EntrevistasSection })));
const TurnoverSection = lazy(() => import('./components/TurnoverSection').then(m => ({ default: m.TurnoverSection })));
const RequisicoesSection = lazy(() => import('./components/RequisicoesSection').then(m => ({ default: m.RequisicoesSection })));
import { 
  Briefcase, 
  BarChart3, 
  PlusCircle,
  Layers,
  Inbox,
  Loader2,
  Lock,
  ShieldAlert,
  GraduationCap,
  ShieldCheck,
  HeartCrack,
  Percent,
  User
} from 'lucide-react';
import { auth, googleProvider, isFirebaseEnabled, db } from './lib/firebase';
import { signInWithPopup, signOut } from 'firebase/auth';

export default function App() {
  const [user, setUser] = useState<any>(null);
  // authReady: a verificação inicial de autenticação já concluiu (evita piscar a
  // tela de login para quem já está logado e evita travar no "Carregando").
  const [authReady, setAuthReady] = useState(false);
  // Tema único: Suíço (International Typographic). Aplicado via data-theme na raiz.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'swiss');
    try { localStorage.setItem('sgcp_theme', 'swiss'); } catch (e) {}
  }, []);
  const { vagas, loading, usingFirebase, errorMessage, addVaga, updateVaga, deleteVaga, importVagas } = useVagas(user);
  const [toast, setToast] = useState<{ message: string, type: 'error' | 'success' | 'info' | 'warning' } | null>(null);
  const [triggerAddModal, setTriggerAddModal] = useState(0);
  // Vaga focada a partir do Home (alerta de SLA) → filtra o Quadro de Vagas por ela.
  const [vagaFocus, setVagaFocus] = useState<{ codigo: string; token: number } | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importReplace, setImportReplace] = useState(false);
  const [importingSpreadsheet, setImportingSpreadsheet] = useState(false);
  const [importSelection, setImportSelection] = useState({
    vagas: true,
    treinamentos: true,
    entrevistas: true
  });

  const notify = (message: string, type: 'error' | 'success' | 'info' | 'warning' = 'info') => {
    setToast({ message, type });
    // Keep it readable and easily dismissible
    setTimeout(() => {
      setToast(prev => prev && prev.message === message ? null : prev);
    }, 6000);
  };

  const { 
    usuarios, 
    sedes, 
    regioes, 
    cargos, 
    setores,
    loading: loadingMetadata, 
    isAuthorized,
    userRole, 
    isAdmin, 
    isViewer,
    selectedRole,
    setSelectedRole,
    selectedSede,
    setSelectedSede,
    addUsuario, 
    updateUsuario,
    deleteUsuario, 
    addSede, 
    updateSede,
    deleteSede, 
    addRegiao, 
    updateRegiao,
    deleteRegiao, 
    addCargo, 
    deleteCargo,
    addSetor,
    deleteSetor 
  } = useMetadata(user);

  const {
    treinamentos,
    experiencias,
    entrevistas,
    turnover,
    loading: loadingOps,
    addTreinamento,
    updateTreinamento,
    deleteTreinamento,
    importTreinamentos,
    addExperiencia,
    updateExperiencia,
    deleteExperiencia,
    addEntrevista,
    updateEntrevista,
    deleteEntrevista,
    importEntrevistas,
    addTurnover,
    updateTurnover,
    deleteTurnover
  } = useOperationalModules(user);

  // Coordenador = admin regional: o escopo dele é a REGIÃO da sede a que está vinculado.
  const isCoord = selectedRole === 'Coordenador';
  const regiaoDe = (nome?: string) => (sedes.find(s => (s.nome || '').toLowerCase() === String(nome || '').toLowerCase())?.regiao || '');
  const userRegiao = regiaoDe(selectedSede);

  const { logs, logAction } = useLogs(user, isAdmin || isCoord, userRegiao);
  const { requisicoes, updateRequisicao } = useRequisicoes(user, isAdmin);
  const requisicoesPendentes = requisicoes.filter(r => r.status === 'pendente').length;
  const { enfeites, setEnfeite } = useAppConfig(user);
  const enfeiteAtivo = (e: { id: string; padrao: boolean }) => enfeites[e.id] ?? e.padrao;

  const [activeTab, setActiveTab] = useState<'home' | 'dashboard' | 'vagas' | 'treinamentos' | 'experiencias' | 'entrevistas' | 'turnover' | 'requisicoes' | 'admin'>('home');
  const scopedUserSede = isViewer ? '' : selectedSede;
  const canManageModules = !isViewer;

  // Isolamento por unidade (Colégio × Universidade): vagas da Universidade (origem da
  // planilha, ou sede em região "Universidade") só aparecem para quem é da Universidade.
  // Como o resto do sistema (dashboard, SLA, Home) consome ESTA lista, ninguém de fora
  // vê — nem entra na conta — as vagas da outra unidade. Administrador vê tudo (gestão).
  // Isolamento por UNIDADE (Colégio × Universidade) — vale para todos os não-admin,
  // inclusive o Coordenador. As 5 regiões do Colégio se enxergam entre si; só a
  // Universidade é separada. (A única coisa "Universidade" são as vagas da planilha;
  // por isso o corte é só nas vagas — treinos/experiências/entrevistas são todos Colégio.)
  const scopedVagas = useMemo(() => {
    if (selectedRole === 'Administrador') return vagas;
    const isUniSede = (nome?: string) => {
      const s = sedes.find(x => (x.nome || '').toLowerCase() === (nome || '').toLowerCase());
      return (s?.regiao || '').toLowerCase() === 'universidade';
    };
    const usuarioEhUni = isUniSede(selectedSede);
    return vagas.filter(v =>
      (((v.origem || '').indexOf('planilha-universidade') === 0) || isUniSede(v.sede)) === usuarioEhUni
    );
  }, [vagas, sedes, selectedSede, selectedRole]);

  // Painel admin do Coordenador: vê/gerencia só o Colégio (regiões != Universidade).
  // Usuário sem sede (ex.: Visualizador) conta como Colégio. Admin vê tudo.
  const ehUniRegiao = (nome?: string) => regiaoDe(nome).toLowerCase() === 'universidade';
  const adminUsuarios = useMemo(() => isCoord ? (usuarios || []).filter(u => !ehUniRegiao(u.sede)) : (usuarios || []), [usuarios, isCoord, sedes]);
  const adminSedes = useMemo(() => isCoord ? (sedes || []).filter(s => (s.regiao || '').toLowerCase() !== 'universidade') : (sedes || []), [sedes, isCoord]);
  const adminRegioes = useMemo(() => isCoord ? (regioes || []).filter(r => (r.nome || '').toLowerCase() !== 'universidade') : (regioes || []), [regioes, isCoord]);

  // Sedes oferecidas nos filtros/forms das seções: não-admin só vê as sedes da sua
  // unidade (Colégio NÃO lista sedes da Universidade, e vice-versa). Admin vê todas.
  const scopedSedes = useMemo(() => {
    if (selectedRole === 'Administrador') return sedes || [];
    const usuarioEhUni = regiaoDe(selectedSede).toLowerCase() === 'universidade';
    return (sedes || []).filter(s => ((s.regiao || '').toLowerCase() === 'universidade') === usuarioEhUni);
  }, [sedes, selectedSede, selectedRole]);

  // Custom global confirmation modal & loading state
  const [globalLoading, setGlobalLoading] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    confirmText?: string;
    cancelText?: string;
  } | null>(null);

  const askConfirmation = (title: string, message: string, onConfirm: () => void | Promise<void>) => {
    setConfirmModal({
      title,
      message,
      onConfirm
    });
  };

  // Foco de vaga vindo do Home: troca pra aba Vagas e filtra pelo código (token
  // novo a cada clique força o VacancyTable a reaplicar o filtro).
  const handleFocusVaga = (v: any) => {
    if (v?.codigo == null) { setActiveTab('vagas'); return; }
    setVagaFocus({ codigo: String(v.codigo), token: Date.now() });
    setActiveTab('vagas');
  };

  // Limpa o foco ao sair da aba Vagas, senão ao voltar o VacancyTable remonta e
  // reaplica o filtro antigo (bug: "voltei e continuava filtrado").
  useEffect(() => {
    if (activeTab !== 'vagas') setVagaFocus(null);
  }, [activeTab]);

  const executeWithLoading = async (message: string, task: () => Promise<void>) => {
    setGlobalLoading(message);
    try {
      await task();
    } catch (err: any) {
      notify(`Erro no processamento: ${err.message || err}`, "error");
    } finally {
      setGlobalLoading(null);
    }
  };

  // Wrapped operations for automatic loading states, error notifications and audit logging
  const wrappedAddVaga = (vagaInput: any) => 
    executeWithLoading("Cadastrando nova vaga no SGPC...", async () => {
      await addVaga(vagaInput);
      await logAction('CRIOU', 'Vagas', `Vaga "${vagaInput.vaga}" (Sede: ${vagaInput.sede || selectedSede}) cadastrada.`);
    });
    
  // Requisições: aceitar cria a vaga (campos extras vão pras observações); recusar registra o motivo.
  const handleAceitarRequisicao = (req: any) =>
    executeWithLoading("Aceitando requisição e criando vaga...", async () => {
      const obs = [
        `Origem: requisição (${req.tipoContratacao}).`,
        req.selecao && `Seleção: ${req.selecao}.`,
        req.justificativa && `Justificativa: ${req.justificativa}`,
        req.jornada && `Jornada/Horário: ${req.jornada}`,
        req.idade && `Idade: ${req.idade}`,
        req.experiencia && `Experiência: ${req.experiencia}`,
        req.salarioBeneficios && `Salário/Benefícios: ${req.salarioBeneficios}`,
        req.hardSkills && `Hard skills: ${req.hardSkills}`,
        req.softSkills && `Soft skills: ${req.softSkills}`,
        req.responsabilidades && `Responsabilidades: ${req.responsabilidades}`,
        req.gestorEmail && `Contato do gestor: ${req.gestorEmail}`,
      ].filter(Boolean).join('\n');
      let solic = new Date().toLocaleDateString('pt-BR');
      try { solic = new Date(req.criadaEm).toLocaleDateString('pt-BR'); } catch (e) {}
      await addVaga({
        vaga: req.cargo,
        sede: req.sede,
        setor: req.setor || 'Geral',
        status: 'ABERTA',
        solicitacao: solic,
        solicitante: req.gestorSolicitante,
        motivo: req.tipoContratacao,
        responsavel: 'RH',
        etapa: 'Triagem',
        categoria: 'Requisição',
        observacoes: obs,
      } as any);
      await updateRequisicao(req.id, { status: 'aceita', decididaEm: new Date().toISOString(), decididaPor: user?.email || 'sistema' });
      await logAction('CRIOU', 'Vagas', `Vaga "${req.cargo}" criada a partir de requisição (gestor: ${req.gestorSolicitante}).`);
      notify('Requisição aceita — vaga criada!', 'success');
    });

  const handleRecusarRequisicao = (req: any, motivo: string) =>
    executeWithLoading("Recusando requisição...", async () => {
      await updateRequisicao(req.id, { status: 'recusada', motivoRecusa: motivo || '', decididaEm: new Date().toISOString(), decididaPor: user?.email || 'sistema' });
      await logAction('ALTEROU', 'Vagas', `Requisição de "${req.cargo}" (gestor: ${req.gestorSolicitante}) recusada.`);
      notify('Requisição recusada.', 'info');
    });

  const wrappedUpdateVaga = (id: string, updatedFields: any) =>
    executeWithLoading("Sincronizando modificação de vaga...", async () => {
      const v = vagas.find(item => item.id === id);
      await updateVaga(id, updatedFields);
      let details = `Vaga #${v?.codigo || id} ("${v?.vaga || ''}") foi alterada.`;
      if (updatedFields.status && v?.status !== updatedFields.status) {
        details += ` Status de "${v?.status || ''}" para "${updatedFields.status}".`;
      }
      if (updatedFields.etapa && v?.etapa !== updatedFields.etapa) {
        details += ` Etapa de "${v?.etapa || ''}" para "${updatedFields.etapa}".`;
      }
      if (updatedFields.responsavel && v?.responsavel !== updatedFields.responsavel) {
        details += ` Responsável alterado para "${updatedFields.responsavel}".`;
      }
      await logAction('ALTEROU', 'Vagas', details);
    });
    
  const wrappedDeleteVaga = (id: string) => 
    executeWithLoading("Removendo vaga e atualizando fluxo...", async () => {
      const v = vagas.find(item => item.id === id);
      await deleteVaga(id);
      await logAction('EXCLUIU', 'Vagas', `Vaga #${v?.codigo || id} ("${v?.vaga || ''}") excluída permanentemente.`);
    });

  const wrappedAddTreinamento = (input: any) => 
    executeWithLoading("Sincronizando registro de treinamento...", async () => {
      await addTreinamento(input);
      await logAction('CRIOU', 'Treinamentos', `Treinamento sobre "${input.tema || ''}" registrado na unidade "${input.unidade || ''}".`);
    });

  const wrappedDeleteTreinamento = (id: string) => 
    executeWithLoading("Excluindo registro de treinamento...", async () => {
      const t = treinamentos.find(item => item.id === id);
      await deleteTreinamento(id);
      await logAction('EXCLUIU', 'Treinamentos', `Treinamento #${t?.codigo || id} sobre "${t?.tema || ''}" excluído.`);
    });

  const wrappedUpdateTreinamento = (id: string, updatedFields: any) =>
    executeWithLoading("Atualizando registro de treinamento...", async () => {
      const t = treinamentos.find(item => item.id === id);
      await updateTreinamento(id, updatedFields);
      await logAction('ALTEROU', 'Treinamentos', `Treinamento #${t?.codigo || id} sobre "${updatedFields.tema || t?.tema || ''}" atualizado.`);
    });

  const wrappedAddExperiencia = (input: any) => 
    executeWithLoading("Gravando acompanhamento de experiência...", async () => {
      await addExperiencia(input);
      await logAction('CRIOU', 'Experiências', `Acompanhamento de experiência criado para o colaborador "${input.colaborador}" (Setor: ${input.setor || ''}).`);
    });

  const wrappedUpdateExperiencia = (id: string, updatedFields: any) => 
    executeWithLoading("Sincronizando status de acompanhamento...", async () => {
      const exp = experiencias.find(item => item.id === id);
      await updateExperiencia(id, updatedFields);
      let details = `Acompanhamento do colaborador "${exp?.colaborador || id}" atualizado.`;
      if (updatedFields.status && exp?.status !== updatedFields.status) {
        details += ` Status alterado de "${exp?.status || ''}" para "${updatedFields.status}".`;
      }
      await logAction('ALTEROU', 'Experiências', details);
    });

  const wrappedDeleteExperiencia = (id: string) => 
    executeWithLoading("Excluindo registro de experiência...", async () => {
      const exp = experiencias.find(item => item.id === id);
      await deleteExperiencia(id);
      await logAction('EXCLUIU', 'Experiências', `Acompanhamento do colaborador "${exp?.colaborador || ''}" excluído.`);
    });

  const wrappedAddEntrevista = (input: any) => 
    executeWithLoading("Registrando entrevista de desligamento...", async () => {
      await addEntrevista(input);
      await logAction('CRIOU', 'Entrevistas', `Entrevista de desligamento de "${input.colaborador}" ("${input.funcao || ''}") registrada.`);
    });

  const wrappedDeleteEntrevista = (id: string) => 
    executeWithLoading("Excluindo entrevista de desligamento...", async () => {
      const ent = entrevistas.find(item => item.id === id);
      await deleteEntrevista(id);
      await logAction('EXCLUIU', 'Entrevistas', `Entrevista de desligamento de "${ent?.colaborador || ''}" removida.`);
    });

  const wrappedUpdateEntrevista = (id: string, updatedFields: any) =>
    executeWithLoading("Atualizando entrevista de desligamento...", async () => {
      const ent = entrevistas.find(item => item.id === id);
      await updateEntrevista(id, updatedFields);
      await logAction('ALTEROU', 'Entrevistas', `Entrevista de desligamento de "${updatedFields.colaborador || ent?.colaborador || ''}" atualizada.`);
    });

  const wrappedAddTurnover = (input: any) => 
    executeWithLoading("Processando dados de Headcount & Turnover...", async () => {
      await addTurnover(input);
      await logAction('CRIOU', 'Turnover', `Balanço mensal de Headcount/Turnover cadastrado para o mês/ano "${input.mesAno}".`);
    });

  const wrappedDeleteTurnover = (id: string) => 
    executeWithLoading("Ajustando logs de indicadores...", async () => {
      const turn = turnover.find(item => item.id === id);
      await deleteTurnover(id);
      await logAction('EXCLUIU', 'Turnover', `Balanço de Headcount/Turnover para o mês "${turn?.mesAno || id}" excluído.`);
    });

  const wrappedUpdateTurnover = (id: string, updatedFields: any) =>
    executeWithLoading("Atualizando indicadores de turnover...", async () => {
      const turn = turnover.find(item => item.id === id);
      await updateTurnover(id, updatedFields);
      await logAction('ALTEROU', 'Turnover', `Balanço de Headcount/Turnover para o mês "${updatedFields.mesAno || turn?.mesAno || id}" atualizado.`);
    });

  const wrappedAddUsuario = (email: string, role: UserRole, sede?: string) => 
    executeWithLoading("Cadastrando novo perfil de usuário autorizado...", async () => {
      await addUsuario(email, role, sede);
      await logAction('CRIOU', 'Usuários', `Usuário "${email}" convidado como "${role}" na unidade "${sede || 'DT'}".`);
    });

  const wrappedUpdateUsuario = (id: string, email: string, role: UserRole, sede?: string) => 
    executeWithLoading("Atualizando dados do usuário...", async () => {
      await updateUsuario(id, email, role, sede);
      await logAction('ALTEROU', 'Usuários', `Dados do usuário "${email}" atualizados para papel "${role}" e sede "${sede || 'DT'}".`);
    });

  const wrappedDeleteUsuario = (id: string) => 
    executeWithLoading("Bloqueando e removendo acesso organizacional...", async () => {
      const u = usuarios.find(item => item.id === id || item.email === id);
      await deleteUsuario(id);
      await logAction('EXCLUIU', 'Usuários', `Usuário "${u?.email || id}" removido do sistema.`);
    });

  const wrappedAddSede = (nome: string, regiao: string, sigla?: string) => 
    executeWithLoading("Registrando nova unidade de sede de operação...", async () => {
      await addSede(nome, regiao, sigla);
      await logAction('CRIOU', 'Sedes', `Sede "${nome}" (${sigla || 'Sem Sigla'}) cadastrada.`);
    });

  const wrappedUpdateSede = (id: string, nome: string, regiao: string, sigla?: string) => 
    executeWithLoading("Atualizando informações da sede...", async () => {
      await updateSede(id, nome, regiao, sigla);
      await logAction('ALTEROU', 'Sedes', `Sede "${nome}" (${sigla || 'Sem Sigla'}) atualizada.`);
    });

  const wrappedDeleteSede = (id: string) => 
    executeWithLoading("Deletando sede de operação...", async () => {
      const s = sedes.find(item => item.id === id);
      await deleteSede(id);
      await logAction('EXCLUIU', 'Sedes', `Sede "${s?.nome || id}" removida.`);
    });

  const wrappedAddRegiao = (nome: string) => 
    executeWithLoading("Cadastrando nova região organizacional...", async () => {
      await addRegiao(nome);
      await logAction('CRIOU', 'Regiões', `Região organizacional "${nome}" criada.`);
    });

  const wrappedDeleteRegiao = (id: string) => 
    executeWithLoading("Sincronizando exclusão de região geográfica...", async () => {
      const r = regioes.find(item => item.id === id);
      await deleteRegiao(id);
      await logAction('EXCLUIU', 'Regiões', `Região "${r?.nome || id}" excluída.`);
    });

  const wrappedUpdateRegiao = (id: string, nome: string) =>
    executeWithLoading("Atualizando região organizacional...", async () => {
      await updateRegiao(id, nome);
      await logAction('ALTEROU', 'Regiões', `Região "${nome}" atualizada.`);
    });

  const wrappedAddCargo = (nome: string) => 
    executeWithLoading("Definindo cargo autorizado para vagas...", async () => {
      await addCargo(nome);
      await logAction('CRIOU', 'Cargos', `Cargo catalogado "${nome}" adicionado.`);
    });

  const wrappedDeleteCargo = (id: string) => 
    executeWithLoading("Sincronizando remoção do cargo catalogado...", async () => {
      const c = cargos.find(item => item.id === id);
      await deleteCargo(id);
      await logAction('EXCLUIU', 'Cargos', `Cargo catalogado "${c?.nome || id}" excluído.`);
    });

  const wrappedAddSetor = (nome: string) => 
    executeWithLoading("Definindo setor autorizado...", async () => {
      await addSetor(nome);
      await logAction('CRIOU', 'Setores', `Setor catalogado "${nome}" adicionado.`);
    });

  const wrappedDeleteSetor = (id: string) => 
    executeWithLoading("Sincronizando remoção do setor catalogado...", async () => {
      const s = setores.find(item => item.id === id);
      await deleteSetor(id);
      await logAction('EXCLUIU', 'Setores', `Setor catalogado "${s?.nome || id}" excluído.`);
    });


  const handleSpreadsheetImport = async () => {
    if (!importFile) {
      notify("Selecione uma planilha .xlsx para importar.", "warning");
      return;
    }
    if (!importSelection.vagas && !importSelection.treinamentos && !importSelection.entrevistas) {
      notify("Selecione pelo menos um módulo para importar.", "warning");
      return;
    }

    setImportingSpreadsheet(true);
    try {
      const { parseSgpcSpreadsheet } = await import('./lib/spreadsheetImport');
      const parsed = await parseSgpcSpreadsheet(importFile);
      const importedCounts = {
        vagas: 0,
        treinamentos: 0,
        entrevistas: 0
      };

      if (importSelection.vagas) {
        await importVagas(parsed.vagas, importReplace);
        importedCounts.vagas = parsed.vagas.length;
      }
      if (importSelection.treinamentos) {
        await importTreinamentos(parsed.treinamentos, importReplace);
        importedCounts.treinamentos = parsed.treinamentos.length;
      }
      if (importSelection.entrevistas) {
        await importEntrevistas(parsed.entrevistas, importReplace);
        importedCounts.entrevistas = parsed.entrevistas.length;
      }

      const summary = [
        importSelection.vagas ? `${importedCounts.vagas} vagas` : null,
        importSelection.treinamentos ? `${importedCounts.treinamentos} treinamentos` : null,
        importSelection.entrevistas ? `${importedCounts.entrevistas} entrevistas` : null
      ].filter(Boolean).join(', ');

      await logAction('CRIOU', 'Vagas', `Importação de planilha SGPC concluída: ${summary}. Modo: ${importReplace ? 'substituição' : 'adição sem duplicar'}.`);
      notify(`Importação concluída: ${summary}.`, parsed.warnings.length ? "warning" : "success");
      if (parsed.warnings.length) {
        console.warn("Avisos da importação SGPC:", parsed.warnings.slice(0, 30));
      }
      setImportFile(null);
    } catch (err: any) {
      console.error(err);
      notify(`Erro ao importar planilha: ${err.message || err}`, "error");
    } finally {
      setImportingSpreadsheet(false);
    }
  };

  // Migração one-time: recalcula os vencimentos 45/90 (contagem inclusiva CLT) das
  // experiências já cadastradas a partir da data de admissão. Idempotente.
  const handleRecalcularExperiencias = () => {
    if (!experiencias.length) {
      notify("Não há experiências cadastradas para recalcular.", "info");
      return;
    }
    askConfirmation(
      "Recalcular vencimentos de experiência",
      `Recalcular os prazos de 45 e 90 dias (contagem inclusiva) de ${experiencias.length} registro(s) a partir da data de admissão? Só altera os que estiverem diferentes.`,
      () => executeWithLoading("Recalculando vencimentos de experiência...", async () => {
        let alterados = 0;
        for (const e of experiencias) {
          if (!e.dataAdmissao) continue;
          const t1 = addDaysToDate(e.dataAdmissao, DIAS_EXPERIENCIA_1);
          const t2 = addDaysToDate(e.dataAdmissao, DIAS_EXPERIENCIA_2);
          if (e.termino1 !== t1 || e.termino2 !== t2) {
            await updateExperiencia(e.id, { termino1: t1, termino2: t2 });
            alterados++;
          }
        }
        await logAction('ALTEROU', 'Experiências', `Recálculo em lote dos vencimentos 45/90 (inclusivo): ${alterados} de ${experiencias.length} registro(s) atualizado(s).`);
        notify(`Recálculo concluído: ${alterados} registro(s) atualizado(s).`, "success");
      })
    );
  };

  // Migração one-time: reconstrói pausadaDesde das vagas já pausadas, lendo nos
  // logs quando cada uma foi pausada (evento "Status de ... para PAUSADA/SUSPENSA"),
  // para o SLA congelar retroativamente. Idempotente; só preenche as que faltam.
  const handleBackfillPausas = () => {
    const pausadas = vagas.filter(v => (v.status === 'PAUSADA' || v.status === 'SUSPENSA') && !v.pausadaDesde);
    if (!pausadas.length) {
      notify("Nenhuma vaga pausada sem data de pausa registrada.", "info");
      return;
    }
    if (!logs.length) {
      notify("Logs ainda não carregados (é preciso ser administrador).", "warning");
      return;
    }
    askConfirmation(
      "Recalcular pausas pelos logs",
      `Reconstruir a data de pausa de ${pausadas.length} vaga(s) pausada(s) a partir dos logs e congelar o SLA delas retroativamente? Só altera as que ainda não têm a data.`,
      () => executeWithLoading("Reconstruindo datas de pausa pelos logs...", async () => {
        let ok = 0;
        let semLog = 0;
        for (const v of pausadas) {
          const marca = `#${v.codigo}`;
          const statusLogs = logs
            .filter(l => l.modulo === 'Vagas' && l.detalhes.includes(marca) && /Status de ".*?" para ".*?"/.test(l.detalhes))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          let inicio: string | null = null;
          for (const l of statusLogs) {
            const m = l.detalhes.match(/Status de "(.*?)" para "(.*?)"/);
            if (!m) continue;
            const dePausado = m[1] === 'PAUSADA' || m[1] === 'SUSPENSA';
            const paraPausado = m[2] === 'PAUSADA' || m[2] === 'SUSPENSA';
            if (!paraPausado) break; // a mudança mais recente já tirou da pausa — para
            if (!dePausado) { inicio = l.timestamp; break; } // entrou na pausa aqui (vindo de status ativo)
            // pausado -> pausado (ex.: PAUSADA -> SUSPENSA): continua procurando o início real
          }
          if (inicio) {
            await updateVaga(v.id, { pausadaDesde: new Date(inicio).toISOString().slice(0, 10) });
            ok++;
          } else {
            semLog++;
          }
        }
        await logAction('ALTEROU', 'Vagas', `Backfill de pausas pelos logs: ${ok} vaga(s) com SLA congelado retroativamente${semLog ? `; ${semLog} sem registro de pausa nos logs` : ''}.`);
        notify(`Concluído: ${ok} vaga(s) ajustada(s)${semLog ? `; ${semLog} sem registro nos logs` : ''}.`, "success");
      })
    );
  };

  // Track Auth state if Firebase is active
  useEffect(() => {
    if (isFirebaseEnabled && auth) {
      const unsubscribe = auth.onAuthStateChanged((currentUser: any) => {
        if (currentUser) {
          setUser(currentUser);
        } else {
          try {
            const savedMock = localStorage.getItem('ats_simulated_user');
            if (savedMock) {
              setUser(JSON.parse(savedMock));
            } else {
              setUser(null);
            }
          } catch (e) {
            setUser(null);
          }
        }
        setAuthReady(true);
      });
      return unsubscribe;
    } else {
      try {
        const savedMock = localStorage.getItem('ats_simulated_user');
        if (savedMock) {
          setUser(JSON.parse(savedMock));
        }
      } catch (e) {
        setUser(null);
      }
      setAuthReady(true);
    }
  }, []);

  const handleSimulatedLogin = (email: string, name: string) => {
    const mockUser = {
      email,
      displayName: name,
      photoURL: null,
      uid: 'mock-uid-12345'
    };
    setUser(mockUser);
    localStorage.setItem('ats_simulated_user', JSON.stringify(mockUser));
    notify(`Entrou como ${name} (Demonstração)`, "success");
  };

  const handleLogin = async () => {
    if (!isFirebaseEnabled || !auth) {
      handleSimulatedLogin("guizen2006@gmail.com", "Guilherme Zen");
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
      notify("Login efetuado com sucesso!", "success");
    } catch (err: any) {
      console.warn("Erro ao fazer login via popup:", err);
      if (err.code === 'auth/popup-closed-by-user' || err.message?.includes('popup-closed-by-user')) {
        notify(
          "O login foi cancelado porque a janela de autenticação do Google foi fechada antes da conclusão.",
          "warning"
        );
      } else if (err.code === 'auth/cancelled-popup-request' || err.message?.includes('cancelled-popup-request')) {
        notify(
          "Solicitação de autenticação anterior cancelada. Por favor, tente clicar novamente.",
          "info"
        );
      } else {
        notify(`Erro ao tentar autenticar: ${err.message || err}`, "error");
      }
    }
  };

  const handleLogout = async () => {
    if (auth && isFirebaseEnabled) {
      await signOut(auth);
    }
    setUser(null);
    localStorage.removeItem('ats_simulated_user');
    notify("Você se desconectou com sucesso.", "info");
  };

  // Enquanto a autenticação não resolveu, ou já logado mas carregando os dados,
  // mostra o spinner. Sem usuário (após authReady), cai direto na tela de login —
  // sem ficar preso no "Carregando" quando o Firestore nega leitura ao anônimo.
  if (!authReady || (user && (loading || loadingMetadata || loadingOps))) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-600 animate-spin">
          <Loader2 className="w-6 h-6" />
        </div>
        <div className="text-sm font-semibold text-slate-500 font-sans tracking-wide">
          Carregando dados das vagas e analíticas...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LoginPage 
          onLogin={handleLogin} 
          isFirebaseEnabled={isFirebaseEnabled}
          onSimulatedLogin={handleSimulatedLogin}
        />
        {toast && (
          <div 
            id="toast-notification"
            role="status"
            aria-live="polite"
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[150] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border animate-in fade-in slide-in-from-top-4 duration-300 max-w-md w-[90%] bg-slate-900 border-slate-800"
          >
            <div 
              className="w-2 h-2 rounded-full shrink-0 animate-ping" 
              style={{
                backgroundColor: toast.type === 'error' ? '#ef4444' : toast.type === 'success' ? '#10b981' : toast.type === 'warning' ? '#f59e0b' : '#3b82f6'
              }} 
            />
            <div className="flex-1 text-xs font-semibold text-slate-200 leading-normal">
              {toast.message}
            </div>
            <button 
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-200 text-sm font-bold ml-2 hover:bg-slate-850 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-colors"
            >
              &times;
            </button>
          </div>
        )}
      </>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto shadow-md">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-4">
            <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">Acesso Pendente / Negado</h2>
            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
              Sua conta <span className="font-extrabold text-slate-800 font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{user?.email}</span> não está cadastrada como autorizada neste sistema.
            </p>
            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
              Peça a um Administrador organizacional do SGPC para cadastrar seu e-mail no painel de controle de usuários.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={handleLogout}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase rounded-xl cursor-pointer shadow-md transition border border-slate-950"
            >
              Fazer logout e trocar de conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen bg-slate-50 font-sans antialiased text-slate-700 flex flex-col overflow-hidden">
      {/* Enfeites de época (ligados/desligados pelo admin no painel) 🎉 */}
      {ENFEITES.filter(enfeiteAtivo).map(e => { const Comp = e.Comp; return <Comp key={e.id} />; })}
      {/* Top Main Navigation Header (Glued to top) */}
      <header className="flex items-center justify-between bg-white py-3.5 px-6 border-b border-slate-200 shadow-xs shrink-0 z-10 gap-4">
        {/* Logo and Dynamic Screen Name */}
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="SGPC" width={36} height={36} className="w-9 h-9 rounded-xl object-contain shrink-0" />
          <div>
            <h1 className="text-sm font-extrabold text-slate-800 tracking-tight leading-none flex items-center gap-1">
              <span>SGPC</span>
              <span className="hidden sm:inline text-xs font-semibold text-slate-400 mx-0.5">|</span>
              <span className="hidden sm:inline text-xs font-medium text-slate-500">Sistema de Gestão de Pessoas Christus</span>
              <span className="text-[9px] font-bold bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-md border border-orange-200 ml-1 shrink-0">v1.2.0</span>
            </h1>
            <p className="text-[11px] text-slate-500 font-bold mt-1 leading-none uppercase tracking-wider">
              {activeTab === 'dashboard' && 'Painel de Indicadores'}
              {activeTab === 'vagas' && 'Quadro de Vagas'}
              {activeTab === 'treinamentos' && 'Treinamentos'}
              {activeTab === 'experiencias' && 'Acompanhamento de Experiência'}
              {activeTab === 'entrevistas' && 'Entrevistas de Desligamento'}
              {activeTab === 'turnover' && 'Turnover & Headcount'}
              {activeTab === 'requisicoes' && 'Requisições de Vaga'}
              {activeTab === 'admin' && 'Painel Administrativo'}
            </p>
          </div>
        </div>

        {/* Sync Status Badge & Button */}
        <div className="flex items-center gap-3">
          {usingFirebase ? (
            <div className="flex items-center bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-100 text-[10px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span>
              Conectado
            </div>
          ) : (
            <div 
              className="flex items-center bg-orange-50 text-orange-700 px-3 py-1.5 rounded-full border border-orange-200 text-[10px] font-bold uppercase tracking-wider cursor-help"
              title="A aplicação está rodando em modo sandbox local (localStorage). Sincronize com Firebase rodando o setup."
            >
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full mr-1.5 animate-pulse"></span>
              Demo Local
            </div>
          )}

        </div>
      </header>

      {/* Main Layout Area - Glued to side and bottom */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        
        {/* Navigation Sidebar Drawer */}
        <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-5 flex flex-row lg:flex-col gap-4 overflow-x-auto lg:overflow-y-auto scrollbar-none shrink-0 justify-between">
          
          <div className="flex flex-row lg:flex-col gap-4 w-full">
            
            {/* Category 1: Visão Geral */}
            <div className="space-y-1 w-full shrink-0 lg:shrink">
              <div className="hidden lg:block px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Visão geral
              </div>
              <button
                id="tab-home"
                onClick={() => setActiveTab('home')}
                className={`flex items-center gap-2.5 px-3 py-2.5 w-full rounded-2xl text-[11px] font-bold uppercase tracking-wider transition cursor-pointer ${
                  activeTab === 'home' 
                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
                }`}
              >
                <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </div>
                <span>Início</span>
              </button>

              <button
                id="tab-dashboard"
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2.5 px-3 py-2.5 w-full rounded-2xl text-[11px] font-bold uppercase tracking-wider transition cursor-pointer ${
                  activeTab === 'dashboard' 
                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
                }`}
              >
                <BarChart3 className="w-4 h-4 shrink-0" />
                <span>Indicadores</span>
              </button>
            </div>

            {/* Category 2: Recrutamento */}
            <div className="space-y-1 w-full shrink-0 lg:shrink">
              <div className="hidden lg:block px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-1">
                Recrutamento
              </div>
              <button
                id="tab-vagas"
                onClick={() => setActiveTab('vagas')}
                className={`flex items-center gap-2.5 px-3 py-2.5 w-full rounded-2xl text-[11px] font-bold uppercase tracking-wider transition cursor-pointer ${
                  activeTab === 'vagas' 
                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
                }`}
              >
                <Layers className="w-4 h-4 shrink-0" />
                <span>Quadro de Vagas</span>
              </button>

              {isAdmin && (
                <button
                  id="tab-requisicoes"
                  onClick={() => setActiveTab('requisicoes')}
                  className={`flex items-center gap-2.5 px-3 py-2.5 w-full rounded-2xl text-[11px] font-bold uppercase tracking-wider transition cursor-pointer ${
                    activeTab === 'requisicoes'
                      ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
                  }`}
                >
                  <Inbox className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left">Requisições</span>
                  {requisicoesPendentes > 0 && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500 text-white leading-none shrink-0">{requisicoesPendentes}</span>
                  )}
                </button>
              )}
            </div>

            {/* Category 3: Gestão */}
            <div className="space-y-1 w-full shrink-0 lg:shrink">
              <div className="hidden lg:block px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-1">
                Gestão
              </div>
              
              <button
                id="tab-treinamentos"
                onClick={() => setActiveTab('treinamentos')}
                className={`flex items-center gap-2.5 px-3 py-2.5 w-full rounded-2xl text-[11px] font-bold uppercase tracking-wider transition cursor-pointer ${
                  activeTab === 'treinamentos' 
                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
                }`}
              >
                <GraduationCap className="w-4 h-4 shrink-0 text-orange-550" />
                <span>Treinamentos</span>
              </button>

              <button
                id="tab-experiencias"
                onClick={() => setActiveTab('experiencias')}
                className={`flex items-center gap-2.5 px-3 py-2.5 w-full rounded-2xl text-[11px] font-bold uppercase tracking-wider transition cursor-pointer ${
                  activeTab === 'experiencias' 
                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>Experiência</span>
              </button>

              <button
                id="tab-entrevistas"
                onClick={() => setActiveTab('entrevistas')}
                className={`flex items-center gap-2.5 px-3 py-2.5 w-full rounded-2xl text-[11px] font-bold uppercase tracking-wider transition cursor-pointer ${
                  activeTab === 'entrevistas' 
                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
                }`}
              >
                <HeartCrack className="w-4 h-4 shrink-0 text-rose-500" />
                <span>Entrevistas</span>
              </button>

              <button
                id="tab-turnover"
                onClick={() => setActiveTab('turnover')}
                className={`flex items-center gap-2.5 px-3 py-2.5 w-full rounded-2xl text-[11px] font-bold uppercase tracking-wider transition cursor-pointer ${
                  activeTab === 'turnover' 
                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
                }`}
              >
                <Percent className="w-4 h-4 shrink-0 text-blue-500" />
                <span>Turn Over</span>
              </button>
            </div>

            {/* Category 4: Sistema / Admin (Administrador completo ou Coordenador regional) */}
            {(isAdmin || isCoord) && (
              <div className="space-y-1 w-full shrink-0 lg:shrink">
                <div className="hidden lg:block px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-1">
                  Sistema
                </div>
                {(isAdmin || isCoord) && (
                  <button
                    id="tab-admin"
                    onClick={() => setActiveTab('admin')}
                    className={`flex items-center gap-2.5 px-3 py-2.5 w-full rounded-2xl text-[11px] font-bold uppercase tracking-wider transition cursor-pointer ${
                      activeTab === 'admin' 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15' 
                        : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100/70'
                    }`}
                  >
                    <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
                    <span>Painel Admin</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sidebar Footer User Card with Integrated System Indicators & Copyright */}
          <div className="hidden lg:flex flex-col gap-3 mt-auto pt-4 border-t border-slate-100 w-full shrink-0">
            {user ? (
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex items-center gap-3">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName} width={32} height={32} loading="lazy" className="w-8 h-8 rounded-full border border-slate-350 shadow-xs shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-slate-50 text-[10px] font-black flex items-center justify-center uppercase border border-slate-850 shrink-0">
                    {user.displayName?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-850 truncate leading-none mb-1">
                    {user.displayName || 'Gestor'}
                  </p>
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase border leading-none ${
                      isAdmin 
                        ? 'bg-rose-50 text-rose-600 border-rose-100' 
                        : isViewer
                        ? 'bg-slate-100 text-slate-600 border-slate-200'
                        : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                    }`}>
                      {userRole}
                    </span>
                    <span className="inline-block text-[9px] px-1.5 py-0.5 rounded font-mono text-slate-600 bg-slate-100 border border-slate-250 font-extrabold uppercase leading-none" title={isViewer ? 'Acesso a todas as sedes' : `Sede: ${selectedSede}`}>
                      {isViewer ? 'TODAS' : (sedes.find(s => s.nome.toLowerCase() === selectedSede?.toLowerCase())?.sigla || selectedSede)}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-[9px] text-rose-500 hover:text-rose-700 font-extrabold uppercase tracking-wider block mt-2 cursor-pointer leading-none hover:underline animate-duration-150"
                  >
                    Sair
                  </button>
                </div>
              </div>
            ) : isFirebaseEnabled ? (
              <button
                onClick={handleLogin}
                className="w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-md border border-slate-950 hover:scale-[1.01] transition"
              >
                <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Entrar no SGPC</span>
              </button>
            ) : (
              <div className="bg-slate-50 text-[9px] p-3 rounded-2xl text-slate-400 text-center font-bold uppercase tracking-wider leading-normal">
                Modo Offline
              </div>
            )}

            {/* Quick System Status Indicators embedded directly in sidebar */}
            <div className="pt-2.5 border-t border-slate-100 space-y-1 text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
                <span>Firestore Sincronizado</span>
              </div>
              <div className="text-[8px] text-slate-400/80 font-semibold normal-case pt-1 flex justify-between items-center leading-none">
                <span>Â© {new Date().getFullYear()} SGPC</span>
                <span>v1.2.0</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Dynamic Content Pane - scrollable workspace */}
        <main className="flex-1 bg-slate-50 p-6 lg:p-8 overflow-y-auto min-h-0 h-full">
          {errorMessage && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-xs font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              {errorMessage}
            </div>
          )}

          <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 className="w-7 h-7 text-indigo-600 animate-spin" /></div>}>
          {activeTab === 'home' && (
            <HomeSection
              vagas={scopedVagas}
              treinamentos={treinamentos}
              experiencias={experiencias}
              entrevistas={entrevistas}
              turnover={turnover}
              setActiveTab={setActiveTab}
              onFocusVaga={handleFocusVaga}
              userName={user?.displayName}
              sedes={scopedSedes}
              userSede={scopedUserSede}
              isAdmin={isAdmin || isCoord}
            />
          )}

          {activeTab === 'dashboard' && (
            <RecruitmentDashboard 
              vagas={scopedVagas} 
              treinamentos={treinamentos} 
              experiencias={experiencias}
              entrevistas={entrevistas}
              turnover={turnover}
              sedes={scopedSedes}
              userSede={scopedUserSede}
              isAdmin={isAdmin || isCoord}
            />
          )}
          
          {activeTab === 'vagas' && (
            <VacancyTable 
              vagas={scopedVagas} 
              updateVaga={wrappedUpdateVaga} 
              deleteVaga={wrappedDeleteVaga} 
              addVaga={wrappedAddVaga}
              addExperiencia={wrappedAddExperiencia}
              sedes={scopedSedes}
              cargos={cargos}
              isAdmin={isAdmin || isCoord}
              confirmAction={askConfirmation}
              triggerAddModal={triggerAddModal}
              userSede={scopedUserSede}
              userRole={selectedRole}
              focusVaga={vagaFocus}
              logs={logs}
            />
          )}

          {activeTab === 'treinamentos' && (
            <TreinamentosSection 
              treinamentos={treinamentos} 
              addTreinamento={wrappedAddTreinamento} 
              updateTreinamento={wrappedUpdateTreinamento}
              deleteTreinamento={wrappedDeleteTreinamento}
              sedes={scopedSedes}
              confirmAction={askConfirmation}
              userSede={scopedUserSede}
              isAdmin={isAdmin || isCoord}
              canManage={canManageModules}
            />
          )}

          {activeTab === 'experiencias' && (
            <ExperienciasSection 
              experiencias={experiencias} 
              addExperiencia={wrappedAddExperiencia} 
              updateExperiencia={wrappedUpdateExperiencia} 
              deleteExperiencia={wrappedDeleteExperiencia}
              confirmAction={askConfirmation}
              sedes={scopedSedes}
              setores={setores}
              userSede={scopedUserSede}
              isAdmin={isAdmin || isCoord}
              canManage={canManageModules}
            />
          )}

          {activeTab === 'entrevistas' && (
            <EntrevistasSection 
              entrevistas={entrevistas} 
              addEntrevista={wrappedAddEntrevista} 
              updateEntrevista={wrappedUpdateEntrevista}
              deleteEntrevista={wrappedDeleteEntrevista}
              confirmAction={askConfirmation}
              userSede={scopedUserSede}
              isAdmin={isAdmin || isCoord}
              canManage={canManageModules}
            />
          )}

          {activeTab === 'turnover' && (
            <TurnoverSection 
              turnover={turnover} 
              addTurnover={wrappedAddTurnover} 
              updateTurnover={wrappedUpdateTurnover}
              deleteTurnover={wrappedDeleteTurnover}
              confirmAction={askConfirmation}
              canManage={canManageModules}
            />
          )}

          {activeTab === 'requisicoes' && isAdmin && (
            <RequisicoesSection
              requisicoes={requisicoes}
              onAceitar={handleAceitarRequisicao}
              onRecusar={handleRecusarRequisicao}
              canManage={true}
            />
          )}

          {activeTab === 'admin' && (isAdmin || isCoord) && (
            <ErrorBoundary>
              <AdminPanel
                isCoordenador={isCoord}
                enfeites={ENFEITES.map(e => ({ id: e.id, nome: e.nome, ativo: enfeiteAtivo(e) }))}
                onToggleEnfeite={setEnfeite}
                usuarios={adminUsuarios}
                sedes={adminSedes}
                regioes={adminRegioes}
                cargos={cargos || []}
                setores={setores || []}
                logs={logs || []}
                addUsuario={wrappedAddUsuario}
                updateUsuario={wrappedUpdateUsuario}
                deleteUsuario={wrappedDeleteUsuario}
                addSede={wrappedAddSede}
                updateSede={wrappedUpdateSede}
                deleteSede={wrappedDeleteSede}
                addRegiao={wrappedAddRegiao}
                updateRegiao={wrappedUpdateRegiao}
                deleteRegiao={wrappedDeleteRegiao}
                addCargo={wrappedAddCargo}
                deleteCargo={wrappedDeleteCargo}
                addSetor={wrappedAddSetor}
                deleteSetor={wrappedDeleteSetor}
                currentUserEmail={user?.email || 'sistema'}
                confirmAction={askConfirmation}
                importFile={importFile}
                setImportFile={setImportFile}
                importReplace={importReplace}
                setImportReplace={setImportReplace}
                importingSpreadsheet={importingSpreadsheet}
                importSelection={importSelection}
                setImportSelection={setImportSelection}
                onImportSpreadsheet={handleSpreadsheetImport}
                onRecalcExperiencias={handleRecalcularExperiencias}
                onBackfillPausas={handleBackfillPausas}
              />
            </ErrorBoundary>
          )}
          </Suspense>
        </main>
      </div>


      {toast && (
        <div 
          id="toast-notification" 
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border animate-in fade-in slide-in-from-top-4 duration-300 max-w-md w-[90%] bg-white border-slate-200"
        >
          <div 
            className="w-2 h-2 rounded-full shrink-0 animate-ping" 
            style={{
              backgroundColor: toast.type === 'error' ? '#ef4444' : toast.type === 'success' ? '#10b981' : toast.type === 'warning' ? '#f59e0b' : '#3b82f6'
            }} 
          />
          <div className="flex-1 text-xs font-semibold text-slate-700 leading-normal">
            {toast.message}
          </div>
          <button 
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold ml-2 hover:bg-slate-100 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-colors"
          >
            &times;
          </button>
        </div>
      )}

      {/* Dynamic Global Loading Overlay */}
      {globalLoading && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex flex-col items-center justify-center p-4 transition duration-300 animate-in fade-in">
          <div className="bg-white/95 border border-slate-205 p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4 text-center max-w-sm animate-in zoom-in-95">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <div className="space-y-1">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest">Processando</h4>
              <p className="text-xs text-slate-500 font-semibold">{globalLoading}</p>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Custom Confirm Dialog Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4 transition duration-300 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 space-y-5">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl shrink-0">
                  <ShieldAlert className="w-6 h-6 animate-pulse" />
                </div>
                <div className="space-y-1.55">
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider leading-snug">
                    {confirmModal.title}
                  </h3>
                  <p className="text-xs text-slate-550 font-semibold leading-relaxed">
                    {confirmModal.message}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 hover:text-slate-700 rounded-xl cursor-pointer transition-colors"
                >
                  {confirmModal.cancelText || 'Cancelar'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const callback = confirmModal.onConfirm;
                    setConfirmModal(null);
                    await callback();
                  }}
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-lg shadow-rose-500/10 cursor-pointer transition-colors"
                >
                  {confirmModal.confirmText || 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
