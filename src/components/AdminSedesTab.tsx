import React, { useState } from 'react';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { Sede, Regiao } from '../hooks/useMetadata';

interface AdminSedesTabProps {
  sedes: Sede[];
  regioes: Regiao[];
  addSede: (nome: string, regiao: string, sigla?: string) => Promise<void>;
  updateSede: (id: string, nome: string, regiao: string, sigla?: string) => Promise<void>;
  deleteSede: (id: string) => Promise<void>;
  confirmAction?: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
}

export const AdminSedesTab: React.FC<AdminSedesTabProps> = ({
  sedes,
  regioes,
  addSede,
  updateSede,
  deleteSede,
  confirmAction
}) => {
  const [sedeNome, setSedeNome] = useState('');
  const [sedeRegiao, setSedeRegiao] = useState('');
  const [sedeSigla, setSedeSigla] = useState('');

  const [editSedeId, setEditSedeId] = useState<string | null>(null);
  const [editSedeNome, setEditSedeNome] = useState('');
  const [editSedeRegiao, setEditSedeRegiao] = useState('');
  const [editSedeSigla, setEditSedeSigla] = useState('');

  const [busy, setBusy] = useState(false);

  const handleAddSede = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sedeNome.trim() || !sedeRegiao.trim() || !sedeSigla.trim()) return;
    setBusy(true);
    try {
      await addSede(sedeNome.trim(), sedeRegiao.trim(), sedeSigla.trim());
      setSedeNome('');
      setSedeSigla('');
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar sede.");
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateSede = async (id: string) => {
    if (!editSedeNome.trim() || !editSedeRegiao.trim()) return;
    setBusy(true);
    try {
      await updateSede(id, editSedeNome.trim(), editSedeRegiao.trim(), editSedeSigla.trim());
      setEditSedeId(null);
    } catch (err) {
      console.error(err);
      alert("Erro ao editar sede.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 bg-slate-50/70 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Nova Sede</h3>
          <p className="text-xs text-slate-400 font-medium mb-4">Cadastre uma nova filial corporativa.</p>
          
          <form onSubmit={handleAddSede} className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Identificador da Sede</label>
                <input
                  type="text"
                  value={sedeNome}
                  onChange={(e) => setSedeNome(e.target.value)}
                  placeholder="Ex: Sede Central"
                  required
                  className="w-full text-xs px-3.5 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 outline-none bg-white font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Sigla da Sede</label>
                <input
                  type="text"
                  value={sedeSigla}
                  onChange={(e) => setSedeSigla(e.target.value.toUpperCase())}
                  placeholder="Ex: SC"
                  maxLength={5}
                  required
                  className="w-full text-xs px-3.5 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 outline-none bg-white font-medium uppercase"
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Região Operacional</label>
              <select
                value={sedeRegiao}
                onChange={(e) => setSedeRegiao(e.target.value)}
                required
                className="w-full text-xs px-3.5 py-3 border border-slate-200 rounded-xl outline-none bg-white font-medium focus:border-slate-800"
              >
                <option value="">Selecione uma região...</option>
                {regioes.filter(r => r != null).slice().sort((a,b) => (a.nome || '').localeCompare(b.nome || '')).map(r => (
                  <option key={r.id} value={r.nome}>{r.nome}</option>
                ))}
                {regioes.length === 0 && (
                  <option value="Geral">Geral (Cadastre uma região ao lado)</option>
                )}
              </select>
            </div>

            <button
              type="submit"
              disabled={busy || !sedeNome.trim() || !sedeRegiao || !sedeSigla.trim()}
              className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Inserir Sede
            </button>
          </form>
        </div>
      </div>

      <div className="md:col-span-2 space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sedes Cadastradas ({sedes.length})</h3>
        
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 font-mono text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <th className="px-5 py-3">Sede</th>
                <th className="px-5 py-3">Sigla</th>
                <th className="px-5 py-3">Região Geográfica</th>
                <th className="px-5 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {sedes.filter(s => s != null).map(s => {
                if (editSedeId === s.id) {
                  return (
                    <tr key={`edit-${s.id}`} className="bg-slate-50 transition">
                      <td className="px-5 py-3.5">
                        <input
                          autoFocus
                          type="text"
                          className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded font-bold text-slate-700 focus:border-indigo-500 focus:outline-none bg-white"
                          value={editSedeNome}
                          onChange={(e) => setEditSedeNome(e.target.value)}
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <input
                          type="text"
                          maxLength={5}
                          className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded font-bold text-slate-700 focus:border-indigo-500 focus:outline-none bg-white uppercase"
                          value={editSedeSigla}
                          onChange={(e) => setEditSedeSigla(e.target.value.toUpperCase())}
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <select
                          className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded focus:border-indigo-500 focus:outline-none bg-white"
                          value={editSedeRegiao}
                          onChange={(e) => setEditSedeRegiao(e.target.value)}
                        >
                          {regioes.filter(r => r != null).map(r => (
                            <option key={`edit-reg-${r.id}`} value={r.nome}>{r.nome}</option>
                          ))}
                          {regioes.length === 0 && <option value="Geral">Geral</option>}
                        </select>
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleUpdateSede(s.id)}
                          disabled={busy}
                          title="Salvar"
                          className="p-1.5 px-2 mr-2 border border-emerald-200 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition inline-flex items-center justify-center cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditSedeId(null)}
                          title="Cancelar"
                          className="p-1.5 px-2 border border-slate-200 rounded-lg text-slate-400 hover:bg-slate-100 transition inline-flex items-center justify-center cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                }
                
                return (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-3.5 font-bold text-slate-700">{s.nome}</td>
                    <td className="px-5 py-3.5 font-bold text-slate-500">{s.sigla || '-'}</td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-600">
                        {s.regiao || 'Nenhum'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          setEditSedeNome(s.nome);
                          setEditSedeRegiao(s.regiao || '');
                          setEditSedeSigla(s.sigla || '');
                          setEditSedeId(s.id);
                        }}
                        title="Editar sede"
                        className="p-1 px-2.5 mr-2 border border-slate-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition tracking-wider text-slate-400 cursor-pointer inline-flex items-center"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirmAction) {
                            confirmAction(
                              "Excluir Sede",
                              `Deseja realmente remover permanentemente a sede "${s.nome}"? Certifique-se de que não existem vagas associadas a esta sede.`,
                              () => deleteSede(s.id)
                            );
                          } else {
                            if (confirm(`Excluir sede ${s.nome}?`)) {
                              deleteSede(s.id);
                            }
                          }
                        }}
                        title="Excluir sede"
                        className="p-1 px-2.5 border border-slate-200 rounded-lg hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 transition tracking-wider text-slate-400 cursor-pointer inline-flex items-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {sedes.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-400 font-medium font-sans">
                    Nenhuma sede cadastrada.
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
