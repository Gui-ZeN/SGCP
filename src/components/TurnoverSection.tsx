/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Turnover } from '../types';
import { Plus, Trash2, Download } from 'lucide-react';
import { exportToXlsx } from '../utils/xlsxExporter';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';
import { Modal } from './ui/Modal';
import { FiltroMultiplo } from './ui/FiltroMultiplo';
import { Kpi, Painel, Dica, useEixos, dec } from './indicadores/ui';

interface TurnoverSectionProps {
  turnover: Turnover[];
  addTurnover: (input: Omit<Turnover, 'id'>) => Promise<void>;
  updateTurnover: (id: string, updatedFields: Partial<Turnover>) => Promise<void>;
  deleteTurnover: (id: string) => Promise<void>;
  confirmAction?: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
  canManage?: boolean;
}

export const TurnoverSection: React.FC<TurnoverSectionProps> = ({
  turnover,
  addTurnover,
  updateTurnover,
  deleteTurnover,
  confirmAction,
  canManage = true
}) => {
  // Eixos, grade, legenda e dica: as mesmas peças dos Indicadores.
  const { C, grade, eixo, cursorBarra, cursorLinha, legenda } = useEixos();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTurnover, setEditingTurnover] = useState<Turnover | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Form states. Mês e ano são SEPARADOS: o `<input type="month">` obriga a
  // digitar "mm/aaaa" e é a parte mais penosa do lançamento mensal.
  const [mes, setMes] = useState('');
  const [ano, setAno] = useState('');
  const [totalFuncionarios, setTotalFuncionarios] = useState<number>(0);
  const [totalAdmissao, setTotalAdmissao] = useState<number>(0);
  const [pediramSair, setPediramSair] = useState<number>(0);
  const [foramDesligados, setForamDesligados] = useState<number>(0);
  /**
   * O efetivo foi digitado à mão? Enquanto não for, ele é recalculado do mês
   * anterior. Depois de editado, paramos de sobrescrever — quem digitou sabe de
   * algo que a conta não sabe (transferência entre unidades, correção de
   * cadastro), e apagar isso a cada tecla seria hostil.
   */
  const [efetivoManual, setEfetivoManual] = useState(false);
  // '' = consolidado (Colégio + Universidade no mesmo número), que é como os
  // meses antigos foram lançados.
  const [unidade, setUnidade] = useState<'' | 'colegio' | 'universidade'>('');
  // Múltipla escolha (regra de 08/10/2026); nada marcado = todas.
  const [unidadesSel, setUnidadesSel] = useState<string[]>([]);

  /** Rótulo da unidade; sem valor é consolidado (as duas juntas). */
  const rotuloUnidade = (u?: string) =>
    u === 'colegio' ? 'Colégio' : u === 'universidade' ? 'Universidade' : 'Consolidado';

  const MESES = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];

  /** Anos oferecidos: os já lançados + o corrente e o seguinte, sem buracos. */
  const anosDisponiveis = useMemo(() => {
    const atual = new Date().getFullYear();
    const anos = new Set<number>([atual, atual + 1]);
    turnover.forEach(t => {
      const a = Number((t.mesAno || '').split('/')[1]);
      if (a) anos.add(a);
    });
    const lista = [...anos].sort((a, b) => a - b);
    // Preenche os buracos, para o dropdown não pular de 2023 para 2026.
    return Array.from({ length: lista[lista.length - 1] - lista[0] + 1 }, (_, i) => lista[0] + i);
  }, [turnover]);

  const resetForm = () => {
    // Abre no mês PASSADO: "logar mês operacional" é fechar o mês que acabou.
    const agora = new Date();
    const anterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
    setMes(String(anterior.getMonth() + 1).padStart(2, '0'));
    setAno(String(anterior.getFullYear()));
    setTotalFuncionarios(0);
    setTotalAdmissao(0);
    setPediramSair(0);
    setForamDesligados(0);
    setEfetivoManual(false);
    setUnidade('');
    setEditingTurnover(null);
    setErrorMsg('');
  };

  const openCreateForm = () => {
    resetForm();
    setShowAddForm(true);
  };

  const openEditForm = (item: Turnover) => {
    setEditingTurnover(item);
    const [m, a] = (item.mesAno || '').split('/');
    setMes(m || '');
    setAno(a || '');
    // Editando, o efetivo é o que está gravado — nunca recalculado por cima.
    setEfetivoManual(true);
    setTotalFuncionarios(item.totalFuncionarios || 0);
    setTotalAdmissao(item.totalAdmissao || 0);
    setPediramSair(item.pediramSair || 0);
    setForamDesligados(item.foramDesligados || 0);
    setUnidade(item.unidade || '');
    setErrorMsg('');
    setShowAddForm(true);
  };

  // Auto computations mapping for chart visualization
  /**
   * Registros da unidade escolhida. "Consolidado" são os meses lançados antes
   * de existir o campo — vivem sozinhos, sem par de unidade.
   */
  const turnoverFiltrado = useMemo(() => {
    if (!unidadesSel.length) return turnover;
    return turnover.filter(t => unidadesSel.includes(t.unidade || 'consolidado'));
  }, [turnover, unidadesSel]);

  /** A base tem registro por unidade? Só então o filtro faz sentido na tela. */
  const temUnidadeLancada = useMemo(() => turnover.some(t => !!t.unidade), [turnover]);

  const computedData = useMemo(() => {
    return turnoverFiltrado.map((item) => {
      const saidasTotais = (item.pediramSair || 0) + (item.foramDesligados || 0);
      
      // Formulas
      const turnoverTotal = item.totalFuncionarios > 0 
        ? (((item.totalAdmissao + saidasTotais) / 2) / item.totalFuncionarios) * 100 
        : 0;

      const turnoverVoluntario = item.totalFuncionarios > 0
        ? ((item.pediramSair || 0) / item.totalFuncionarios) * 100
        : 0;

      const turnoverInvoluntario = item.totalFuncionarios > 0
        ? ((item.foramDesligados || 0) / item.totalFuncionarios) * 100
        : 0;

      return {
        ...item,
        saidasTotais,
        turnoverTotal: Number(turnoverTotal.toFixed(2)),
        turnoverVoluntario: Number(turnoverVoluntario.toFixed(2)),
        turnoverInvoluntario: Number(turnoverInvoluntario.toFixed(2))
      };
    });
  }, [turnoverFiltrado]);

  /**
   * Série dos gráficos. Com mais de uma unidade na tela, SOMA os registros do
   * mesmo mês: sem isso o eixo mostraria "07/2026" duas vezes, uma por
   * unidade, como se fossem meses diferentes. Com UMA unidade, cada mês já é
   * único e a série passa direto.
   */
  const dadosGrafico = useMemo(() => {
    if (unidadesSel.length === 1) return computedData;

    const porMes = new Map<string, any>();
    computedData.forEach(item => {
      const atual = porMes.get(item.mesAno);
      if (!atual) { porMes.set(item.mesAno, { ...item }); return; }
      atual.totalFuncionarios += item.totalFuncionarios || 0;
      atual.totalAdmissao += item.totalAdmissao || 0;
      atual.pediramSair += item.pediramSair || 0;
      atual.foramDesligados += item.foramDesligados || 0;
      atual.saidasTotais += item.saidasTotais || 0;
    });

    // As taxas são recalculadas sobre o efetivo somado — média de percentuais
    // de unidades com tamanhos diferentes daria um número que não existe.
    return [...porMes.values()].map(m => ({
      ...m,
      turnoverTotal: m.totalFuncionarios > 0
        ? Number(((((m.totalAdmissao + m.saidasTotais) / 2) / m.totalFuncionarios) * 100).toFixed(2)) : 0,
      turnoverVoluntario: m.totalFuncionarios > 0
        ? Number(((m.pediramSair / m.totalFuncionarios) * 100).toFixed(2)) : 0,
      turnoverInvoluntario: m.totalFuncionarios > 0
        ? Number(((m.foramDesligados / m.totalFuncionarios) * 100).toFixed(2)) : 0,
    }));
  }, [computedData, unidadesSel]);

  // General Average KPI
  const avgStats = useMemo(() => {
    if (computedData.length === 0) return { total: 0, voluntario: 0, involuntario: 0 };
    
    const sumTotal = computedData.reduce((acc, curr) => acc + curr.turnoverTotal, 0);
    const sumVol = computedData.reduce((acc, curr) => acc + curr.turnoverVoluntario, 0);
    const sumInvol = computedData.reduce((acc, curr) => acc + curr.turnoverInvoluntario, 0);
    
    return {
      total: sumTotal / computedData.length,
      voluntario: sumVol / computedData.length,
      involuntario: sumInvol / computedData.length
    };
  }, [computedData]);

  const ordemMes = (m?: string) => {
    const p = /^(\d{2})\/(\d{4})$/.exec((m || '').trim());
    return p ? Number(p[2]) * 12 + Number(p[1]) : -Infinity;
  };

  /**
   * Último mês lançado ANTES do escolhido, na mesma unidade — a base do efetivo.
   * Compara pelo `mesAno`, não pela posição no array (a ordem do onSnapshot não
   * é cronológica). Editando, ignora o próprio registro.
   */
  const mesBase = useMemo(() => {
    if (!mes || !ano) return null;
    const alvo = ordemMes(`${mes}/${ano}`);
    return turnover
      .filter(t => t.id !== editingTurnover?.id)
      .filter(t => (t.unidade || '') === unidade)
      .filter(t => ordemMes(t.mesAno) < alvo)
      .sort((a, b) => ordemMes(a.mesAno) - ordemMes(b.mesAno))
      .pop() || null;
  }, [turnover, mes, ano, unidade, editingTurnover]);

  /** Efetivo do mês anterior + entradas − saídas. */
  const efetivoCalculado = mesBase
    ? (mesBase.totalFuncionarios || 0) + totalAdmissao - pediramSair - foramDesligados
    : null;

  // Enquanto o campo não for tocado à mão, ele acompanha a conta.
  useEffect(() => {
    if (efetivoManual || efetivoCalculado === null) return;
    setTotalFuncionarios(Math.max(0, efetivoCalculado));
  }, [efetivoCalculado, efetivoManual]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!mes || !ano) {
      setErrorMsg("Escolha o mês e o ano.");
      return;
    }

    const cleanMesAno = `${mes}/${ano}`;

    const payload = {
      mesAno: cleanMesAno,
      totalFuncionarios: Number(totalFuncionarios) || 0,
      totalAdmissao: Number(totalAdmissao) || 0,
      pediramSair: Number(pediramSair) || 0,
      foramDesligados: Number(foramDesligados) || 0,
      // Só grava a unidade quando escolhida: ausência significa consolidado, e
      // gravar '' faria o registro parecer "sem unidade por engano".
      ...(unidade ? { unidade } : {})
    };

    try {
      if (editingTurnover) {
        await updateTurnover(editingTurnover.id, payload);
      } else {
        await addTurnover(payload);
      }
      resetForm();
      setShowAddForm(false);
    } catch (err: any) {
      setErrorMsg('Erro ao salvar. Verifique a conexão e tente novamente.' + (err?.message ? ` (${err.message})` : ''));
    }
  };

  const handleExportTurnover = async () => {
    if (!computedData.length) { alert('Nenhum mês para exportar.'); return; }
    const columns = [
      { title: 'Mês/Ano', width: 12 },
      { title: 'Unidade', width: 16 },
      { title: 'Total Funcionários', width: 18 },
      { title: 'Admissões', width: 14 },
      { title: 'Pediram p/ Sair', width: 16 },
      { title: 'Desligados', width: 14 },
      { title: 'Saídas Totais', width: 14 },
      { title: 'Turnover Total (%)', width: 18 },
      { title: 'Turnover Voluntário (%)', width: 22 },
      { title: 'Turnover Involuntário (%)', width: 24 }
    ];
    const rows = computedData.map(t => [
      { type: String, value: t.mesAno || null },
      { type: String, value: rotuloUnidade(t.unidade) },
      { type: Number, value: t.totalFuncionarios ?? null },
      { type: Number, value: t.totalAdmissao ?? null },
      { type: Number, value: t.pediramSair ?? null },
      { type: Number, value: t.foramDesligados ?? null },
      { type: Number, value: t.saidasTotais ?? null },
      { type: Number, value: t.turnoverTotal ?? null },
      { type: Number, value: t.turnoverVoluntario ?? null },
      { type: Number, value: t.turnoverInvoluntario ?? null }
    ]);
    try {
      await exportToXlsx(`relatorio_turnover_${new Date().toISOString().slice(0, 10)}.xlsx`, columns, rows, { sheet: 'Turnover' });
    } catch (err) {
      console.error('Erro ao exportar XLSX:', err);
      alert('Não foi possível gerar o arquivo Excel. Tente novamente.');
    }
  };

  const fecharForm = () => { resetForm(); setShowAddForm(false); };
  const excluir = (item: Turnover) => {
    if (confirmAction) {
      confirmAction('Excluir mês', `Remover o lançamento de ${item.mesAno} (${rotuloUnidade(item.unidade)})? As médias da tela são recalculadas.`, () => deleteTurnover(item.id));
    } else if (confirm(`Remover permanentemente os logs do mês ${item.mesAno}?`)) {
      deleteTurnover(item.id);
    }
  };
  /** Entrou, pediu para sair, foi desligado: as mesmas cores no gráfico e na tabela. */
  const COR = { entrou: 'var(--etapa-admissao)', pediu: 'var(--etapa-triagem)', desligado: 'var(--atraso)' };

  return (
    <div className="space-y-5">
      <header className="pagina-cab">
        <div className="min-w-0">
          <p className="pagina-trilha">Pessoas</p>
          <h1 className="pagina-titulo">Turnover</h1>
          <p className="inicio-sub">Quem entrou, quem pediu para sair e quem foi desligado, mês a mês.</p>
        </div>
        <div className="pagina-acoes">
          {temUnidadeLancada && (
            <FiltroMultiplo rotulo="Unidade" todos="todas" selecionados={unidadesSel} onChange={setUnidadesSel}
              opcoes={[{ valor: 'colegio', rotulo: 'Colégio' }, { valor: 'universidade', rotulo: 'Universidade' }, { valor: 'consolidado', rotulo: 'Consolidado (sem unidade)' }]} />
          )}
          <button type="button" className="btn" onClick={handleExportTurnover} title="Baixar planilha Excel (.xlsx)">
            <Download aria-hidden="true" /> Exportar
          </button>
          {canManage && (
            <button type="button" className="btn btn-primario" onClick={openCreateForm}>
              <Plus aria-hidden="true" /> Lançar mês
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi rotulo="Turnover médio" valor={`${dec(avgStats.total)}%`} detalhe="(admissões + saídas) ÷ 2 ÷ efetivo" />
        <Kpi rotulo="Voluntário médio" valor={`${dec(avgStats.voluntario)}%`} detalhe="pediram para sair" />
        <Kpi rotulo="Involuntário médio" valor={`${dec(avgStats.involuntario)}%`} detalhe="desligados pela empresa" />
      </div>

      {dadosGrafico.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Painel titulo="Turnover mês a mês" descricao="Total e voluntário, em %.">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={dadosGrafico} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} {...grade} />
                  <XAxis dataKey="mesAno" {...eixo} />
                  <YAxis {...eixo} />
                  <Tooltip cursor={cursorLinha} content={<Dica formatar={(v: number) => `${dec(v, 2)}%`} />} />
                  <Legend {...legenda} />
                  <Line isAnimationActive={false} type="monotone" name="Turnover total" dataKey="turnoverTotal" stroke={C.primary} strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line isAnimationActive={false} type="monotone" name="Voluntário" dataKey="turnoverVoluntario" stroke={COR.pediu} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Painel>

          {/* Movimentação mês a mês. As saídas vêm SEPARADAS (pediu sair x foi
              desligado): somadas numa barra só, escondiam a única metade sobre a
              qual o RH consegue agir — quem pede para sair. Pedido do RH em
              31/08/2026, para acompanhar a evolução de janeiro em diante. */}
          <Painel titulo="Movimentação do quadro" descricao="Quem entrou, quem pediu para sair e quem foi desligado.">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={dadosGrafico} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barGap={2}>
                  <CartesianGrid vertical={false} {...grade} />
                  <XAxis dataKey="mesAno" {...eixo} />
                  <YAxis {...eixo} allowDecimals={false} />
                  <Tooltip cursor={cursorBarra} content={<Dica />} />
                  <Legend {...legenda} iconType="square" />
                  <Bar isAnimationActive={false} name="Admissões" dataKey="totalAdmissao" fill={COR.entrou} radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Bar isAnimationActive={false} name="Pediram para sair" dataKey="pediramSair" fill={COR.pediu} radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Bar isAnimationActive={false} name="Foram desligados" dataKey="foramDesligados" fill={COR.desligado} radius={[3, 3, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Painel>
        </div>
      )}

      <section className="painel overflow-hidden" aria-label="Meses lançados">
        {computedData.length === 0 ? (
          <p className="text-center py-12 text-[14px]" style={{ color: 'var(--tinta-3)' }}>Nenhum mês lançado.</p>
        ) : (
          // Sem rolagem de lado (regra de 08/10/2026): em tela estreita, cartão.
          <table className="tabela tabela-empilha">
            <thead>
              <tr>
                <th scope="col">Mês</th>
                <th scope="col" className="num-col">Efetivo</th>
                <th scope="col" className="num-col">Entraram</th>
                <th scope="col" className="num-col">Pediram para sair</th>
                <th scope="col" className="num-col">Desligados</th>
                <th scope="col" className="num-col">Turnover</th>
                {canManage && <th scope="col"><span className="sr-only">Ações</span></th>}
              </tr>
            </thead>
            <tbody>
              {computedData.map((item) => (
                <tr key={item.id}>
                  <td className="whitespace-nowrap">
                    <span>
                      <b>{item.mesAno}</b>
                      {temUnidadeLancada && <span className="sub">{rotuloUnidade(item.unidade)}</span>}
                    </span>
                  </td>
                  <td className="num-col" data-rotulo="Efetivo">{item.totalFuncionarios.toLocaleString('pt-BR')}</td>
                  <td className="num-col" data-rotulo="Entraram" style={{ color: COR.entrou }}>+{item.totalAdmissao}</td>
                  <td className="num-col" data-rotulo="Pediram para sair" style={{ color: COR.pediu }}>−{item.pediramSair}</td>
                  <td className="num-col" data-rotulo="Desligados" style={{ color: COR.desligado }}>−{item.foramDesligados}</td>
                  <td className="num-col" data-rotulo="Turnover">
                    <span>
                      <b>{dec(item.turnoverTotal, 2)}%</b>
                      <span className="sub">vol. {dec(item.turnoverVoluntario, 2)}% · invol. {dec(item.turnoverInvoluntario, 2)}%</span>
                    </span>
                  </td>
                  {canManage && (
                    <td className="text-right whitespace-nowrap">
                      <span className="inline-flex gap-1.5">
                        <button type="button" className="btn btn-sm" onClick={() => openEditForm(item)}>Editar</button>
                        <button type="button" className="btn btn-sm btn-perigo" onClick={() => excluir(item)} aria-label={`Excluir ${item.mesAno}`}><Trash2 aria-hidden="true" /></button>
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {showAddForm && (
        <Modal
          titulo={editingTurnover ? `Editar ${editingTurnover.mesAno}` : 'Lançar mês'}
          antes="Turnover"
          largura="sm"
          aoFechar={fecharForm}
          rodape={<>
            <button type="button" className="btn" onClick={fecharForm}>Cancelar</button>
            <button type="submit" form="form-turnover" className="btn btn-primario">{editingTurnover ? 'Salvar alterações' : 'Lançar'}</button>
          </>}
        >
          <form id="form-turnover" onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && <p role="alert" className="erro-form">{errorMsg}</p>}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="rotulo">Mês *</span>
                <select required className="campo w-full capitalize" value={mes} onChange={(e) => setMes(e.target.value)}>
                  <option value="">Escolha…</option>
                  {MESES.map((nome, i) => <option key={nome} value={String(i + 1).padStart(2, '0')}>{nome}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="rotulo">Ano *</span>
                <select required className="campo w-full" value={ano} onChange={(e) => setAno(e.target.value)}>
                  <option value="">Escolha…</option>
                  {anosDisponiveis.map(a => <option key={a} value={String(a)}>{a}</option>)}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="rotulo">Unidade</span>
              <select className="campo w-full" value={unidade} onChange={(e) => setUnidade(e.target.value as '' | 'colegio' | 'universidade')}>
                <option value="">Consolidado (as duas unidades juntas)</option>
                <option value="colegio">Colégio</option>
                <option value="universidade">Universidade</option>
              </select>
              <span className="ajuda block">Para acompanhar separado, lance dois registros no mesmo mês, um de cada unidade.</span>
            </label>

            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <span className="rotulo">Admissões</span>
                <input type="number" min={0} className="campo w-full tabular-nums" value={totalAdmissao} onChange={(e) => setTotalAdmissao(Number(e.target.value))} />
              </label>
              <label className="block">
                <span className="rotulo">Pediram para sair</span>
                <input type="number" min={0} className="campo w-full tabular-nums" value={pediramSair} onChange={(e) => setPediramSair(Number(e.target.value))} />
              </label>
              <label className="block">
                <span className="rotulo">Desligados</span>
                <input type="number" min={0} className="campo w-full tabular-nums" value={foramDesligados} onChange={(e) => setForamDesligados(Number(e.target.value))} />
              </label>
            </div>

            {/* Efetivo vem DEPOIS da movimentação porque é calculado a partir
                dela — e continua editável: a conta não sabe de transferência
                entre unidades nem de correção de cadastro. */}
            <label className="block">
              <span className="rotulo">Efetivo no último dia do mês</span>
              <input type="number" min={0} className="campo w-full tabular-nums" value={totalFuncionarios}
                onChange={(e) => { setEfetivoManual(true); setTotalFuncionarios(Number(e.target.value)); }} />
              {mesBase ? (
                <span className="ajuda block">
                  {mesBase.totalFuncionarios} em {mesBase.mesAno} + {totalAdmissao} admissões − {pediramSair + foramDesligados} saídas = <b style={{ color: 'var(--tinta)' }}>{efetivoCalculado}</b>
                  {efetivoManual && totalFuncionarios !== efetivoCalculado && (
                    <>
                      {' · '}
                      <button type="button" className="btn-texto underline"
                        onClick={() => { setEfetivoManual(false); setTotalFuncionarios(Math.max(0, efetivoCalculado ?? 0)); }}>
                        usar a conta
                      </button>
                    </>
                  )}
                </span>
              ) : (
                <span className="ajuda block">Sem mês anterior lançado nesta unidade: informe o efetivo.</span>
              )}
            </label>
          </form>
        </Modal>
      )}
    </div>
  );
};
