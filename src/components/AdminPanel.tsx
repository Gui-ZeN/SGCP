import React, { useState } from 'react';
import { 
  Users, 
  Building2, 
  Map, 
  Briefcase, 
  ShieldAlert,
  History,
  FolderTree
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
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  usuarios,
  sedes,
  regioes,
  cargos,
  setores,
  logs,
  addUsuario,
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
  confirmAction
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'usuarios' | 'sedes' | 'regioes' | 'cargos' | 'setores' | 'logs'>('usuarios');
  
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
          </div>
        </div>

        {activeSubTab === 'usuarios' && (
          <AdminUsersTab
            usuarios={usuarios}
            sedes={sedes}
            currentUserEmail={currentUserEmail}
            addUsuario={addUsuario}
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
      </div>
    </div>
  );
};
