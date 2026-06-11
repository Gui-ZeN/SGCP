import React, { useState } from 'react';
import { 
  Users, 
  Building2, 
  Map, 
  Briefcase, 
  ShieldAlert,
  History,
  FolderTree,
  Upload,
  FileSpreadsheet
} from 'lucide-react';
import { Usuario, Sede, Regiao, Cargo, Setor, type UserRole } from '../hooks/useMetadata';
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
  addUsuario: (email: string, role: UserRole, sede?: string) => Promise<void>;
  updateUsuario: (id: string, email: string, role: UserRole, sede?: string) => Promise<void>;
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
  importFile: File | null;
  setImportFile: (file: File | null) => void;
  importReplace: boolean;
  setImportReplace: (replace: boolean) => void;
  importingSpreadsheet: boolean;
  importSelection: {
    vagas: boolean;
    treinamentos: boolean;
    entrevistas: boolean;
  };
  setImportSelection: React.Dispatch<React.SetStateAction<{
    vagas: boolean;
    treinamentos: boolean;
    entrevistas: boolean;
  }>>;
  onImportSpreadsheet: () => Promise<void>;
  onRecalcExperiencias?: () => void;
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
  importFile,
  setImportFile,
  importReplace,
  setImportReplace,
  importingSpreadsheet,
  importSelection,
  setImportSelection,
  onImportSpreadsheet,
  onRecalcExperiencias
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'usuarios' | 'sedes' | 'regioes' | 'cargos' | 'setores' | 'logs' | 'importacao'>('usuarios');
  
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
              onClick={() => setActiveSubTab('importacao')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer shrink-0 transition ${
                activeSubTab === 'importacao' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Importar Excel
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

        {activeSubTab === 'importacao' && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-850 tracking-tight">Importar planilha SGPC</h3>
                    <p className="text-xs text-slate-500 font-semibold mt-1">Importe vagas, treinamentos e entrevistas de desligamento a partir de Excel.</p>
                  </div>
                </div>
                {importFile && (
                  <span className="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 truncate">
                    {importFile.name}
                  </span>
                )}
              </div>

              <div className="space-y-5 max-w-3xl">
                <label className="block">
                  <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Arquivo .xlsx</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2.5 file:text-xs file:font-bold file:uppercase file:tracking-wider file:text-white hover:file:bg-slate-800 file:cursor-pointer cursor-pointer"
                  />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    ['vagas', 'Vagas'],
                    ['treinamentos', 'Treinamentos'],
                    ['entrevistas', 'Entrevistas']
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={importSelection[key as keyof typeof importSelection]}
                        onChange={(e) => setImportSelection(prev => ({ ...prev, [key]: e.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                      />
                      {label}
                    </label>
                  ))}
                </div>

                <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importReplace}
                    onChange={(e) => setImportReplace(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-amber-300 text-orange-500 focus:ring-orange-500"
                  />
                  <span>
                    <strong className="block uppercase tracking-wider text-[10px]">Substituir dados dos módulos selecionados</strong>
                    Se desmarcado, o SGPC adiciona registros novos e evita duplicar pelo código ou pela chave da entrevista.
                  </span>
                </label>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setImportFile(null)}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-xs font-bold rounded-xl text-slate-600 cursor-pointer"
                  >
                    Limpar
                  </button>
                  <button
                    type="button"
                    onClick={onImportSpreadsheet}
                    disabled={importingSpreadsheet}
                    className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-xs font-bold rounded-xl text-white shadow-lg shadow-orange-500/20 cursor-pointer flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    {importingSpreadsheet ? 'Importando...' : 'Importar'}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800">Manutenção · Vencimentos de Experiência</h3>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5 leading-relaxed">
                    Recalcula os prazos de 45 e 90 dias das experiências já cadastradas usando a contagem inclusiva (o dia da admissão conta como dia 1). Rode uma vez para corrigir os registros antigos; só altera os que estiverem diferentes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onRecalcExperiencias}
                disabled={!onRecalcExperiencias}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-xs font-bold rounded-xl text-white shadow-md cursor-pointer flex items-center gap-2"
              >
                <History className="w-4 h-4" />
                Recalcular vencimentos (45/90)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

