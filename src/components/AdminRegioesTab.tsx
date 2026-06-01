import React, { useState } from 'react';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { Regiao } from '../hooks/useMetadata';

interface AdminRegioesTabProps {
  regioes: Regiao[];
  addRegiao: (nome: string) => Promise<void>;
  updateRegiao: (id: string, nome: string) => Promise<void>;
  deleteRegiao: (id: string) => Promise<void>;
  confirmAction?: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
}

export const AdminRegioesTab: React.FC<AdminRegioesTabProps> = ({
  regioes,
  addRegiao,
  updateRegiao,
  deleteRegiao,
  confirmAction
}) => {
  const [regiaoNome, setRegiaoNome] = useState('');
  const [editRegiaoId, setEditRegiaoId] = useState<string | null>(null);
  const [editRegiaoNome, setEditRegiaoNome] = useState('');
  const [busy, setBusy] = useState(false);

  const handleAddRegiao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regiaoNome.trim()) return;
    setBusy(true);
    try {
      await addRegiao(regiaoNome.trim());
      setRegiaoNome('');
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar regiao.");
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateRegiao = async (id: string) => {
    if (!editRegiaoNome.trim()) return;
    setBusy(true);
    try {
      await updateRegiao(id, editRegiaoNome.trim());
      setEditRegiaoId(null);
    } catch (err) {
      console.error(err);
      alert("Erro ao editar região.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 bg-slate-50/70 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Nova Região</h3>
          <p className="text-xs text-slate-400 font-medium mb-4">Adicione divisões geográficas.</p>
          
          <form onSubmit={handleAddRegiao} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Nome da Região</label>
              <input
                type="text"
                value={regiaoNome}
                onChange={(e) => setRegiaoNome(e.target.value)}
                placeholder="Ex: Nordeste"
                required
                className="w-full text-xs px-3.5 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 outline-none bg-white font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={busy || !regiaoNome.trim()}
              className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Registrar Região
            </button>
          </form>
        </div>
      </div>

      <div className="md:col-span-2 space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Regiões Ativas ({regioes.length})</h3>
        
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 font-mono text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <th className="px-5 py-3">Código</th>
                <th className="px-5 py-3">Região</th>
                <th className="px-5 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {regioes.filter(r => r != null).map((r, i) => {
                if (editRegiaoId === r.id) {
                  return (
                    <tr key={`edit-${r.id}`} className="bg-slate-50 transition">
                      <td className="px-5 py-3.5 font-mono text-slate-400 font-medium">#{i + 1}</td>
                      <td className="px-5 py-3.5">
                        <input
                          autoFocus
                          type="text"
                          className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded font-bold text-slate-700 focus:border-indigo-500 focus:outline-none bg-white"
                          value={editRegiaoNome}
                          onChange={(e) => setEditRegiaoNome(e.target.value)}
                        />
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleUpdateRegiao(r.id)}
                          disabled={busy}
                          title="Salvar"
                          className="p-1.5 px-2 mr-2 border border-emerald-200 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition inline-flex items-center justify-center cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditRegiaoId(null)}
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
                  <tr key={r.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-3.5 font-mono text-slate-400 font-medium">#{i + 1}</td>
                    <td className="px-5 py-3.5 font-bold text-slate-700">{r.nome}</td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          setEditRegiaoNome(r.nome);
                          setEditRegiaoId(r.id);
                        }}
                        title="Editar região"
                        className="p-1 px-2.5 mr-2 border border-slate-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition tracking-wider text-slate-400 cursor-pointer inline-flex items-center"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirmAction) {
                            confirmAction(
                              "Excluir Região",
                              `Deseja realmente remover a região de operação "${r.nome}" do SGPC?`,
                              () => deleteRegiao(r.id)
                            );
                          } else {
                            if (confirm(`Excluir região ${r.nome}?`)) {
                              deleteRegiao(r.id);
                            }
                          }
                        }}
                        className="p-1 px-2.5 border border-slate-200 rounded-lg hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 transition text-[10px] uppercase tracking-wider font-bold text-slate-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {regioes.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-slate-400 font-medium font-sans">
                    Nenhuma região configurada.
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
