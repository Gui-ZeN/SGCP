/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Entrevista } from '../types';
import { MOTIVOS_SAIDA } from '../constants/hr';
import { toISOInput, formatDateBR } from '../utils/date';
import { exportToXlsx } from '../utils/xlsxExporter';
import { Search, Plus, Star, Trash2, Pencil, Download, Link2, Check } from 'lucide-react';
import { Modal } from './ui/Modal';
import { FiltroMultiplo } from './ui/FiltroMultiplo';
import { Kpi } from './indicadores/ui';

const StarRatingInput = ({ value, onChange, label }: { value: number, onChange: (val: number) => void, label: string }) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue = hoverValue !== null ? hoverValue : value;

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13.5px]" style={{ color: 'var(--tinta-2)' }}>{label}</span>
      <div
        className="flex items-center gap-1.5"
        onMouseLeave={() => setHoverValue(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const isFull = displayValue >= star;
          const isHalf = displayValue >= star - 0.5 && displayValue < star;

          return (
            <div
              key={star}
              className="relative cursor-pointer transition-transform ease-out hover:scale-110 active:scale-95"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const isLeftHalf = e.clientX - rect.left < rect.width / 2;
                setHoverValue(star - (isLeftHalf ? 0.5 : 0));
              }}
              onClick={() => {
                if (hoverValue !== null) {
                  onChange(hoverValue);
                }
              }}
            >
              <Star className="w-6 h-6 text-slate-200 fill-slate-100" />
              {(isFull || isHalf) && (
                <div
                  className="absolute top-0 left-0 overflow-hidden pointer-events-none"
                  style={{ width: isHalf ? '50%' : '100%' }}
                >
                  <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface EntrevistasSectionProps {
  entrevistas: Entrevista[];
  addEntrevista: (input: Omit<Entrevista, 'id' | 'codigo'>) => Promise<void>;
  updateEntrevista: (id: string, updatedFields: Partial<Entrevista>) => Promise<void>;
  deleteEntrevista: (id: string) => Promise<void>;
  confirmAction?: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
  userSede?: string;
  isAdmin?: boolean;
  canManage?: boolean;
}

export const EntrevistasSection: React.FC<EntrevistasSectionProps> = ({
  entrevistas,
  addEntrevista,
  updateEntrevista,
  deleteEntrevista,
  confirmAction,
  userSede,
  isAdmin = false,
  canManage = true
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  // Todo filtro é de múltipla escolha (regra de 08/10/2026); nada marcado = todos.
  const [unidadesSel, setUnidadesSel] = useState<string[]>([]);
  const [motivosSel, setMotivosSel] = useState<string[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<Entrevista | null>(null);
  const [editingEntrevista, setEditingEntrevista] = useState<Entrevista | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // New interview registration
  const [colaborador, setColaborador] = useState('');
  const [dataEntrevista, setDataEntrevista] = useState('');
  const [funcao, setFuncao] = useState('');
  const [unidade, setUnidade] = useState('DT');
  const [admissao, setAdmissao] = useState('');
  const [desligamento, setDesligamento] = useState('');
  const [motivoSaida, setMotivoSaida] = useState('Melhor proposta salarial no mercado');
  const [motivoSaidaOutro, setMotivoSaidaOutro] = useState('');
  const [gostavaTrabalho, setGostavaTrabalho] = useState<'Sim' | 'Não' | 'Parcialmente'>('Sim');
  const [oqMaisGostava, setOqMaisGostava] = useState('');
  const [oqMenosGostava, setOqMenosGostava] = useState('');
  const [notaSalario, setNotaSalario] = useState(3);
  const [notaTreinamento, setNotaTreinamento] = useState(3);
  const [notaCrescimento, setNotaCrescimento] = useState(3);
  const [notaRelacionamentoColegas, setNotaRelacionamentoColegas] = useState(4);
  const [notaRelacionamentoChefia, setNotaRelacionamentoChefia] = useState(4);
  const [notaClimaOrg, setNotaClimaOrg] = useState(4);
  const [voltaria, setVoltaria] = useState<'Sim' | 'Não' | 'Talvez'>('Sim');
  const [sugestoes, setSugestoes] = useState('');
  const [entrevistador, setEntrevistador] = useState('');

  // Secure relevant interviews list restricted by Sede for non-admins
  const relevantEntrevistas = useMemo(() => {
    if (!isAdmin && userSede) {
      return entrevistas.filter(e => e.unidade && e.unidade.toLowerCase() === userSede.toLowerCase());
    }
    return entrevistas;
  }, [entrevistas, isAdmin, userSede]);

  // Stats
  const stats = useMemo(() => {
    // A média considera apenas QUEM RESPONDEU aquela nota. Dividir pelo total de
    // fichas contaria "não respondeu" (0) como avaliação péssima e derrubava o
    // indicador — visível desde que o formulário público permite pular notas.
    const media = (pegar: (e: Entrevista) => number) => {
      const notas = relevantEntrevistas.map(pegar).filter(n => n > 0);
      return notas.length ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1).replace('.', ',') : '—';
    };
    const totalSimVoltaria = relevantEntrevistas.filter(e => e.voltaria === 'Sim').length;
    const count = relevantEntrevistas.length || 1;

    return {
      climaMedio: media(e => e.notaClimaOrg || 0),
      salarioMedio: media(e => e.notaSalario || 0),
      crescimentoMedio: media(e => e.notaCrescimento || 0),
      retornoPct: Math.round((totalSimVoltaria / count) * 100),
      totalEntrevistadas: relevantEntrevistas.length
    };
  }, [relevantEntrevistas]);

  // Options
  const motivoOptions = MOTIVOS_SAIDA;

  const dateToInput = (value?: string) => toISOInput(value);

  const resetForm = () => {
    setColaborador('');
    setDataEntrevista('');
    setFuncao('');
    setUnidade(userSede || 'DT');
    setAdmissao('');
    setDesligamento('');
    setMotivoSaida('Melhor proposta salarial no mercado');
    setMotivoSaidaOutro('');
    setGostavaTrabalho('Sim');
    setOqMaisGostava('');
    setOqMenosGostava('');
    setNotaSalario(3);
    setNotaTreinamento(3);
    setNotaCrescimento(3);
    setNotaRelacionamentoColegas(4);
    setNotaRelacionamentoChefia(4);
    setNotaClimaOrg(4);
    setVoltaria('Sim');
    setSugestoes('');
    setEntrevistador('');
    setEditingEntrevista(null);
    setErrorMsg('');
  };

  const openCreateForm = () => {
    resetForm();
    setShowAddForm(true);
  };

  const openEditForm = (entrevista: Entrevista) => {
    setEditingEntrevista(entrevista);
    setColaborador(entrevista.colaborador || '');
    setDataEntrevista(dateToInput(entrevista.dataEntrevista));
    setFuncao(entrevista.funcao || '');
    setUnidade(entrevista.unidade || userSede || 'DT');
    setAdmissao(dateToInput(entrevista.admissao));
    setDesligamento(dateToInput(entrevista.desligamento));
    setMotivoSaida(motivoOptions.includes(entrevista.motivoSaida) ? entrevista.motivoSaida : 'Outros');
    setMotivoSaidaOutro(motivoOptions.includes(entrevista.motivoSaida) ? '' : entrevista.motivoSaida || '');
    setGostavaTrabalho(entrevista.gostavaTrabalho || 'Sim');
    setOqMaisGostava(entrevista.oqMaisGostava || '');
    setOqMenosGostava(entrevista.oqMenosGostava || '');
    setNotaSalario(entrevista.notaSalario || 3);
    setNotaTreinamento(entrevista.notaTreinamento || 3);
    setNotaCrescimento(entrevista.notaCrescimento || 3);
    setNotaRelacionamentoColegas(entrevista.notaRelacionamentoColegas || 4);
    setNotaRelacionamentoChefia(entrevista.notaRelacionamentoChefia || 4);
    setNotaClimaOrg(entrevista.notaClimaOrg || 4);
    setVoltaria(entrevista.voltaria || 'Sim');
    setSugestoes(entrevista.sugestoes || '');
    setEntrevistador(entrevista.entrevistador || '');
    setErrorMsg('');
    setViewingRecord(null);
    setShowAddForm(true);
  };

  /** "Outros: mudou de cidade" conta como "Outros" no filtro. */
  const motivoBase = (m?: string) => (m || '').startsWith('Outros') ? 'Outros' : (m || 'Não informado');
  const opcoesUnidade = useMemo(() => [...new Set(relevantEntrevistas.map(e => e.unidade).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR')).map(u => ({ valor: u, rotulo: u })), [relevantEntrevistas]);
  const opcoesMotivo = useMemo(() => [...new Set(relevantEntrevistas.map(e => motivoBase(e.motivoSaida)))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR')).map(m => ({ valor: m, rotulo: m })), [relevantEntrevistas]);

  const filteredList = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase();
    return relevantEntrevistas.filter(e =>
      (!unidadesSel.length || unidadesSel.includes(e.unidade)) &&
      (!motivosSel.length || motivosSel.includes(motivoBase(e.motivoSaida))) &&
      (!termo ||
        e.colaborador.toLowerCase().includes(termo) ||
        e.funcao.toLowerCase().includes(termo) ||
        e.motivoSaida.toLowerCase().includes(termo)));
  }, [relevantEntrevistas, searchTerm, unidadesSel, motivosSel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!colaborador.trim() || !funcao.trim() || !dataEntrevista.trim()) {
      setErrorMsg("Por favor, preencha Colaborador, Função e Data da Entrevista.");
      return;
    }

    // Converte as datas dos inputs (ISO) para o formato BR usado no domínio.
    const formattedInterview = formatDateBR(dataEntrevista);
    const formattedAdm = formatDateBR(admissao);
    const formattedDes = formatDateBR(desligamento);

    const finalMotivo = motivoSaida === 'Outros' && motivoSaidaOutro.trim()
      ? `Outros: ${motivoSaidaOutro.trim()}`
      : motivoSaida;

    const payload = {
      colaborador,
      dataEntrevista: formattedInterview,
      funcao,
      unidade,
      admissao: formattedAdm || undefined,
      desligamento: formattedDes || undefined,
      motivoSaida: finalMotivo,
      gostavaTrabalho,
      oqMaisGostava: oqMaisGostava || undefined,
      oqMenosGostava: oqMenosGostava || undefined,
      notaSalario,
      notaTreinamento,
      notaCrescimento,
      notaRelacionamentoColegas,
      notaRelacionamentoChefia,
      notaClimaOrg,
      voltaria,
      sugestoes: sugestoes || undefined,
      entrevistador: entrevistador || 'RH'
    };

    try {
      if (editingEntrevista) {
        await updateEntrevista(editingEntrevista.id, payload);
      } else {
        await addEntrevista(payload);
      }
      resetForm();
      setShowAddForm(false);
    } catch (err: any) {
      setErrorMsg('Erro ao salvar. Verifique a conexão e tente novamente.' + (err?.message ? ` (${err.message})` : ''));
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFull = rating >= star;
          const isHalf = rating >= star - 0.5 && rating < star;
          return (
            <div key={star} className="relative">
              <Star className="w-3.5 h-3.5 text-slate-200 fill-slate-100" />
              {(isFull || isHalf) && (
                <div
                  className="absolute top-0 left-0 overflow-hidden pointer-events-none"
                  style={{ width: isHalf ? '50%' : '100%' }}
                >
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const handleExportEntrevistas = async () => {
    if (!filteredList.length) { alert('Nenhuma entrevista para exportar.'); return; }
    const columns = [
      { title: 'Código', width: 10 },
      { title: 'Colaborador', width: 26 },
      { title: 'Data Entrevista', width: 16 },
      { title: 'Função', width: 22 },
      { title: 'Unidade', width: 18 },
      { title: 'Admissão', width: 14 },
      { title: 'Desligamento', width: 14 },
      { title: 'Motivo da Saída', width: 30 },
      { title: 'Gostava do Trabalho', width: 18 },
      { title: 'Nota Salário', width: 12 },
      { title: 'Nota Treinamento', width: 14 },
      { title: 'Nota Crescimento', width: 14 },
      { title: 'Nota Rel. Colegas', width: 16 },
      { title: 'Nota Rel. Chefia', width: 16 },
      { title: 'Nota Clima Org.', width: 14 },
      { title: 'Voltaria', width: 12 },
      { title: 'Sugestões', width: 40 },
      { title: 'Entrevistador', width: 22 }
    ];
    const rows = filteredList.map(e => [
      { type: Number, value: e.codigo ?? null },
      { type: String, value: e.colaborador || null },
      { type: String, value: e.dataEntrevista || null },
      { type: String, value: e.funcao || null },
      { type: String, value: e.unidade || null },
      { type: String, value: e.admissao || null },
      { type: String, value: e.desligamento || null },
      { type: String, value: e.motivoSaida || null },
      { type: String, value: e.gostavaTrabalho || null },
      { type: Number, value: e.notaSalario ?? null },
      { type: Number, value: e.notaTreinamento ?? null },
      { type: Number, value: e.notaCrescimento ?? null },
      { type: Number, value: e.notaRelacionamentoColegas ?? null },
      { type: Number, value: e.notaRelacionamentoChefia ?? null },
      { type: Number, value: e.notaClimaOrg ?? null },
      { type: String, value: e.voltaria || null },
      { type: String, value: e.sugestoes || null },
      { type: String, value: e.entrevistador || null }
    ]);
    try {
      await exportToXlsx(`relatorio_entrevistas_desligamento_${new Date().toISOString().slice(0, 10)}.xlsx`, columns, rows, { sheet: 'Entrevistas' });
    } catch (err) {
      console.error('Erro ao exportar XLSX:', err);
      alert('Não foi possível gerar o arquivo Excel. Tente novamente.');
    }
  };

  // Link do formulário público — o RH manda para quem está saindo responder
  // sozinho, sem login. Cai direto nesta lista (origem: 'form-publico').
  const [linkCopiado, setLinkCopiado] = useState(false);
  const linkForm = (typeof window !== 'undefined' ? window.location.origin : '') + '/entrevista';
  const copiarLinkForm = async () => {
    try {
      await navigator.clipboard.writeText(linkForm);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = linkForm; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove();
    }
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2000);
  };

  const fecharForm = () => { resetForm(); setShowAddForm(false); };
  const quemRespondeu = (e: Entrevista) =>
    e.anonima ? 'Anônima' : e.origem === 'form-publico' ? 'Pelo próprio colaborador' : `RH · ${e.entrevistador || 'RH'}`;
  const corDaResposta = (r?: string) =>
    r === 'Sim' ? 'var(--etapa-admissao)' : r === 'Não' ? 'var(--atraso)' : 'var(--etapa-triagem)';
  const nota = (n?: number) => (n ? n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—');
  const excluir = (e: Entrevista) => {
    if (confirmAction) {
      confirmAction('Excluir entrevista', `Remover a entrevista de "${e.colaborador}"? As respostas não podem ser recuperadas.`, () => deleteEntrevista(e.id));
    } else if (confirm(`Remover definitivamente o registro de entrevista de ${e.colaborador}?`)) {
      deleteEntrevista(e.id);
    }
  };

  return (
    <div className="space-y-5">
      <header className="pagina-cab">
        <div className="min-w-0">
          <p className="pagina-trilha">Pessoas</p>
          <h1 className="pagina-titulo">Entrevistas de desligamento</h1>
          <p className="inicio-sub">Por que as pessoas saem, o que diriam do clima e se voltariam.</p>
        </div>
        <div className="pagina-acoes">
          <button type="button" className="btn" onClick={handleExportEntrevistas} title="Baixar planilha Excel (.xlsx)">
            <Download aria-hidden="true" /> Exportar
          </button>
          {canManage && (
            <button type="button" className="btn" onClick={copiarLinkForm} title={linkForm}>
              {linkCopiado ? <><Check aria-hidden="true" /> Link copiado</> : <><Link2 aria-hidden="true" /> Link do formulário</>}
            </button>
          )}
          {canManage && (
            <button type="button" className="btn btn-primario" onClick={openCreateForm}>
              <Plus aria-hidden="true" /> Registrar entrevista
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi rotulo="Clima da organização" valor={stats.climaMedio} unidade="de 5" detalhe={`média de ${stats.totalEntrevistadas} entrevistas`} />
        <Kpi rotulo="Salário" valor={stats.salarioMedio} unidade="de 5" />
        <Kpi rotulo="Crescimento" valor={stats.crescimentoMedio} unidade="de 5" />
        <Kpi rotulo="Voltariam a trabalhar" valor={`${stats.retornoPct}%`} detalhe="responderam Sim"
          tom={stats.retornoPct >= 60 ? 'bom' : stats.retornoPct >= 40 ? 'atencao' : 'critico'} />
      </div>

      {/* Todo filtro é de múltipla escolha (regra de 08/10/2026). */}
      <div className="filtros">
        {opcoesUnidade.length > 1 && (
          <FiltroMultiplo rotulo="Unidade" opcoes={opcoesUnidade} selecionados={unidadesSel} onChange={setUnidadesSel} todos="todas" />
        )}
        <FiltroMultiplo rotulo="Motivo" opcoes={opcoesMotivo} selecionados={motivosSel} onChange={setMotivosSel} />
        <label className="campo-busca">
          <Search aria-hidden="true" />
          <input type="search" className="campo" placeholder="Buscar nome, função ou motivo" aria-label="Buscar nome, função ou motivo"
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </label>
      </div>

      <section className="painel overflow-hidden" aria-label="Entrevistas">
        {filteredList.length === 0 ? (
          <p className="text-center py-12 text-[14px]" style={{ color: 'var(--tinta-3)' }}>Nenhuma entrevista com esses filtros.</p>
        ) : (
          // Sem rolagem de lado (regra de 08/10/2026): em tela estreita, cartão.
          <table className="tabela tabela-empilha">
            <thead>
              <tr>
                <th scope="col">Quem saiu</th>
                <th scope="col">Entrevista</th>
                <th scope="col">Motivo</th>
                <th scope="col" className="num-col">Clima</th>
                <th scope="col">Voltaria?</th>
                <th scope="col"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span>
                      <button type="button" className="font-semibold text-left hover:underline" onClick={() => setViewingRecord(e)}>{e.colaborador}</button>
                      <span className="sub">{[e.funcao, e.unidade].filter(Boolean).join(' · ')}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap" data-rotulo="Entrevista">
                    <span>{e.dataEntrevista}<span className="sub">{quemRespondeu(e)}</span></span>
                  </td>
                  <td data-rotulo="Motivo">{e.motivoSaida}</td>
                  <td className="num-col" data-rotulo="Clima">{nota(e.notaClimaOrg)}</td>
                  <td data-rotulo="Voltaria?"><b style={{ color: corDaResposta(e.voltaria) }}>{e.voltaria || '—'}</b></td>
                  <td className="text-right whitespace-nowrap">
                    <span className="inline-flex gap-1.5">
                      <button type="button" className="btn btn-sm" onClick={() => setViewingRecord(e)}>Ver</button>
                      {canManage && <button type="button" className="btn btn-sm" onClick={() => openEditForm(e)}>Editar</button>}
                      {canManage && <button type="button" className="btn btn-sm btn-perigo" onClick={() => excluir(e)} aria-label={`Excluir entrevista de ${e.colaborador}`}><Trash2 aria-hidden="true" /></button>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {viewingRecord && (
        <Modal
          titulo={viewingRecord.colaborador}
          antes={<>Entrevista nº {viewingRecord.codigo} · {viewingRecord.dataEntrevista}</>}
          aoFechar={() => setViewingRecord(null)}
          rodape={canManage ? <>
            <button type="button" className="btn" onClick={() => setViewingRecord(null)}>Fechar</button>
            <button type="button" className="btn btn-primario" onClick={() => openEditForm(viewingRecord)}><Pencil aria-hidden="true" /> Editar</button>
          </> : undefined}
        >
          <section className="secao">
            <dl className="ficha">
              <div><dt>Função</dt><dd>{viewingRecord.funcao || '—'}</dd></div>
              <div><dt>Unidade</dt><dd>{viewingRecord.unidade || '—'}</dd></div>
              <div><dt>Admissão</dt><dd>{viewingRecord.admissao || 'não informada'}</dd></div>
              <div><dt>Desligamento</dt><dd>{viewingRecord.desligamento || 'não informado'}</dd></div>
              <div className="larga"><dt>Por que está saindo</dt><dd>{viewingRecord.motivoSaida}</dd></div>
              <div><dt>Gostava do trabalho?</dt><dd style={{ color: corDaResposta(viewingRecord.gostavaTrabalho) }}>{viewingRecord.gostavaTrabalho}</dd></div>
              <div><dt>Voltaria a trabalhar conosco?</dt><dd style={{ color: corDaResposta(viewingRecord.voltaria) }}>{viewingRecord.voltaria}</dd></div>
              <div className="larga"><dt>Quem respondeu</dt><dd>{quemRespondeu(viewingRecord)}</dd></div>
            </dl>
          </section>
          <section className="secao">
            <h3 className="secao-titulo">Notas <small>de 1 a 5</small></h3>
            <dl className="ficha">
              {([
                ['Salário', viewingRecord.notaSalario],
                ['Treinamentos', viewingRecord.notaTreinamento],
                ['Crescimento', viewingRecord.notaCrescimento],
                ['Colegas', viewingRecord.notaRelacionamentoColegas],
                ['Chefia', viewingRecord.notaRelacionamentoChefia],
                ['Clima da organização', viewingRecord.notaClimaOrg],
              ] as const).map(([r, n]) => (
                <div key={r} className="flex items-center justify-between gap-3">
                  <dt>{r}</dt>
                  <dd className="flex items-center gap-2 m-0">{renderStars(n)}<span className="tabular-nums w-6 text-right">{nota(n)}</span></dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="secao">
            <h3 className="secao-titulo">Nas palavras de quem saiu</h3>
            <dl className="ficha">
              <div className="larga"><dt>O que mais gostava</dt><dd className="font-medium">{viewingRecord.oqMaisGostava || '—'}</dd></div>
              <div className="larga"><dt>O que menos gostava</dt><dd className="font-medium">{viewingRecord.oqMenosGostava || '—'}</dd></div>
              <div className="larga"><dt>Sugestões</dt><dd className="font-medium">{viewingRecord.sugestoes || '—'}</dd></div>
            </dl>
          </section>
        </Modal>
      )}

      {showAddForm && (
        <Modal
          titulo={editingEntrevista ? 'Editar entrevista' : 'Registrar entrevista'}
          antes={editingEntrevista ? <>nº {editingEntrevista.codigo}</> : 'Entrevista de desligamento'}
          largura="lg"
          aoFechar={fecharForm}
          rodape={<>
            <button type="button" className="btn" onClick={fecharForm}>Cancelar</button>
            <button type="submit" form="form-entrevista" className="btn btn-primario">{editingEntrevista ? 'Salvar alterações' : 'Registrar'}</button>
          </>}
        >
          <form id="form-entrevista" onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && <p role="alert" className="erro-form">{errorMsg}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block sm:col-span-2">
                <span className="rotulo">Nome de quem saiu *</span>
                <input type="text" required className="campo w-full" value={colaborador} onChange={(e) => setColaborador(e.target.value)} />
              </label>
              <label className="block">
                <span className="rotulo">Data da entrevista *</span>
                <input type="date" required className="campo w-full" value={dataEntrevista} onChange={(e) => setDataEntrevista(e.target.value)} />
              </label>
              <label className="block">
                <span className="rotulo">Função *</span>
                <input type="text" required className="campo w-full" value={funcao} onChange={(e) => setFuncao(e.target.value)} />
              </label>
              <label className="block">
                <span className="rotulo">Admissão</span>
                <input type="date" className="campo w-full" value={admissao} onChange={(e) => setAdmissao(e.target.value)} />
              </label>
              <label className="block">
                <span className="rotulo">Desligamento</span>
                <input type="date" className="campo w-full" value={desligamento} onChange={(e) => setDesligamento(e.target.value)} />
              </label>
              <label className="block">
                <span className="rotulo">Unidade</span>
                <input type="text" className="campo w-full" value={unidade} onChange={(e) => setUnidade(e.target.value)} />
              </label>
              <label className="block sm:col-span-2">
                <span className="rotulo">Entrevistador(a) no RH</span>
                <input type="text" className="campo w-full" value={entrevistador} onChange={(e) => setEntrevistador(e.target.value)} />
              </label>
            </div>

            <label className="block">
              <span className="rotulo">Por que está saindo?</span>
              <select className="campo w-full" value={motivoSaida} onChange={(e) => setMotivoSaida(e.target.value)}>
                {motivoOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </label>
            {motivoSaida === 'Outros' && (
              <label className="block">
                <span className="rotulo">Qual motivo? *</span>
                <input type="text" required className="campo w-full" value={motivoSaidaOutro} onChange={(e) => setMotivoSaidaOutro(e.target.value)} />
              </label>
            )}

            <fieldset>
              <legend className="rotulo">Notas (1 a 5, 5 é ótimo)</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-1">
                <StarRatingInput label="Salário" value={notaSalario} onChange={setNotaSalario} />
                <StarRatingInput label="Treinamentos" value={notaTreinamento} onChange={setNotaTreinamento} />
                <StarRatingInput label="Oportunidades de crescimento" value={notaCrescimento} onChange={setNotaCrescimento} />
                <StarRatingInput label="Relacionamento com colegas" value={notaRelacionamentoColegas} onChange={setNotaRelacionamentoColegas} />
                <StarRatingInput label="Relacionamento com a chefia" value={notaRelacionamentoChefia} onChange={setNotaRelacionamentoChefia} />
                <StarRatingInput label="Clima da organização" value={notaClimaOrg} onChange={setNotaClimaOrg} />
              </div>
            </fieldset>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="rotulo">Gostava do trabalho?</span>
                <select className="campo w-full" value={gostavaTrabalho} onChange={(e) => setGostavaTrabalho(e.target.value as 'Sim' | 'Não' | 'Parcialmente')}>
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                  <option value="Parcialmente">Parcialmente</option>
                </select>
              </label>
              <label className="block">
                <span className="rotulo">Voltaria a trabalhar conosco?</span>
                <select className="campo w-full" value={voltaria} onChange={(e) => setVoltaria(e.target.value as 'Sim' | 'Não' | 'Talvez')}>
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                  <option value="Talvez">Talvez</option>
                </select>
              </label>
              <label className="block">
                <span className="rotulo">O que mais gostava</span>
                <input type="text" className="campo w-full" value={oqMaisGostava} onChange={(e) => setOqMaisGostava(e.target.value)} />
              </label>
              <label className="block">
                <span className="rotulo">O que menos gostava</span>
                <input type="text" className="campo w-full" value={oqMenosGostava} onChange={(e) => setOqMenosGostava(e.target.value)} />
              </label>
            </div>
            <label className="block">
              <span className="rotulo">Sugestões</span>
              <textarea rows={2} className="campo w-full" value={sugestoes} onChange={(e) => setSugestoes(e.target.value)} />
            </label>
          </form>
        </Modal>
      )}
    </div>
  );
};
