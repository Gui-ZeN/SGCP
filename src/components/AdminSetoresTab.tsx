import React, { useState, useMemo } from 'react';
import { Plus, Trash2, AlertTriangle, CheckCircle2, Wand2, Loader2 } from 'lucide-react';
import { Setor } from '../hooks/useMetadata';
import { Vaga } from '../types';
import { diagnosticarSetores, duplicadosProvaveis } from '../utils/setor';

interface AdminSetoresTabProps {
  setores: Setor[];
  addSetor: (nome: string) => Promise<void>;
  deleteSetor: (id: string) => Promise<void>;
  confirmAction?: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
  // Diagnóstico: compara o setor gravado nas vagas com este cadastro.
  vagas?: Vaga[];
  onPadronizarSetores?: () => Promise<void>;
}

export const AdminSetoresTab: React.FC<AdminSetoresTabProps> = ({
  setores,
  addSetor,
  deleteSetor,
  confirmAction,
  vagas = [],
  onPadronizarSetores
}) => {
  const [setorNome, setSetorNome] = useState('');
  const [busy, setBusy] = useState(false);
  const [padronizando, setPadronizando] = useState(false);

  const nomesCadastrados = useMemo(() => setores.filter(s => s != null).map(s => s.nome), [setores]);
  const diag = useMemo(() => diagnosticarSetores(vagas, nomesCadastrados), [vagas, nomesCadastrados]);
  const duplicados = useMemo(() => duplicadosProvaveis(nomesCadastrados), [nomesCadastrados]);
  const comSugestao = diag.divergentes.filter(d => d.sugestao);
  const semCorrespondencia = diag.divergentes.filter(d => !d.sugestao);
  const vagasAfetadas = comSugestao.reduce((s, d) => s + d.qtd, 0);

  const handleAddSetor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setorNome.trim()) return;
    setBusy(true);
    try {
      await addSetor(setorNome.trim());
      setSetorNome('');
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar setor.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
    {/* Diagnóstico: setores das vagas × cadastro (só aparece quando há o que revisar) */}
    {vagas.length > 0 && (diag.divergentes.length > 0 || duplicados.length > 0) && (
      <div className="bg-white border border-amber-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 bg-amber-50/60 border-b border-amber-100 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800">Setores das vagas × cadastro</h3>
            <p className="text-[11px] text-slate-500 font-semibold">
              {diag.okExato} de {diag.totalVagas} vaga(s) já usam um setor cadastrado
              {diag.semSetor > 0 ? ` · ${diag.semSetor} sem setor` : ''}
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {duplicados.length > 0 && (
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Possíveis duplicados no cadastro</h4>
              <div className="flex flex-wrap gap-1.5">
                {duplicados.map(([a, b], i) => (
                  <span key={i} className="text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-600">
                    {a} <span className="text-slate-400">↔</span> {b}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-1.5">Remova um deles acima e padronize as vagas.</p>
            </div>
          )}

          {comSugestao.length > 0 && (
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Serão padronizados ({vagasAfetadas} vaga(s))</h4>
              <div className="space-y-1">
                {comSugestao.map(d => (
                  <div key={d.valor} className="flex items-center gap-2 text-[12px]">
                    <span className="font-mono text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">{d.valor}</span>
                    <span className="text-slate-400">→</span>
                    <span className="font-bold text-emerald-700">{d.sugestao}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">({d.qtd})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {semCorrespondencia.length > 0 && (
            <div>
              <h4 className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mb-1.5">Ficariam sem setor — cadastre ou renomeie</h4>
              <div className="flex flex-wrap gap-1.5">
                {semCorrespondencia.map(d => (
                  <span key={d.valor} className="text-[11px] font-semibold bg-rose-50 border border-rose-200 rounded-lg px-2 py-1 text-rose-700">
                    {d.valor} <span className="text-rose-400">({d.qtd})</span>
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-1.5">
                Estes valores não existem no cadastro. Adicione-os ao lado (ou renomeie na vaga) — a padronização não mexe neles.
              </p>
            </div>
          )}

          {onPadronizarSetores && comSugestao.length > 0 && (
            <button
              onClick={async () => {
                const aplicar = async () => {
                  setPadronizando(true);
                  try { await onPadronizarSetores(); } finally { setPadronizando(false); }
                };
                if (confirmAction) {
                  confirmAction(
                    'Padronizar setores das vagas',
                    `Atualizar ${vagasAfetadas} vaga(s) para os nomes do cadastro? Os valores sem correspondência não serão alterados.`,
                    aplicar
                  );
                } else { await aplicar(); }
              }}
              disabled={padronizando}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md transition disabled:opacity-60"
            >
              {padronizando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              Padronizar {vagasAfetadas} vaga(s)
            </button>
          )}
        </div>
      </div>
    )}

    {vagas.length > 0 && diag.divergentes.length === 0 && duplicados.length === 0 && (
      <div className="flex items-center gap-2 text-[12px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        Todas as vagas usam setores do cadastro — nada a padronizar.
      </div>
    )}

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 bg-slate-50/70 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Novo Setor Padrão</h3>
          <p className="text-xs text-slate-400 font-medium mb-4">Adicione ao cadastro de setores organizacionais.</p>
          
          <form onSubmit={handleAddSetor} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="set-nome-do-setor" className="text-xs font-bold text-slate-500 uppercase">Nome do Setor</label>
              <input id="set-nome-do-setor"
                type="text"
                value={setorNome}
                onChange={(e) => setSetorNome(e.target.value)}
                placeholder="Ex: Recursos Humanos"
                required
                className="w-full text-xs px-3.5 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 outline-none bg-white font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={busy || !setorNome.trim()}
              className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Adicionar Setor
            </button>
          </form>
        </div>
      </div>

      <div className="md:col-span-2 space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Setores Cadastrados ({setores.length})</h3>
        
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 font-mono text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <th className="px-5 py-3">Nome do Setor</th>
                <th className="px-5 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {setores.filter(s => s != null).sort((a,b) => a.nome.localeCompare(b.nome)).map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-5 py-3.5 font-bold text-slate-700">{s.nome}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => {
                        if (confirmAction) {
                          confirmAction(
                            "Remover Setor",
                            `Deseja realmente remover o setor "${s.nome}" do catálogo global?`,
                            () => deleteSetor(s.id)
                          );
                        } else {
                          if (confirm(`Excluir setor ${s.nome}?`)) {
                            deleteSetor(s.id);
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
              {setores.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-5 py-8 text-center text-slate-400 font-medium font-sans">
                    Nenhum setor cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </div>
  );
};
