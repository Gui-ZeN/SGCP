/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Treinamento } from '../types';
import { toISOInput } from '../utils/date';
import { exportToXlsx } from '../utils/xlsxExporter';
import { Search, Plus, Download, Trash2, Pencil, Upload, Loader2 } from 'lucide-react';
import { Sede } from '../hooks/useMetadata';
import { Modal } from './ui/Modal';
import { FiltroMultiplo } from './ui/FiltroMultiplo';
import { Kpi } from './indicadores/ui';

interface TreinamentosSectionProps {
  treinamentos: Treinamento[];
  addTreinamento: (input: Omit<Treinamento, 'id' | 'codigo'>) => Promise<void>;
  updateTreinamento: (id: string, updatedFields: Partial<Treinamento>) => Promise<void>;
  deleteTreinamento: (id: string) => Promise<void>;
  sedes?: Sede[];
  confirmAction?: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
  userSede?: string;
  isAdmin?: boolean;
  canManage?: boolean;
  // Import da planilha "Monitoramento Treinamentos" da Universidade (botão só
  // aparece quando o App passa o handler — usuário da Universidade ou admin).
  onImportUniversidade?: (file: File) => Promise<void>;
}

export const TreinamentosSection: React.FC<TreinamentosSectionProps> = ({ 
  treinamentos, 
  addTreinamento, 
  updateTreinamento,
  deleteTreinamento,
  sedes,
  confirmAction,
  userSede,
  isAdmin = false,
  canManage = true,
  onImportUniversidade
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [importandoUni, setImportandoUni] = useState(false);
  const uniFileRef = useRef<HTMLInputElement>(null);
  // Filtros de múltipla escolha; nada marcado = todos. Quem não é admin fica
  // travado na própria unidade (como antes).
  const sedeTravada = !isAdmin && !!userSede;
  const [unidadesSel, setUnidadesSel] = useState<string[]>([]);
  const [tiposSel, setTiposSel] = useState<string[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTreinamento, setEditingTreinamento] = useState<Treinamento | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // New Training form state
  const [tema, setTema] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataTermino, setDataTermino] = useState('');
  const [tipo, setTipo] = useState<Treinamento['tipo']>('Técnico');
  const [facilitador, setFacilitador] = useState('');
  const [publico, setPublico] = useState('');
  const [unidade, setUnidade] = useState('DT');
  const [cargaHoraria, setCargaHoraria] = useState<number>(8);
  const [qtdPrevista, setQtdPrevista] = useState<number>(10);
  const [qtdRealizada, setQtdRealizada] = useState<number>(10);
  const [valorInvestido, setValorInvestido] = useState<number>(500);
  const [mesReferenciaOverride, setMesReferenciaOverride] = useState<string>('');

  // Auto-calculate suggested ref month for display
  const [autoRefMonth, setAutoRefMonth] = useState('geral');
  
  useEffect(() => {
    if (dataInicio) {
      const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
      try {
        let parts = dataInicio.split('-');
        if (parts.length === 3) {
          const mIdx = parseInt(parts[1], 10) - 1;
          if (mIdx >= 0 && mIdx < 12) {
            setAutoRefMonth(months[mIdx]);
            return;
          }
        }
        parts = dataInicio.split('/');
        if (parts.length === 3) {
          const mIdx = parseInt(parts[1], 10) - 1;
          if (mIdx >= 0 && mIdx < 12) {
            setAutoRefMonth(months[mIdx]);
            return;
          }
        }
      } catch (err) {}
    }
    setAutoRefMonth('geral');
  }, [dataInicio]);
  
  // Options
  const unidadesList = useMemo(() => {
    const list = sedes ? sedes.map(s => s.nome) : treinamentos.map(t => t.unidade).filter(Boolean);
    return Array.from(new Set(list as string[])).filter(Boolean).sort((a,b) => a.localeCompare(b));
  }, [treinamentos, sedes]);

  const tiposList: Treinamento['tipo'][] = ['Liderança', 'Integração', 'Técnico', 'Operacional', 'Comportamental'].sort((a,b) => a.localeCompare(b)) as Treinamento['tipo'][];

  const dateToInput = (value?: string) => toISOInput(value);

  const resetForm = () => {
    setTema('');
    setDataInicio('');
    setDataTermino('');
    setTipo('Técnico');
    setFacilitador('');
    setPublico('');
    setUnidade(userSede || 'DT');
    setCargaHoraria(8);
    setQtdPrevista(10);
    setQtdRealizada(10);
    setValorInvestido(500);
    setMesReferenciaOverride('');
    setEditingTreinamento(null);
    setErrorMsg('');
  };

  const openCreateForm = () => {
    resetForm();
    setShowAddForm(true);
  };

  const openEditForm = (treinamento: Treinamento) => {
    setEditingTreinamento(treinamento);
    setTema(treinamento.tema || '');
    setDataInicio(dateToInput(treinamento.dataInicio));
    setDataTermino(dateToInput(treinamento.dataTermino));
    setTipo(treinamento.tipo || 'Técnico');
    setFacilitador(treinamento.facilitador || '');
    setPublico(treinamento.publico || '');
    setUnidade(treinamento.unidade || userSede || 'DT');
    setCargaHoraria(treinamento.cargaHoraria || 0);
    setQtdPrevista(treinamento.qtdPrevista || 0);
    setQtdRealizada(treinamento.qtdRealizada || 0);
    setValorInvestido(treinamento.valorInvestido || 0);
    setMesReferenciaOverride(treinamento.mesReferencia || '');
    setErrorMsg('');
    setShowAddForm(true);
  };

  // Filters
  const filteredList = useMemo(() => {
    return treinamentos.filter(t => {
      const matchText = !searchTerm.trim() || 
        t.tema.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.facilitador.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.publico.toLowerCase().includes(searchTerm.toLowerCase());
      
      const unidades = sedeTravada ? [userSede!] : unidadesSel;
      const matchUnidade = !unidades.length || unidades.some(u => (t.unidade || '').toLowerCase() === u.toLowerCase());
      const matchTipo = !tiposSel.length || tiposSel.includes(t.tipo);

      return matchText && matchUnidade && matchTipo;
    });
  }, [treinamentos, searchTerm, unidadesSel, tiposSel, userSede, sedeTravada]);

  // Stats
  const stats = useMemo(() => {
    let totalInvestido = 0;
    let totalHorasFormacao = 0;
    let totalCarga = 0;
    let totalPrevisto = 0;
    let totalRealizado = 0;

    filteredList.forEach(t => {
      totalInvestido += (t.valorInvestido || 0);
      totalHorasFormacao += (t.totalHorasFormacao || ((t.qtdRealizada || 0) * (t.cargaHoraria || 0)));
      totalCarga += (t.cargaHoraria || 0);
      totalPrevisto += (t.qtdPrevista || 0);
      totalRealizado += (t.qtdRealizada || 0);
    });

    return {
      totalInvestido,
      totalHorasFormacao,
      totalCarga,
      presencaMedia: totalPrevisto > 0 ? Math.round((totalRealizado / totalPrevisto) * 100) : 100,
      totalQualificados: totalRealizado
    };
  }, [filteredList]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!tema.trim() || !facilitador.trim() || !dataInicio.trim()) {
      setErrorMsg("Por favor, preencha Tema, Facilitador e Data de Início.");
      return;
    }

    // Reference month computation (Portuguese e.g. "maio")
    const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    let refMonth = 'geral';
    
    // Format YYYY-MM-DD to DD/MM/YYYY if needed, and detect month
    let finalDataInicio = dataInicio;
    let finalDataTermino = dataTermino;
    
    try {
      let parts = dataInicio.split('-');
      if (parts.length === 3) {
        finalDataInicio = `${parts[2]}/${parts[1]}/${parts[0]}`;
        const mIdx = parseInt(parts[1], 10) - 1;
        if (mIdx >= 0 && mIdx < 12) {
          refMonth = months[mIdx];
        }
      } else {
        parts = dataInicio.split('/');
        if (parts.length === 3) {
          const mIdx = parseInt(parts[1], 10) - 1;
          if (mIdx >= 0 && mIdx < 12) {
            refMonth = months[mIdx];
          }
        }
      }
      
      if (dataTermino) {
        const partsTerm = dataTermino.split('-');
        if (partsTerm.length === 3) {
          finalDataTermino = `${partsTerm[2]}/${partsTerm[1]}/${partsTerm[0]}`;
        }
      }
    } catch(err){}

    const totalCalculatedHours = Number(qtdRealizada) * Number(cargaHoraria);

    const payload = {
      dataInicio: finalDataInicio,
      dataTermino: finalDataTermino || undefined,
      mesReferencia: mesReferenciaOverride || refMonth,
      tema,
      tipo,
      facilitador,
      publico,
      unidade,
      cargaHoraria: Number(cargaHoraria) || 0,
      qtdPrevista: Number(qtdPrevista) || 0,
      qtdRealizada: Number(qtdRealizada) || 0,
      totalHorasFormacao: totalCalculatedHours,
      valorInvestido: Number(valorInvestido) || 0
    };

    try {
      if (editingTreinamento) {
        await updateTreinamento(editingTreinamento.id, payload);
      } else {
        await addTreinamento(payload);
      }
      resetForm();
      setShowAddForm(false);
    } catch (err: any) {
      setErrorMsg('Erro ao salvar. Verifique a conexão e tente novamente.' + (err?.message ? ` (${err.message})` : ''));
    }
  };

  const handleExportTreinamentos = async () => {
    if (!filteredList.length) { alert('Nenhum treinamento para exportar.'); return; }
    const columns = [
      { title: 'Código', width: 10 },
      { title: 'Tema', width: 34 },
      { title: 'Tipo', width: 16 },
      { title: 'Data Início', width: 14 },
      { title: 'Data Término', width: 14 },
      { title: 'Mês Referência', width: 16 },
      { title: 'Facilitador', width: 24 },
      { title: 'Público', width: 22 },
      { title: 'Unidade', width: 16 },
      { title: 'Carga Horária', width: 14 },
      { title: 'Qtd Prevista', width: 14 },
      { title: 'Qtd Realizada', width: 14 },
      { title: 'Horas Formação', width: 16 },
      { title: 'Valor Investido (R$)', width: 18 }
    ];
    const rows = filteredList.map(t => [
      { type: Number, value: t.codigo ?? null },
      { type: String, value: t.tema || null },
      { type: String, value: t.tipo || null },
      { type: String, value: t.dataInicio || null },
      { type: String, value: t.dataTermino || null },
      { type: String, value: t.mesReferencia || null },
      { type: String, value: t.facilitador || null },
      { type: String, value: t.publico || null },
      { type: String, value: t.unidade || null },
      { type: Number, value: t.cargaHoraria ?? null },
      { type: Number, value: t.qtdPrevista ?? null },
      { type: Number, value: t.qtdRealizada ?? null },
      { type: Number, value: t.totalHorasFormacao ?? null },
      { type: Number, value: t.valorInvestido ?? null }
    ]);
    try {
      await exportToXlsx(`relatorio_treinamentos_${new Date().toISOString().slice(0, 10)}.xlsx`, columns, rows, { sheet: 'Treinamentos' });
    } catch (err) {
      console.error('Erro ao exportar XLSX:', err);
      alert('Não foi possível gerar o arquivo Excel. Tente novamente.');
    }
  };

  const corDoAproveitamento = (p: number) => (p >= 90 ? 'var(--etapa-admissao)' : p >= 70 ? 'var(--etapa-triagem)' : 'var(--atraso)');
  const fecharForm = () => { resetForm(); setShowAddForm(false); };

  return (
    <div className="space-y-5">
      <header className="pagina-cab">
        <div className="min-w-0">
          <p className="pagina-trilha">Pessoas</p>
          <h1 className="pagina-titulo">Treinamentos</h1>
          <p className="inicio-sub">Capacitações, horas de formação e investimento.</p>
        </div>
        <div className="pagina-acoes">
          <button type="button" className="btn" onClick={handleExportTreinamentos} title="Baixar planilha Excel (.xlsx)">
            <Download aria-hidden="true" /> Exportar
          </button>
          {canManage && onImportUniversidade && (
            <>
              <input
                ref={uniFileRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                aria-label="Planilha Monitoramento Treinamentos (Universidade)"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setImportandoUni(true);
                  try { await onImportUniversidade(f); }
                  finally { setImportandoUni(false); if (uniFileRef.current) uniFileRef.current.value = ''; }
                }}
              />
              <button type="button" className="btn" onClick={() => uniFileRef.current?.click()} disabled={importandoUni}
                title="Importar a planilha Monitoramento Treinamentos (abas por ano)">
                {importandoUni ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
                Importar (Universidade)
              </button>
            </>
          )}
          {canManage && (
            <button type="button" id="btn-show-add-treinamento" className="btn btn-primario" onClick={openCreateForm}>
              <Plus aria-hidden="true" /> Registrar treinamento
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi rotulo="Investimento" valor={stats.totalInvestido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
        <Kpi rotulo="Horas de formação" valor={stats.totalHorasFormacao.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} unidade="h" />
        <Kpi rotulo="Concluintes" valor={stats.totalQualificados.toLocaleString('pt-BR')} detalhe="pessoas que participaram" />
        <Kpi rotulo="Aproveitamento" valor={`${stats.presencaMedia}%`} detalhe="presentes ÷ previstos"
          tom={stats.presencaMedia >= 90 ? 'bom' : stats.presencaMedia >= 70 ? 'atencao' : 'critico'} />
      </div>

      {/* Todo filtro é de múltipla escolha (regra de 08/10/2026). */}
      <div className="filtros">
        {sedeTravada
          ? <span className="chip" title="Seu acesso é desta unidade">Unidade: <b>{userSede}</b></span>
          : <FiltroMultiplo rotulo="Unidade" opcoes={unidadesList.map(u => ({ valor: u, rotulo: u }))} selecionados={unidadesSel} onChange={setUnidadesSel} todos="todas" />}
        <FiltroMultiplo rotulo="Tipo" opcoes={tiposList.map(t => ({ valor: t, rotulo: t }))} selecionados={tiposSel} onChange={setTiposSel} />
        <label className="campo-busca">
          <Search aria-hidden="true" />
          <input type="search" className="campo" placeholder="Buscar tema, facilitador ou público" aria-label="Buscar tema, facilitador ou público"
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </label>
      </div>

      {filteredList.length === 0 ? (
        <p className="painel text-center py-12 text-[14px]" style={{ color: 'var(--tinta-3)' }}>Nenhum treinamento com esses filtros.</p>
      ) : (
        <div className="grade-cartoes">
          {filteredList.map((t) => {
            const presencaPct = t.qtdPrevista > 0 ? Math.round((t.qtdRealizada / t.qtdPrevista) * 100) : 100;
            return (
              <article key={t.id} className="painel cartao-item">
                <div className="cartao-item-antes">
                  <span>nº {t.codigo || 's/n'} · {t.unidade || 'sem unidade'}</span>
                  <span className="etiqueta">{t.tipo}</span>
                </div>
                <h3>{t.tema}</h3>
                <p className="cartao-item-meta">{t.dataInicio}{t.dataTermino ? ` a ${t.dataTermino}` : ''}</p>

                <dl className="ficha mt-3">
                  <div><dt>Facilitador</dt><dd className="truncate" title={t.facilitador}>{t.facilitador || '—'}</dd></div>
                  <div><dt>Público</dt><dd className="truncate" title={t.publico}>{t.publico || '—'}</dd></div>
                </dl>

                <div className="mt-4">
                  <div className="flex items-baseline justify-between text-[13px]" style={{ color: 'var(--tinta-2)' }}>
                    <span><b className="tabular-nums" style={{ color: 'var(--tinta)' }}>{t.qtdRealizada}</b> de {t.qtdPrevista} participaram</span>
                    <b className="tabular-nums" style={{ color: corDoAproveitamento(presencaPct) }}>{presencaPct}%</b>
                  </div>
                  <div className="barra-fina mt-1.5" aria-hidden="true">
                    <span style={{ width: `${Math.min(presencaPct, 100)}%`, background: corDoAproveitamento(presencaPct) }} />
                  </div>
                </div>

                <p className="mt-3 flex justify-between gap-3 text-[13px]" style={{ color: 'var(--tinta-2)' }}>
                  <span>{t.cargaHoraria}h por pessoa · {(t.totalHorasFormacao || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h no total</span>
                  <b className="tabular-nums shrink-0" style={{ color: 'var(--tinta)' }} title={`Custo (${t.mesReferencia})`}>
                    {t.valorInvestido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </b>
                </p>

                {canManage && (
                  <div className="cartao-item-acoes mt-auto">
                    <button type="button" className="btn-texto inline-flex items-center gap-1.5" onClick={() => openEditForm(t)}>
                      <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Editar
                    </button>
                    <button type="button" className="btn-texto inline-flex items-center gap-1.5" style={{ color: 'var(--atraso)' }}
                      onClick={() => {
                        if (confirmAction) {
                          confirmAction('Excluir treinamento', `Remover "${t.tema}"? Ele sai também dos Indicadores.`, () => deleteTreinamento(t.id));
                        } else if (confirm(`Remover permanentemente "${t.tema}"?`)) {
                          deleteTreinamento(t.id);
                        }
                      }}>
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Excluir
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {showAddForm && (
        <Modal
          titulo={editingTreinamento ? 'Editar treinamento' : 'Registrar treinamento'}
          antes={editingTreinamento ? <>nº {editingTreinamento.codigo || 's/n'}</> : undefined}
          aoFechar={fecharForm}
          rodape={<>
            <button type="button" className="btn" onClick={fecharForm}>Cancelar</button>
            <button type="submit" form="form-treinamento" className="btn btn-primario">{editingTreinamento ? 'Salvar alterações' : 'Registrar'}</button>
          </>}
        >
          <form id="form-treinamento" onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && <p role="alert" className="erro-form">{errorMsg}</p>}
            <label className="block">
              <span className="rotulo">Tema *</span>
              <input type="text" required className="campo w-full" placeholder="Ex.: LNT e processo de promoções"
                value={tema} onChange={(e) => setTema(e.target.value)} />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block">
                <span className="rotulo">Início *</span>
                <input type="date" required className="campo w-full" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </label>
              <label className="block">
                <span className="rotulo">Término</span>
                <input type="date" className="campo w-full" value={dataTermino} onChange={(e) => setDataTermino(e.target.value)} />
              </label>
              <label className="block">
                <span className="rotulo">Mês de referência</span>
                <input type="text" className="campo w-full capitalize placeholder:normal-case" placeholder={`Automático: ${autoRefMonth}`}
                  value={mesReferenciaOverride} onChange={(e) => setMesReferenciaOverride(e.target.value)} />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="rotulo">Tipo</span>
                <select className="campo w-full" value={tipo} onChange={(e) => setTipo(e.target.value as Treinamento['tipo'])}>
                  {tiposList.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="rotulo">Facilitador *</span>
                <input type="text" required className="campo w-full" placeholder="Ex.: Arlana Carvalho (RH)"
                  value={facilitador} onChange={(e) => setFacilitador(e.target.value)} />
              </label>
              <label className="block">
                <span className="rotulo">Unidade</span>
                <select className="campo w-full" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
                  {unidade && !unidadesList.includes(unidade) && <option value={unidade}>{unidade}</option>}
                  {unidadesList.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="rotulo">Carga horária por pessoa (h)</span>
                <input type="number" min={0} className="campo w-full tabular-nums" value={cargaHoraria} onChange={(e) => setCargaHoraria(Number(e.target.value))} />
              </label>
            </div>

            <label className="block">
              <span className="rotulo">Público</span>
              <input type="text" className="campo w-full" placeholder="Ex.: auxiliares e analistas"
                value={publico} onChange={(e) => setPublico(e.target.value)} />
            </label>

            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <span className="rotulo">Previstos</span>
                <input type="number" min={0} className="campo w-full tabular-nums" value={qtdPrevista} onChange={(e) => setQtdPrevista(Number(e.target.value))} />
              </label>
              <label className="block">
                <span className="rotulo">Participaram</span>
                <input type="number" min={0} className="campo w-full tabular-nums" value={qtdRealizada} onChange={(e) => setQtdRealizada(Number(e.target.value))} />
              </label>
              <label className="block">
                <span className="rotulo">Valor (R$)</span>
                <input type="number" min={0} step="0.01" className="campo w-full tabular-nums" value={valorInvestido} onChange={(e) => setValorInvestido(Number(e.target.value))} />
              </label>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
