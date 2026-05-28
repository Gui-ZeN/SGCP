import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Cargo } from '../hooks/useMetadata';

interface AdminCargosTabProps {
  cargos: Cargo[];
  addCargo: (nome: string) => Promise<void>;
  deleteCargo: (id: string) => Promise<void>;
  confirmAction?: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
}

export const AdminCargosTab: React.FC<AdminCargosTabProps> = ({
  cargos,
  addCargo,
  deleteCargo,
  confirmAction
}) => {
  const [cargoNome, setCargoNome] = useState('');
  const [busy, setBusy] = useState(false);

  const handleAddCargo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cargoNome.trim()) return;
    setBusy(true);
    try {
      await addCargo(cargoNome.trim());
      setCargoNome('');
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar cargo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 bg-slate-50/70 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Novo Cargo Padrão</h3>
          <p className="text-xs text-slate-400 font-medium mb-4">Adicione ao catálogo de salários base.</p>
          
          <form onSubmit={handleAddCargo} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Nome do Cargo</label>
              <input
                type="text"
                value={cargoNome}
                onChange={(e) => setCargoNome(e.target.value)}
                placeholder="Ex: Engenheiro de Software Sênior"
                required
                className="w-full text-xs px-3.5 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 outline-none bg-white font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={busy || !cargoNome.trim()}
              className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Adicionar Cargo Padrão
            </button>
          </form>
        </div>
      </div>

      <div className="md:col-span-2 space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Catálogo de Cargos Base ({cargos.length})</h3>
        
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 font-mono text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <th className="px-5 py-3">Registro</th>
                <th className="px-5 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {cargos.filter(c => c != null).map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-5 py-3.5 font-bold text-slate-700">{c.nome}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => {
                        if (confirmAction) {
                          confirmAction(
                            "Remover Cargo",
                            `Deseja realmente remover o cargo de base "${c.nome}" do catálogo global?`,
                            () => deleteCargo(c.id)
                          );
                        } else {
                          if (confirm(`Excluir cargo ${c.nome}?`)) {
                            deleteCargo(c.id);
                          }
                        }
                      }}
                      className="p-1 px-2.5 border border-slate-200 rounded-lg hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 transition text-[10px] uppercase tracking-wider font-bold text-slate-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
              {cargos.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-5 py-8 text-center text-slate-400 font-medium font-sans">
                    Catálogo de cargos vazio.
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
