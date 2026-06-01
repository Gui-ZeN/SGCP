import React, { useState } from 'react';
import { 
  Users, 
  Building2, 
  Map, 
  Briefcase, 
  ShieldAlert,
  History,
  FolderTree,
  Database
} from 'lucide-react';
import { Usuario, Sede, Regiao, Cargo, Setor } from '../hooks/useMetadata';
import { SystemLog } from '../hooks/useLogs';
import { AdminUsersTab } from './AdminUsersTab';
import { AdminSedesTab } from './AdminSedesTab';
import { AdminRegioesTab } from './AdminRegioesTab';
import { AdminCargosTab } from './AdminCargosTab';
import { AdminSetoresTab } from './AdminSetoresTab';
import { AdminLogsTab } from './AdminLogsTab';

interface AdminPanelProps {
  usuarios: Usuario[];
  sedes: Sede[];
  regioes: Regiao[];
  cargos: Cargo[];
  setores: Setor[];
  logs: SystemLog[];
  addUsuario: (email: string, role: 'Administrador' | 'Analista', sede?: string) => Promise<void>;
  updateUsuario: (id: string, email: string, role: 'Administrador' | 'Analista', sede?: string) => Promise<void>;
  deleteUsuario: (id: string) => Promise<void>;
  addSede: (nome: string, regiao: string, sigla?: string) => Promise<void>;
  updateSede: (id: string, nome: string, regiao: string, sigla?: string) => Promise<void>;
  deleteSede: (id: string) => Promise<void>;
  addRegiao: (nome: string) => Promise<void>;
  updateRegiao: (id: string, nome: string) => Promise<void>;
  deleteRegiao: (id: string) => Promise<void>;
  addCargo: (nome: string) => Promise<void>;
  deleteCargo: (id: string) => Promise<void>;
  addSetor: (nome: string) => Promise<void>;
  deleteSetor: (id: string) => Promise<void>;
  currentUserEmail: string;
  confirmAction?: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
  clearAllData?: (fullReset: boolean) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  usuarios,
  sedes,
  regioes,
  cargos,
  setores,
  logs,
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
  deleteSetor,
  currentUserEmail,
  confirmAction,
  clearAllData
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'usuarios' | 'sedes' | 'regioes' | 'cargos' | 'setores' | 'logs' | 'manutencao'>('usuarios');
  
  return (
    <div className="bg-transparent space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">Painel Administrativo</h1>
              <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase mt-0.5">Configurações globais e permissões</p>
            </div>
          </div>
          
          <div className="flex overflow-x-auto gap-1 border border-slate-100 p-1.5 rounded-2xl bg-slate-50/50">
            <button
              onClick={() => setActiveSubTab('usuarios')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer shrink-0 transition ${
                activeSubTab === 'usuarios' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Usuários
            </button>
            <button
              onClick={() => setActiveSubTab('sedes')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer shrink-0 transition ${
                activeSubTab === 'sedes' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Sedes
            </button>
            <button
              onClick={() => setActiveSubTab('regioes')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer shrink-0 transition ${
                activeSubTab === 'regioes' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              Regiões
            </button>
            <button
              onClick={() => setActiveSubTab('cargos')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer shrink-0 transition ${
                activeSubTab === 'cargos' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              Cargos
            </button>
            <button
              onClick={() => setActiveSubTab('setores')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer shrink-0 transition ${
                activeSubTab === 'setores' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              Setores
            </button>
            <button
              onClick={() => setActiveSubTab('logs')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer shrink-0 transition ${
                activeSubTab === 'logs' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Logs de Auditoria
            </button>
            <button
              onClick={() => setActiveSubTab('manutencao')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer shrink-0 transition ${
                activeSubTab === 'manutencao' 
                  ? 'bg-rose-600 text-white shadow-md' 
                  : 'text-rose-500 hover:text-rose-700'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              Banco de Dados & Senso
            </button>
          </div>
        </div>

        {activeSubTab === 'usuarios' && (
          <AdminUsersTab
            usuarios={usuarios}
            sedes={sedes}
            currentUserEmail={currentUserEmail}
            addUsuario={addUsuario}
            updateUsuario={updateUsuario}
            deleteUsuario={deleteUsuario}
            confirmAction={confirmAction}
          />
        )}

        {activeSubTab === 'sedes' && (
          <AdminSedesTab
            sedes={sedes}
            regioes={regioes}
            addSede={addSede}
            updateSede={updateSede}
            deleteSede={deleteSede}
            confirmAction={confirmAction}
          />
        )}

        {activeSubTab === 'regioes' && (
          <AdminRegioesTab
            regioes={regioes}
            addRegiao={addRegiao}
            updateRegiao={updateRegiao}
            deleteRegiao={deleteRegiao}
            confirmAction={confirmAction}
          />
        )}

        {activeSubTab === 'cargos' && (
          <AdminCargosTab
            cargos={cargos}
            addCargo={addCargo}
            deleteCargo={deleteCargo}
            confirmAction={confirmAction}
          />
        )}

        {activeSubTab === 'setores' && (
          <AdminSetoresTab
            setores={setores}
            addSetor={addSetor}
            deleteSetor={deleteSetor}
            confirmAction={confirmAction}
          />
        )}

        {activeSubTab === 'logs' && (
          <AdminLogsTab logs={logs} />
        )}

        {activeSubTab === 'manutencao' && (
          <div className="space-y-6">
            <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200">
              <h3 className="text-base font-bold text-amber-800 mb-2">Por que os dados deletados reaparecem?</h3>
              <p className="text-xs text-amber-700 leading-relaxed mb-4">
                No Painel do console Firebase, a sua aplicação está conectada ao Banco de Dados Firestore customizado 
                <code className="bg-amber-100 px-1.5 py-0.5 rounded mx-1 font-mono font-bold">ai-studio-2b395015-7429-44d1-83dd-233de9cd3c47</code> 
                e <strong>NÃO</strong> ao banco padrão <code className="bg-amber-100 px-1.5 py-0.5 rounded mx-1 font-mono font-bold">(default)</code>.
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Ao abrir o Firestore no console do Firebase, se você excluir coleções do banco de dados <code className="bg-amber-100 px-1.5 py-0.5 rounded mx-1 font-mono font-bold">(default)</code>,
                elas não surtirão efeito porque o aplicativo lê a base de dados customizada do AI Studio. 
                Selecione o dropdown de banco de dados na parte superior do console do Firebase e escolha o ID correspondente acima!
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">Limpeza & Sanitização Direta do Banco</h3>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Ações administrativas irreversíveis para restaurar ou zerar dados</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-100 rounded-2xl p-5 bg-slate-50/20 space-y-4 hover:border-slate-200 transition">
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Limpar Dados de Operação</h4>
                    <p className="text-xs text-slate-400 mt-1">Esvazia completamente as tabelas de Vagas, Treinamentos, Experiência, Entrevistas de Desligamento, Turnover e Logs de Auditoria. Preserva a estrutura de usuários, sedes, cargos e setores de acesso.</p>
                  </div>
                  <button
                    onClick={() => {
                      if (confirmAction) {
                        confirmAction(
                          "Zerar dados operacionais",
                          "Tem certeza de que deseja apagar absolutamente todas as vagas, treinamentos, avaliações, feedbacks de desligamento e dados estatísticos? Esta ação é irreversível.",
                          () => clearAllData?.(false)
                        );
                      } else if (window.confirm("Confirmar limpeza de dados operacionais?")) {
                        clearAllData?.(false);
                      }
                    }}
                    className="w-full py-2 px-4 bg-orange-500 hover:bg-orange-600 active:scale-95 text-xs text-white uppercase font-bold tracking-wider rounded-xl transition cursor-pointer shadow-sm shadow-orange-100"
                  >
                    Saneamento Parcial (Operacional)
                  </button>
                </div>

                <div className="border border-rose-100 rounded-2xl p-5 bg-rose-50/5 space-y-4 hover:border-rose-200 transition">
                  <div>
                    <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wide">Reset Completo de Fábrica</h4>
                    <p className="text-xs text-slate-400 mt-1">Limpa a base inteira: remove absolutamente todos os cadastros adicionais do Firestore e LocalStorage. Você precisará se cadastrar e recalibrar as configurações ao efetuar o novo login.</p>
                  </div>
                  <button
                    onClick={() => {
                      if (confirmAction) {
                        confirmAction(
                          "Reset Completo de Fábrica",
                          "Esta ação irá DELETAR absolutamente tudo das bases Firestore e locales de backup, incluindo os perfis de Usuários, Sedes, Regiões, Cargos e Setores catalogados. O sistema será reiniciado do zero absoluto.",
                          () => clearAllData?.(true)
                        );
                      } else if (window.confirm("CONFIRMAR RESET TOTAL DE FÁBRICA?")) {
                        clearAllData?.(true);
                      }
                    }}
                    className="w-full py-2 px-4 bg-rose-600 hover:bg-rose-700 active:scale-95 text-xs text-white uppercase font-bold tracking-wider rounded-xl transition cursor-pointer shadow-sm shadow-rose-100"
                  >
                    Redefinir Tudo (Reset Total)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
