import React, { useState } from 'react';
import { Plus, Trash2, HelpCircle, Edit, X } from 'lucide-react';
import { Usuario, Sede } from '../hooks/useMetadata';

interface AdminUsersTabProps {
  usuarios: Usuario[];
  sedes: Sede[];
  currentUserEmail: string;
  addUsuario: (email: string, role: 'Administrador' | 'Analista', sede?: string) => Promise<void>;
  updateUsuario: (id: string, email: string, role: 'Administrador' | 'Analista', sede?: string) => Promise<void>;
  deleteUsuario: (id: string) => Promise<void>;
  confirmAction?: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
}

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({
  usuarios,
  sedes,
  currentUserEmail,
  addUsuario,
  updateUsuario,
  deleteUsuario,
  confirmAction
}) => {
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<'Administrador' | 'Analista'>('Analista');
  const [userSede, setUserSede] = useState<string>('DT');
  const [busy, setBusy] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);

  // Set first available sede as default
  React.useEffect(() => {
    if (!editingUser && sedes && sedes.length > 0) {
      // Find if DT is available, otherwise pick the first
      const hasDT = sedes.some(s => s.nome === 'DT');
      setUserSede(hasDT ? 'DT' : sedes[0].nome);
    }
  }, [sedes, editingUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail.trim()) return;
    setBusy(true);
    try {
      if (editingUser) {
        await updateUsuario(editingUser.id || editingUser.email, userEmail.toLowerCase().trim(), userRole, userSede);
        setEditingUser(null);
      } else {
        await addUsuario(userEmail.toLowerCase().trim(), userRole, userSede);
      }
      setUserEmail('');
      setUserRole('Analista');
      if (sedes && sedes.length > 0) {
        const hasDT = sedes.some(s => s.nome === 'DT');
        setUserSede(hasDT ? 'DT' : sedes[0].nome);
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar usuário.");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (u: Usuario) => {
    setEditingUser(u);
    setUserEmail(u.email);
    setUserRole(u.role);
    setUserSede(u.sede || 'DT');
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setUserEmail('');
    setUserRole('Analista');
    if (sedes && sedes.length > 0) {
      const hasDT = sedes.some(s => s.nome === 'DT');
      setUserSede(hasDT ? 'DT' : sedes[0].nome);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 bg-slate-50/70 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">
            {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
          </h3>
          <p className="text-xs text-slate-400 font-medium mb-4">
            {editingUser 
              ? 'Altere o papel de acesso ou a sede vinculada à conta do colaborador.' 
              : 'Adicione um novo colaborador com privilégios de acesso e sede específica.'}
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">E-mail Corporativo</label>
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="colaborador@empresa.com"
                required
                className="w-full text-xs px-3.5 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 outline-none bg-white font-medium"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Papel / Acesso</label>
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value as any)}
                className="w-full text-xs px-3.5 py-3 border border-slate-200 rounded-xl outline-none bg-white font-medium focus:border-slate-800"
              >
                <option value="Analista">Analista (visualiza e edita vagas)</option>
                <option value="Administrador">Administrador (controle total)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Sede Responsável</label>
              <select
                value={userSede}
                onChange={(e) => setUserSede(e.target.value)}
                className="w-full text-xs px-3.5 py-3 border border-slate-200 rounded-xl outline-none bg-white font-medium focus:border-slate-800 focus:ring-2 focus:ring-slate-900/10"
              >
                {sedes && sedes.length > 0 ? (
                  sedes.map(s => (
                    <option key={s.id} value={s.nome}>
                      {s.nome} ({s.regiao})
                    </option>
                  ))
                ) : (
                  <>
                    <option value="DT">DT (Sudeste)</option>
                    <option value="BENFICA">BENFICA (Sul)</option>
                    <option value="Construtora">Construtora (Sudeste)</option>
                  </>
                )}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy || !userEmail.trim()}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition shrink-0 flex items-center justify-center gap-1.5 cursor-pointer text-white ${
                  editingUser 
                    ? 'bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300' 
                    : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300'
                }`}
              >
                {editingUser ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {editingUser ? 'Salvar' : 'Cadastrar'}
              </button>
              {editingUser && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="py-3 px-3 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-center cursor-pointer"
                  title="Cancelar Edição"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="mt-8 border-t border-slate-200/50 pt-4 text-[11px] text-slate-400 font-medium flex items-start gap-1.5 leading-relaxed">
          <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span>Administradores gerenciam listas e usuários. Analistas têm acesso de leitura ou gravação às vagas da sua respectiva Sede.</span>
        </div>
      </div>

      <div className="md:col-span-2 space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Usuários Registrados ({usuarios.length})</h3>
        
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 font-mono text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <th className="px-5 py-3">E-mail</th>
                <th className="px-5 py-3">Nível</th>
                <th className="px-5 py-3">Sede</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {usuarios.filter(u => u != null).map(u => (
                <tr key={u.id || u.email || Math.random().toString()} className="hover:bg-slate-50/50 transition">
                  <td className="px-5 py-3.5 font-medium text-slate-700">
                    {u.email || 'Sem E-mail'}
                    {u.email && currentUserEmail && u.email.toLowerCase() === currentUserEmail.toLowerCase() && (
                      <span className="ml-2 text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-bold uppercase">atual</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                      u.role === 'Administrador' 
                        ? 'bg-rose-50 text-rose-700 border-rose-100' 
                        : 'bg-blue-50 text-blue-700 border-blue-100'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full font-mono text-[10px] uppercase font-bold border border-slate-200">
                      {u.sede || 'DT'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2.5">
                      <button
                        onClick={() => startEdit(u)}
                        className="p-1 px-2.5 border border-slate-200 bg-white rounded-lg hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 transition text-[10px] uppercase tracking-wider font-bold text-slate-500 cursor-pointer flex items-center gap-1"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          if (u.email && currentUserEmail && u.email.toLowerCase() === currentUserEmail.toLowerCase()) {
                            alert("Você não pode deletar sua própria conta de administrador!");
                            return;
                          }
                          if (confirmAction) {
                            confirmAction(
                              "Excluir Usuário",
                              `Você tem certeza de que deseja remover o usuário "${u.email}" do sistema? Esta pessoa perderá acesso imediato às permissões do ATS.`,
                              () => deleteUsuario(u.id || u.email)
                            );
                          } else {
                            if (confirm(`Excluir conta do usuário ${u.email}?`)) {
                              deleteUsuario(u.id || u.email);
                            }
                          }
                        }}
                        className="p-1 px-2.5 border border-slate-200 bg-white rounded-lg hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 transition text-[10px] uppercase tracking-wider font-bold text-slate-500 cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-400 font-medium font-sans">
                    Nenhum usuário secundário configurado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
