/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { useVagas } from './hooks/useVagas';
import { RecruitmentDashboard } from './components/RecruitmentDashboard';
import { VacancyTable } from './components/VacancyTable';
import { AddVacancyForm } from './components/AddVacancyForm';
import { AdminPanel } from './components/AdminPanel';
import { HomeSection } from './components/HomeSection';
import { LoginPage } from './components/LoginPage';
import { useMetadata } from './hooks/useMetadata';
import { useLogs } from './hooks/useLogs';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useOperationalModules } from './hooks/useOperationalModules';
import { TreinamentosSection } from './components/TreinamentosSection';
import { ExperienciasSection } from './components/ExperienciasSection';
import { EntrevistasSection } from './components/EntrevistasSection';
import { TurnoverSection } from './components/TurnoverSection';
import { 
  Briefcase, 
  BarChart3, 
  PlusCircle, 
  Sparkles, 
  Layers, 
  Database,
  Loader2,
  Lock,
  ShieldAlert,
  GraduationCap,
  ShieldCheck,
  HeartCrack,
  Percent,
  User,
  Users
} from 'lucide-react';
import { auth, googleProvider, isFirebaseEnabled, db } from './lib/firebase';
import { signInWithPopup, signOut } from 'firebase/auth';

export default function App() {
  const { vagas, loading, usingFirebase, errorMessage, addVaga, updateVaga, deleteVaga } = useVagas();
  const [user, setUser] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string, type: 'error' | 'success' | 'info' | 'warning' } | null>(null);
  const [triggerAddModal, setTriggerAddModal] = useState(0);

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
    addExperiencia,
    updateExperiencia,
    deleteExperiencia,
    addEntrevista,
    deleteEntrevista,
    addTurnover,
    deleteTurnover
  } = useOperationalModules();

  const { logs, logAction } = useLogs(user, isAdmin);

  const [activeTab, setActiveTab] = useState<'home' | 'dashboard' | 'vagas' | 'treinamentos' | 'experiencias' | 'entrevistas' | 'turnover' | 'admin'>('home');

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
    executeWithLoading("Cadastrando nova vaga no ATS...", async () => {
      await addVaga(vagaInput);
      await logAction('CRIOU', 'Vagas', `Vaga "${vagaInput.vaga}" (Sede: ${vagaInput.sede || selectedSede}) cadastrada.`);
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

  const wrappedAddUsuario = (email: string, role: 'Administrador' | 'Analista', sede?: string) => 
    executeWithLoading("Cadastrando novo perfil de usuário autorizado...", async () => {
      await addUsuario(email, role, sede);
      await logAction('CRIOU', 'Usuários', `Usuário "${email}" convidado como "${role}" na unidade "${sede || 'DT'}".`);
    });

  const wrappedUpdateUsuario = (id: string, email: string, role: 'Administrador' | 'Analista', sede?: string) => 
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
      await logAction('CRIOU', 'Regiões', `Regão organizacional "${nome}" criada.`);
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

  const clearAllTransactionData = async (fullReset: boolean) => {
    if (isFirebaseEnabled && db) {
      const collectionsToClear = ['vagas', 'treinamentos', 'experiencia', 'entrevistas', 'turnover', 'logs'];
      if (fullReset) {
        collectionsToClear.push('usuarios', 'sedes', 'regioes', 'cargos', 'setores');
      }
      
      const { getDocs, collection, doc, deleteDoc } = await import('firebase/firestore');
      
      for (const colName of collectionsToClear) {
        try {
          const snap = await getDocs(collection(db, colName));
          const deletePromises = snap.docs.map(docSnap => deleteDoc(doc(db, colName, docSnap.id)));
          await Promise.all(deletePromises);
        } catch (e) {
          console.error(`Error clearing ${colName}:`, e);
        }
      }
    }
    
    const keysToClear = [
      'ats_vagas_fallback',
      'ats_treinamentos_fallback',
      'ats_experiencia_fallback',
      'ats_entrevistas_fallback',
      'ats_turnover_fallback',
      'ats_system_logs_fallback'
    ];
    if (fullReset) {
      keysToClear.push(
        'ats_users_fallback',
        'ats_sedes_fallback',
        'ats_regioes_fallback',
        'ats_cargos_fallback',
        'ats_setores_fallback'
      );
    }
    
    keysToClear.forEach(key => localStorage.removeItem(key));

    if (fullReset) {
      localStorage.removeItem('ats_db_clean_mode');
    } else {
      localStorage.setItem('ats_db_clean_mode', 'true');
    }
  };

  const wrappedClearAllTransactionData = (fullReset: boolean) =>
    executeWithLoading("Saneando e reiniciando banco de dados...", async () => {
      try {
        await logAction('EXCLUIU', 'Usuários', `Iniciou a limpeza do banco de dados (Reset Completo: ${fullReset ? 'Sim' : 'Não'}).`);
      } catch (e) {}
      await clearAllTransactionData(fullReset);
      notify("Banco de dados saneado. Recarregando sistema...", "success");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    });

  // Track Auth state if Firebase is active
  useState(() => {
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
    }
  });

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

  if (loading || loadingMetadata || loadingOps) {
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
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[150] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border animate-in fade-in slide-in-from-top-4 duration-300 max-w-md w-[90%] bg-slate-900 border-slate-800"
          >
            <div 
              className="w-2 h-2 rounded-full shrink-0 animate-ping" 
              style={{
                backgroundColor: toast.type === 'error' ? '#ef4444' : toast.type === 'success' ? '#10b981' : toast.type === 'warning' ? '#f97316' : '#3b82f6'
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
              Peça a um Administrador organizacional do SGCP para cadastrar seu e-mail no painel de controle de usuários.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={handleLogout}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase rounded-xl cursor-pointer shadow-md transition-all border border-slate-950"
            >
              Fazer logout e trocar de conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-50 font-sans antialiased text-slate-700 flex flex-col overflow-hidden">
      {/* Top Main Navigation Header (Glued to top) */}
      <header className="flex items-center justify-between bg-white py-3.5 px-6 border-b border-slate-200 shadow-xs shrink-0 z-10 gap-4">
        {/* Logo and Dynamic Screen Name */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shadow-md shadow-orange-500/10 shrink-0">
            <Users className="w-5 h-5 text-white" />
          </div>
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

            {/* Category 4: Sistema / Admin */}
            {(isAdmin || selectedRole === 'Administrador') && (
              <div className="space-y-1 w-full shrink-0 lg:shrink">
                <div className="hidden lg:block px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-1">
                  Sistema
                </div>
                {isAdmin && (
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
                  <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full border border-slate-350 shadow-xs shrink-0" />
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
                        : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                    }`}>
                      {userRole}
                    </span>
                    <span className="inline-block text-[9px] px-1.5 py-0.5 rounded font-mono text-slate-600 bg-slate-100 border border-slate-250 font-extrabold uppercase leading-none" title={`Sede: ${selectedSede}`}>
                      {sedes.find(s => s.nome.toLowerCase() === selectedSede?.toLowerCase())?.sigla || selectedSede}
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
                className="w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-md border border-slate-950 hover:scale-[1.01] transition-all"
              >
                <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Entrar no ATS</span>
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
                <span>© {new Date().getFullYear()} Gestor ATS</span>
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

          {activeTab === 'home' && (
            <HomeSection 
              vagas={vagas}
              treinamentos={treinamentos}
              experiencias={experiencias}
              entrevistas={entrevistas}
              turnover={turnover}
              setActiveTab={setActiveTab}
              userName={user?.displayName}
              sedes={sedes}
              userSede={selectedSede}
              isAdmin={isAdmin}
            />
          )}

          {activeTab === 'dashboard' && (
            <RecruitmentDashboard 
              vagas={vagas} 
              treinamentos={treinamentos} 
              experiencias={experiencias}
              entrevistas={entrevistas}
              turnover={turnover}
              sedes={sedes}
              userSede={selectedSede}
              isAdmin={isAdmin}
            />
          )}
          
          {activeTab === 'vagas' && (
            <VacancyTable 
              vagas={vagas} 
              updateVaga={wrappedUpdateVaga} 
              deleteVaga={wrappedDeleteVaga} 
              addVaga={wrappedAddVaga}
              addExperiencia={wrappedAddExperiencia}
              sedes={sedes}
              cargos={cargos}
              isAdmin={isAdmin}
              confirmAction={askConfirmation}
              triggerAddModal={triggerAddModal}
              userSede={selectedSede}
              userRole={selectedRole}
            />
          )}

          {activeTab === 'treinamentos' && (
            <TreinamentosSection 
              treinamentos={treinamentos} 
              addTreinamento={wrappedAddTreinamento} 
              deleteTreinamento={wrappedDeleteTreinamento}
              sedes={sedes}
              confirmAction={askConfirmation}
              userSede={selectedSede}
              isAdmin={isAdmin}
            />
          )}

          {activeTab === 'experiencias' && (
            <ExperienciasSection 
              experiencias={experiencias} 
              addExperiencia={wrappedAddExperiencia} 
              updateExperiencia={wrappedUpdateExperiencia} 
              deleteExperiencia={wrappedDeleteExperiencia}
              confirmAction={askConfirmation}
              sedes={sedes}
              setores={setores}
              userSede={selectedSede}
              isAdmin={isAdmin}
            />
          )}

          {activeTab === 'entrevistas' && (
            <EntrevistasSection 
              entrevistas={entrevistas} 
              addEntrevista={wrappedAddEntrevista} 
              deleteEntrevista={wrappedDeleteEntrevista}
              confirmAction={askConfirmation}
              userSede={selectedSede}
              isAdmin={isAdmin}
            />
          )}

          {activeTab === 'turnover' && (
            <TurnoverSection 
              turnover={turnover} 
              addTurnover={wrappedAddTurnover} 
              deleteTurnover={wrappedDeleteTurnover}
              confirmAction={askConfirmation}
            />
          )}

          {activeTab === 'admin' && isAdmin && (
            <ErrorBoundary>
              <AdminPanel
                usuarios={usuarios || []}
                sedes={sedes || []}
                regioes={regioes || []}
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
                currentUserEmail={user?.email || 'guizen2006@gmail.com'}
                confirmAction={askConfirmation}
                clearAllData={wrappedClearAllTransactionData}
              />
            </ErrorBoundary>
          )}
        </main>
      </div>

      {/* Floating Toast Notification in-app UI */}{/* Floating Toast Notification in-app UI */}
      {toast && (
        <div 
          id="toast-notification" 
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border animate-in fade-in slide-in-from-top-4 duration-300 max-w-md w-[90%] bg-white border-slate-200"
        >
          <div 
            className="w-2 h-2 rounded-full shrink-0 animate-ping" 
            style={{
              backgroundColor: toast.type === 'error' ? '#ef4444' : toast.type === 'success' ? '#10b981' : toast.type === 'warning' ? '#f97316' : '#3b82f6'
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex flex-col items-center justify-center p-4 transition-all duration-300 animate-in fade-in">
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4 transition-all duration-300 animate-in fade-in">
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
