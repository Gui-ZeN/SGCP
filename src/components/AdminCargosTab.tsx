import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Cargo } from '../hooks/useMetadata';

/**
 * Níveis da régua hierárquica. São rótulos fixos porque o organograma precisa
 * de uma ordem comparável entre cargos — texto livre ("chefia", "gestão") não
 * se ordena sozinho.
 */
export const NIVEIS_CARGO = [
  { valor: 1, rotulo: 'Diretoria' },
  { valor: 2, rotulo: 'Gerência' },
  { valor: 3, rotulo: 'Coordenação' },
  { valor: 4, rotulo: 'Supervisão' },
  { valor: 5, rotulo: 'Analista / Técnico' },
  { valor: 6, rotulo: 'Assistente / Auxiliar' },
  { valor: 7, rotulo: 'Aprendiz / Estágio' },
];

export const rotuloDoNivel = (nivel?: number | null) =>
  NIVEIS_CARGO.find(n => n.valor === nivel)?.rotulo || '';

interface AdminCargosTabProps {
  cargos: Cargo[];
  addCargo: (nome: string, nivel?: number) => Promise<void>;
  updateCargoNivel?: (id: string, nivel: number | null) => Promise<void>;
  deleteCargo: (id: string) => Promise<void>;
  confirmAction?: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
}

export const AdminCargosTab: React.FC<AdminCargosTabProps> = ({
  cargos,
  addCargo,
  updateCargoNivel,
  deleteCargo,
  confirmAction
}) => {
  const [cargoNome, setCargoNome] = useState('');
  const [cargoNivel, setCargoNivel] = useState('');
  const [busy, setBusy] = useState(false);

  const handleAddCargo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cargoNome.trim()) return;
    setBusy(true);
    try {
      await addCargo(cargoNome.trim(), cargoNivel ? Number(cargoNivel) : undefined);
      setCargoNome('');
      setCargoNivel('');
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar cargo.");
    } finally {
      setBusy(false);
    }
  };

  const semNivel = cargos.filter(c => c && !c.nivel).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 bg-slate-50/70 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Novo Cargo Padrão</h3>
          <p className="text-xs text-slate-400 font-medium mb-4">Adicione ao catálogo de salários base.</p>
          
          <form onSubmit={handleAddCargo} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="cgo-nome-do-cargo" className="text-xs font-bold text-slate-500 uppercase">Nome do Cargo</label>
              <input id="cgo-nome-do-cargo"
                type="text"
                value={cargoNome}
                onChange={(e) => setCargoNome(e.target.value)}
                placeholder="Ex: Engenheiro de Software Sênior"
                required
                className="w-full text-xs px-3.5 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 outline-none bg-white font-medium"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="cgo-nivel" className="text-xs font-bold text-slate-500 uppercase">
                Nível hierárquico
              </label>
              <select id="cgo-nivel" value={cargoNivel} onChange={e => setCargoNivel(e.target.value)}
                className="w-full text-xs px-3.5 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 outline-none bg-white font-medium cursor-pointer">
                <option value="">Sem nível definido</option>
                {NIVEIS_CARGO.map(n => (
                  <option key={n.valor} value={n.valor}>{n.valor} — {n.rotulo}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 font-semibold">
                É o nível que monta o organograma. Definido uma vez por cargo, vale para todos que o ocupam.
              </p>
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
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Catálogo de Cargos Base ({cargos.length})
        </h3>
        {semNivel > 0 && (
          <p className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            {semNivel === 1
              ? '1 cargo ainda sem nível — quem o ocupa fica de fora do organograma.'
              : `${semNivel} cargos ainda sem nível — quem os ocupa fica de fora do organograma.`}
          </p>
        )}

        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 font-mono text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <th className="px-5 py-3">Registro</th>
                <th className="px-5 py-3">Nível hierárquico</th>
                <th className="px-5 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {cargos.filter(c => c != null).map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-5 py-3.5 font-bold text-slate-700">{c.nome}</td>
                  <td className="px-5 py-3.5">
                    {updateCargoNivel ? (
                      <select
                        value={c.nivel ?? ''}
                        aria-label={`Nível hierárquico de ${c.nome}`}
                        onChange={e => updateCargoNivel(c.id, e.target.value ? Number(e.target.value) : null)}
                        className={`text-[11px] px-2 py-1.5 border rounded-lg font-bold outline-none cursor-pointer focus:border-slate-800 ${
                          c.nivel ? 'border-slate-200 bg-white text-slate-700' : 'border-amber-200 bg-amber-50 text-amber-800'
                        }`}
                      >
                        <option value="">Sem nível</option>
                        {NIVEIS_CARGO.map(n => (
                          <option key={n.valor} value={n.valor}>{n.valor} — {n.rotulo}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-600 font-semibold">{rotuloDoNivel(c.nivel) || '—'}</span>
                    )}
                  </td>
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
                  <td colSpan={3} className="px-5 py-8 text-center text-slate-500 font-medium font-sans">
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
