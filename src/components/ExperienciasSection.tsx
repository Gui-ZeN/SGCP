/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { LinkVaga } from './ui/Atalhos';
import { Experiencia } from '../types';
import { Sede, Setor } from '../hooks/useMetadata';
import { dateFromValue, toISOInput, formatDateBR } from '../utils/date';
import { Search, Plus, Trash2, Upload, Loader2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { FiltroMultiplo } from './ui/FiltroMultiplo';
import { Kpi } from './indicadores/ui';

interface ExperienciasSectionProps {
  /** Pessoa a mostrar, vinda de outra tela (#/experiencia?pessoa=…). O token reaplica. */
  foco?: { pessoa: string; token: number } | null;
  experiencias: Experiencia[];
  addExperiencia: (input: Omit<Experiencia, 'id' | 'termino1' | 'termino2'>) => Promise<void>;
  updateExperiencia: (id: string, updatedFields: Partial<Experiencia>) => Promise<void>;
  deleteExperiencia: (id: string) => Promise<void>;
  confirmAction?: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
  sedes?: Sede[];
  setores?: Setor[];
  userSede?: string;
  isAdmin?: boolean;
  canManage?: boolean;
  // Import da planilha "Acompanhamento do período de experiência" da Universidade
  // (botão só aparece quando o App passa o handler — Universidade ou admin).
  onImportUniversidade?: (file: File) => Promise<void>;
}

interface ReviewAlert {
  type: 'danger' | 'warning' | 'info' | 'success' | 'none';
  label: string;
  days: number;
  message: string;
}

// Date utilities (delegam para utils/date — fonte única e validada)
const parseBRDate = (str: string): Date | null => dateFromValue(str);

const getDaysDifference = (targetDateStr: string): number => {
  const target = parseBRDate(targetDateStr);
  if (!target) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const getReviewAlert = (e: Experiencia): ReviewAlert => {
  if (e.status === 'EFETIVADO' || e.status === 'ENCERRADO') {
    return { type: 'success', label: 'Concluído', days: 0, message: 'Processo concluído' };
  }

  const diff45 = getDaysDifference(e.termino1);
  const diff90 = getDaysDifference(e.termino2);

  if (e.status === 'EM_ANALISE') {
    if (diff45 < 0) {
      return {
        type: 'danger',
        label: 'Atrasado (45d)',
        days: diff45,
        message: `Avaliação de 45 dias atrasada há ${Math.abs(diff45)} ${Math.abs(diff45) === 1 ? 'dia' : 'dias'} (${e.termino1})`
      };
    } else if (diff45 === 0) {
      return {
        type: 'danger',
        label: 'Vence Hoje (45d)',
        days: 0,
        message: `Avaliação de 45 dias deve ser realizada HOJE! (${e.termino1})`
      };
    } else if (diff45 <= 7) {
      return {
        type: 'warning',
        label: 'Urgente (45d)',
        days: diff45,
        message: `Avaliação de 45 dias vence em ${diff45} ${diff45 === 1 ? 'dia' : 'dias'} (${e.termino1})`
      };
    } else if (diff45 <= 15) {
      return {
        type: 'info',
        label: 'Em breve (45d)',
        days: diff45,
        message: `Avaliação de 45 dias em ${diff45} dias (${e.termino1})`
      };
    } else {
      return {
        type: 'none',
        label: 'No prazo',
        days: diff45,
        message: `${diff45} dias restantes para avaliação de 45 dias`
      };
    }
  } else if (e.status === 'PRORROGADO') {
    if (diff90 < 0) {
      return {
        type: 'danger',
        label: 'Atrasado (90d)',
        days: diff90,
        message: `Avaliação final de 90 dias atrasada há ${Math.abs(diff90)} ${Math.abs(diff90) === 1 ? 'dia' : 'dias'} (${e.termino2})`
      };
    } else if (diff90 === 0) {
      return {
        type: 'danger',
        label: 'Vence Hoje (90d)',
        days: 0,
        message: `Avaliação final de 90 dias deve ser realizada HOJE! (${e.termino2})`
      };
    } else if (diff90 <= 7) {
      return {
        type: 'warning',
        label: 'Urgente (90d)',
        days: diff90,
        message: `Avaliação final de 90 dias vence em ${diff90} ${diff90 === 1 ? 'dia' : 'dias'} (${e.termino2})`
      };
    } else if (diff90 <= 15) {
      return {
        type: 'info',
        label: 'Em breve (90d)',
        days: diff90,
        message: `Avaliação final de 90 dias em ${diff90} dias (${e.termino2})`
      };
    } else {
      return {
        type: 'none',
        label: 'No prazo',
        days: diff90,
        message: `${diff90} dias restantes para decisão de 90 dias`
      };
    }
  }

  return { type: 'none', label: 'Válido', days: 999, message: 'Acompanhamento ativo' };
};

export const ExperienciasSection: React.FC<ExperienciasSectionProps> = ({
  foco,
  experiencias,
  addExperiencia,
  updateExperiencia,
  deleteExperiencia,
  confirmAction,
  sedes = [],
  setores = [],
  userSede,
  isAdmin = false,
  canManage = true,
  onImportUniversidade
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [importandoUni, setImportandoUni] = useState(false);
  const uniFileRef = React.useRef<HTMLInputElement>(null);
  // Rescisão a pedido (colaborador pediu demissão na experiência): data e observação.
  const [rescisaoData, setRescisaoData] = useState('');
  const [rescisaoObs, setRescisaoObs] = useState('');
  const [activeTableTab, setActiveTableTab] = useState<'ativos' | 'efetivados' | 'encerrados'>('ativos');
  // Filtros de múltipla escolha (regra de 08/10/2026); nada marcado = todos.
  // Quem não é admin fica travado na própria sede, como antes.
  const sedeTravada = !isAdmin && !!userSede;
  const [sedesSel, setSedesSel] = useState<string[]>([]);
  const [setoresSel, setSetoresSel] = useState<string[]>([]);
  /** Só quem tem avaliação vencida ou vencendo em 7 dias (substitui a antiga "Central de Avisos"). */
  const [soUrgentes, setSoUrgentes] = useState(false);

  // Veio de outra tela ("ver na Experiência", nos detalhes da vaga): busca a
  // pessoa e abre a aba onde ela está (em andamento, efetivados ou encerrados).
  React.useEffect(() => {
    if (!foco?.pessoa) return;
    setSearchTerm(foco.pessoa);
    const achada = experiencias.find(e => e.colaborador.trim().toLowerCase() === foco.pessoa.trim().toLowerCase());
    if (achada) setActiveTableTab(achada.status === 'EFETIVADO' ? 'efetivados' : achada.status === 'ENCERRADO' ? 'encerrados' : 'ativos');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foco?.token, experiencias.length]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingExperiencia, setEditingExperiencia] = useState<Experiencia | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // New review form
  const [colaborador, setColaborador] = useState('');
  const [funcao, setFuncao] = useState('');
  const [setor, setSetor] = useState('Infra');
  const [sede, setSede] = useState(sedes[0]?.nome || '');
  const [dataAdmissao, setDataAdmissao] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Secure relevant experiences list restricted by Sede
  // Sede e setor valem também para os números do topo.
  const relevantExperiencias = useMemo(() => {
    const sedesAlvo = (sedeTravada ? [userSede!] : sedesSel).map(x => x.toLowerCase());
    return experiencias.filter(e =>
      (!sedesAlvo.length || sedesAlvo.includes((e.sede || '').toLowerCase())) &&
      (!setoresSel.length || setoresSel.includes(e.setor)));
  }, [experiencias, sedeTravada, userSede, sedesSel, setoresSel]);

  const opcoesSetor = useMemo(() => [...new Set(experiencias.map(e => e.setor).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR')).map(x => ({ valor: x, rotulo: x })), [experiencias]);

  // Stats
  const stats = useMemo(() => {
    let emAnalise = 0;
    let prorrogado = 0;
    let efetivado = 0;
    let encerrado = 0;

    relevantExperiencias.forEach(e => {
      if (e.status === 'EM_ANALISE') emAnalise++;
      else if (e.status === 'PRORROGADO') prorrogado++;
      else if (e.status === 'EFETIVADO') efetivado++;
      else if (e.status === 'ENCERRADO') encerrado++;
    });

    const totalConcluidos = efetivado + encerrado;
    const taxaRetencao = totalConcluidos > 0 ? Math.round((efetivado / totalConcluidos) * 100) : 100;

    return {
      emAnalise,
      prorrogado,
      efetivado,
      encerrado,
      taxaRetencao,
      totalAtivos: emAnalise + prorrogado
    };
  }, [relevantExperiencias]);

  // Options
  const sectorsList = useMemo(() => {
    if (setores && setores.length > 0) {
      return [...setores.map(s => s.nome)].sort((a,b) => a.localeCompare(b));
    }
    return [
      "Almoxarifado", "Almoxarifado geral", "Atendimento", "Cantina", "Compras", 
      "Comunicação Digital", "Construtora", "Coordenação", "CPA", "D. Valéria", 
      "Idiomas DT", "Infra", "Infraestrutura", "Jurídico", "Livros escolares", 
      "Lojinha", "Marketing", "Metalurgica", "MKT", "Pedagógico", "Redes", 
      "Secretaria", "Som", "TI"
    ].sort((a,b) => a.localeCompare(b));
  }, [setores]);

  React.useEffect(() => {
    if (sectorsList && sectorsList.length > 0 && !sectorsList.includes(setor)) {
      setSetor(sectorsList[0]);
    }
  }, [sectorsList, setor]);

  const dateToInput = (value?: string) => toISOInput(value);

  const resetForm = () => {
    setColaborador('');
    setFuncao('');
    setSetor(sectorsList[0] || '');
    setSede(!isAdmin && userSede ? userSede : sedes[0]?.nome || '');
    setDataAdmissao('');
    setSupervisor('');
    setObservacoes('');
    setEditingExperiencia(null);
    setErrorMsg('');
  };

  const openCreateForm = () => {
    resetForm();
    setShowAddForm(true);
  };

  const openEditForm = (experiencia: Experiencia) => {
    setEditingExperiencia(experiencia);
    setColaborador(experiencia.colaborador || '');
    setFuncao(experiencia.funcao || '');
    setSetor(experiencia.setor || sectorsList[0] || '');
    setSede(experiencia.sede || '');
    setDataAdmissao(dateToInput(experiencia.dataAdmissao));
    setSupervisor(experiencia.supervisor || '');
    setObservacoes(experiencia.observacoes || '');
    setErrorMsg('');
    setShowAddForm(true);
  };

  // Filtered
  const filteredList = useMemo(() => {
    return relevantExperiencias.filter(e => {
      const matchText = !searchTerm.trim() || 
        e.colaborador.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.funcao.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.supervisor.toLowerCase().includes(searchTerm.toLowerCase());

      let matchesTab = false;
      if (activeTableTab === 'ativos') {
        matchesTab = e.status === 'EM_ANALISE' || e.status === 'PRORROGADO';
      } else if (activeTableTab === 'efetivados') {
        matchesTab = e.status === 'EFETIVADO';
      } else if (activeTableTab === 'encerrados') {
        matchesTab = e.status === 'ENCERRADO';
      }

      const matchUrgente = !soUrgentes || ['danger', 'warning'].includes(getReviewAlert(e).type);

      return matchText && matchesTab && matchUrgente;
    })
      // Em andamento, o prazo mais apertado primeiro: é a ordem de trabalho.
      .sort((a, b) => activeTableTab === 'ativos' ? getReviewAlert(a).days - getReviewAlert(b).days : 0);
  }, [relevantExperiencias, searchTerm, activeTableTab, soUrgentes]);

  // Due / Urgent reviews summary for Notification Center
  const dueReviewsSummary = useMemo(() => {
    const overdue: { exp: Experiencia; alert: ReviewAlert }[] = [];
    const urgent: { exp: Experiencia; alert: ReviewAlert }[] = [];

    relevantExperiencias.forEach(e => {
      const alert = getReviewAlert(e);
      if (alert.type === 'danger') {
        overdue.push({ exp: e, alert });
      } else if (alert.type === 'warning') {
        urgent.push({ exp: e, alert });
      }
    });

    return { overdue, urgent };
  }, [relevantExperiencias]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!colaborador.trim() || !funcao.trim() || !dataAdmissao.trim() || !sede) {
      setErrorMsg("Por favor, preencha o nome do Colaborador, a Função, a Sede/Unidade e a Data de Admissão.");
      return;
    }

    // Converte a data do input (ISO) para o formato BR usado no domínio.
    const formattedAdm = formatDateBR(dataAdmissao);

    const payload = {
      colaborador,
      funcao,
      setor,
      sede,
      dataAdmissao: formattedAdm,
      supervisor,
      observacoes
    };

    try {
      if (editingExperiencia) {
        await updateExperiencia(editingExperiencia.id, payload);
      } else {
        await addExperiencia({
          ...payload,
          status: 'EM_ANALISE'
        });
      }
      resetForm();
      setShowAddForm(false);
    } catch (err: any) {
      setErrorMsg('Erro ao salvar. Verifique a conexão e tente novamente.' + (err?.message ? ` (${err.message})` : ''));
    }
  };

  // Change status helper with action click. "Encerrar" pelo botão = iniciativa da
  // EMPRESA; a rescisão a pedido do colaborador passa pelo modal (com data/motivo).
  const handleStatusChange = async (id: string, newStatus: Experiencia['status']) => {
    const extra = newStatus === 'ENCERRADO' ? { tipoEncerramento: 'empresa' as const } : {};
    await updateExperiencia(id, { status: newStatus, ...extra });
  };

  // Rescisão a pedido: colaborador pediu demissão antes de fechar 45/90 dias.
  const confirmarRescisao = async (alvo: Experiencia) => {
    const dataPedido = rescisaoData ? formatDateBR(rescisaoData) : '';
    const nota = `Rescisão a pedido do colaborador${dataPedido ? ` em ${dataPedido}` : ''}.${rescisaoObs.trim() ? ` ${rescisaoObs.trim()}` : ''}`;
    await updateExperiencia(alvo.id, {
      status: 'ENCERRADO',
      tipoEncerramento: 'a_pedido',
      dataPedidoRescisao: dataPedido,
      // preserva o histórico já existente nas observações
      observacoes: [alvo.observacoes?.trim(), nota].filter(Boolean).join('\n'),
    });
  };

  // ── Decisão da experiência ────────────────────────────────────────────────
  // ⚠️ Antes eram quatro botões soltos na linha, e "Encerrar" desligava a
  // pessoa com UM clique, sem confirmação, colado no "Efetivar". Agora a
  // decisão abre um modal: escolhe, confere o nome, confirma.
  type Escolha = 'EFETIVADO' | 'PRORROGADO' | 'a_pedido' | 'empresa';
  const [decidindo, setDecidindo] = useState<Experiencia | null>(null);
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const abrirDecisao = (e: Experiencia) => {
    setDecidindo(e);
    setEscolha(null);
    setRescisaoData(toISOInput(new Date().toISOString()));
    setRescisaoObs('');
  };
  const confirmarDecisao = async () => {
    if (!decidindo || !escolha) return;
    const alvo = decidindo;
    setDecidindo(null);
    if (escolha === 'a_pedido') await confirmarRescisao(alvo);
    else await handleStatusChange(alvo.id, escolha === 'empresa' ? 'ENCERRADO' : escolha);
  };

  /** Próximo marco e quanto falta, para a coluna "Próximo prazo". */
  const prazo = (e: Experiencia) => {
    const a = getReviewAlert(e);
    const marco = e.status === 'PRORROGADO' ? `90 dias · ${e.termino2}` : `45 dias · ${e.termino1}`;
    const texto = a.days < 0 ? `atrasada há ${-a.days} dia${a.days === -1 ? '' : 's'}`
      : a.days === 0 ? 'vence hoje'
      : `em ${a.days} dia${a.days === 1 ? '' : 's'}`;
    const cor = a.type === 'danger' ? 'var(--atraso)' : a.type === 'warning' ? 'var(--etapa-triagem)' : 'var(--tinta-3)';
    return { marco, texto, cor };
  };
  const situacao = (e: Experiencia): { rotulo: string; cor: string } =>
    e.status === 'EM_ANALISE' ? { rotulo: 'Em análise (45 dias)', cor: 'var(--etapa-entrevista)' }
    : e.status === 'PRORROGADO' ? { rotulo: 'Prorrogado (90 dias)', cor: 'var(--etapa-testes)' }
    : e.status === 'EFETIVADO' ? { rotulo: 'Efetivado', cor: 'var(--etapa-admissao)' }
    : e.tipoEncerramento === 'a_pedido' ? { rotulo: e.dataPedidoRescisao ? `Saiu a pedido em ${e.dataPedidoRescisao}` : 'Saiu a pedido', cor: 'var(--etapa-triagem)' }
    : { rotulo: 'Desligado pela empresa', cor: 'var(--atraso)' };

  const excluir = (e: Experiencia) => {
    if (confirmAction) {
      confirmAction('Excluir acompanhamento', `Remover o acompanhamento de experiência de "${e.colaborador}"? A admissão em si não é afetada.`, () => deleteExperiencia(e.id));
    } else if (confirm(`Remover definitivamente acompanhamento de ${e.colaborador}?`)) {
      deleteExperiencia(e.id);
    }
  };
  const fecharForm = () => { resetForm(); setShowAddForm(false); };
  const pedemAvaliacao = dueReviewsSummary.overdue.length + dueReviewsSummary.urgent.length;

  return (
    <div className="space-y-5">
      <header className="pagina-cab">
        <div className="min-w-0">
          <p className="pagina-trilha">Pessoas</p>
          <h1 className="pagina-titulo">Experiência</h1>
          <p className="inicio-sub">Prazos de 45 e 90 dias dos novos colaboradores.</p>
        </div>
        <div className="pagina-acoes">
          {canManage && onImportUniversidade && (
            <>
              <input
                ref={uniFileRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                aria-label="Planilha de acompanhamento de experiência (Universidade)"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setImportandoUni(true);
                  try { await onImportUniversidade(f); }
                  finally { setImportandoUni(false); if (uniFileRef.current) uniFileRef.current.value = ''; }
                }}
              />
              <button type="button" className="btn" onClick={() => uniFileRef.current?.click()} disabled={importandoUni}
                title="Importar a planilha de acompanhamento (abas por campus)">
                {importandoUni ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />} Importar (Universidade)
              </button>
            </>
          )}
          {canManage && (
            <button type="button" className="btn btn-primario" onClick={openCreateForm}><Plus aria-hidden="true" /> Novo acompanhamento</button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi rotulo="Em experiência" valor={stats.totalAtivos} detalhe={`${stats.emAnalise} em 45 dias · ${stats.prorrogado} prorrogados`} />
        <Kpi rotulo="Avaliações atrasadas" valor={dueReviewsSummary.overdue.length} tom={dueReviewsSummary.overdue.length ? 'critico' : 'neutro'} detalhe="vencidas ou vencendo hoje" />
        <Kpi rotulo="Vencem em 7 dias" valor={dueReviewsSummary.urgent.length} tom={dueReviewsSummary.urgent.length ? 'atencao' : 'neutro'} />
        <Kpi rotulo="Retenção" valor={`${stats.taxaRetencao}%`} detalhe={`${stats.efetivado} efetivados de ${stats.efetivado + stats.encerrado} concluídos`} />
      </div>

      <div className="filtros">
        <div className="seg" role="group" aria-label="Situação">
          {([['ativos', 'Em experiência', stats.totalAtivos], ['efetivados', 'Efetivados', stats.efetivado], ['encerrados', 'Encerrados', stats.encerrado]] as const).map(([id, rotulo, n]) => (
            <button key={id} type="button" aria-pressed={activeTableTab === id} onClick={() => setActiveTableTab(id)}>{rotulo} <b className="tabular-nums">{n}</b></button>
          ))}
        </div>
        {activeTableTab === 'ativos' && pedemAvaliacao > 0 && (
          <button type="button" className="chip" aria-pressed={soUrgentes} onClick={() => setSoUrgentes(v => !v)}>
            Pedem avaliação <b>{pedemAvaliacao}</b>
          </button>
        )}
        {/* Todo filtro é de múltipla escolha (regra de 08/10/2026). */}
        {sedeTravada
          ? <span className="chip" title="Seu acesso é desta sede">Sede: <b>{userSede}</b></span>
          : <FiltroMultiplo rotulo="Sede" todos="todas" selecionados={sedesSel} onChange={setSedesSel} opcoes={sedes.map(s => ({ valor: s.nome, rotulo: s.sigla ? `${s.sigla} · ${s.nome}` : s.nome }))} />}
        <FiltroMultiplo rotulo="Setor" selecionados={setoresSel} onChange={setSetoresSel} opcoes={opcoesSetor} />
        <label className="campo-busca">
          <Search aria-hidden="true" />
          <input type="search" className="campo" placeholder="Buscar nome, função ou supervisor" aria-label="Buscar nome, função ou supervisor"
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </label>
      </div>

      <section className="painel overflow-hidden" aria-label="Acompanhamentos">
        {filteredList.length === 0 ? (
          <p className="text-center py-12 text-[14px]" style={{ color: 'var(--tinta-3)' }}>Ninguém com esses filtros.</p>
        ) : (
          // Sem rolagem de lado (regra de 08/10/2026): em tela estreita, cartão.
          <table className="tabela tabela-empilha">
            <thead>
              <tr>
                <th scope="col">Colaborador</th>
                <th scope="col">Admissão</th>
                <th scope="col">{activeTableTab === 'ativos' ? 'Próximo prazo' : 'Prazos'}</th>
                <th scope="col">Supervisor</th>
                <th scope="col">Situação</th>
                {canManage && <th scope="col"><span className="sr-only">Ações</span></th>}
              </tr>
            </thead>
            <tbody>
              {filteredList.map((e) => {
                const ativo = e.status === 'EM_ANALISE' || e.status === 'PRORROGADO';
                const p = prazo(e);
                const sit = situacao(e);
                return (
                  <tr key={e.id}>
                    <td>
                      <span>
                        <b>{e.colaborador}</b>
                        {e.vagaCodigo != null && <span className="ml-2 align-middle"><LinkVaga codigo={e.vagaCodigo} /></span>}
                        <span className="sub">{[e.funcao, e.sede || 'sem sede', e.setor].filter(Boolean).join(' · ')}</span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap" data-rotulo="Admissão">{e.dataAdmissao}</td>
                    <td className="whitespace-nowrap" data-rotulo={ativo ? 'Próximo prazo' : 'Prazos'}>
                      {ativo
                        ? <span>{p.marco}<span className="sub" style={{ color: p.cor, fontWeight: 700 }}>{p.texto}</span></span>
                        : <span>45 dias · {e.termino1}<span className="sub">90 dias · {e.termino2}</span></span>}
                    </td>
                    <td data-rotulo="Supervisor">{e.supervisor || 'RH'}</td>
                    <td data-rotulo="Situação"><b style={{ color: sit.cor }}>{sit.rotulo}</b></td>
                    {canManage && (
                      <td className="text-right whitespace-nowrap">
                        <span className="inline-flex gap-1.5">
                          {ativo && <button type="button" className="btn btn-sm btn-primario" onClick={() => abrirDecisao(e)}>Registrar decisão</button>}
                          <button type="button" className="btn btn-sm" onClick={() => openEditForm(e)}>Editar</button>
                          <button type="button" className="btn btn-sm btn-perigo" onClick={() => excluir(e)} aria-label={`Excluir acompanhamento de ${e.colaborador}`}><Trash2 aria-hidden="true" /></button>
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {decidindo && (
        <Modal
          titulo={decidindo.colaborador}
          antes={<>Decisão da experiência · {situacao(decidindo).rotulo}</>}
          largura="sm"
          aoFechar={() => setDecidindo(null)}
          rodape={<>
            <button type="button" className="btn" onClick={() => setDecidindo(null)}>Cancelar</button>
            <button type="button" className={`btn ${escolha === 'empresa' || escolha === 'a_pedido' ? 'btn-perigo' : 'btn-primario'}`}
              disabled={!escolha || (escolha === 'a_pedido' && !rescisaoData)} onClick={confirmarDecisao}>
              Confirmar
            </button>
          </>}
        >
          <p className="text-[14px] mb-3" style={{ color: 'var(--tinta-2)' }}>
            {decidindo.funcao} · admitido(a) em {decidindo.dataAdmissao} · {prazo(decidindo).marco} ({prazo(decidindo).texto})
          </p>
          <div className="space-y-2" role="radiogroup" aria-label="Decisão">
            {([
              ['EFETIVADO', 'Efetivar', 'Passou na experiência e segue na empresa.'],
              ...(decidindo.status === 'EM_ANALISE' ? [['PRORROGADO', 'Prorrogar até 90 dias', `Nova avaliação em ${decidindo.termino2}.`]] : []),
              ['a_pedido', 'Pediu para sair', 'Rescisão a pedido do colaborador.'],
              ['empresa', 'Desligar', 'Encerramento por iniciativa da empresa.'],
            ] as [Escolha, string, string][]).map(([id, rotulo, ajuda]) => (
              <label key={id} className="opcao-decisao" data-marcada={escolha === id}>
                <input type="radio" name="decisao" checked={escolha === id} onChange={() => setEscolha(id)} />
                <span><b>{rotulo}</b><span>{ajuda}</span></span>
              </label>
            ))}
          </div>
          {escolha === 'a_pedido' && (
            <div className="grid grid-cols-1 gap-3 mt-4">
              <label className="block">
                <span className="rotulo">Data do pedido *</span>
                <input type="date" className="campo w-full" value={rescisaoData} onChange={(e) => setRescisaoData(e.target.value)} />
              </label>
              <label className="block">
                <span className="rotulo">Observação</span>
                <textarea rows={2} className="campo w-full" value={rescisaoObs} onChange={(e) => setRescisaoObs(e.target.value)} placeholder="Motivo relatado, detalhes do desligamento" />
              </label>
            </div>
          )}
        </Modal>
      )}

      {showAddForm && (
        <Modal
          titulo={editingExperiencia ? 'Editar acompanhamento' : 'Novo acompanhamento'}
          antes={editingExperiencia ? editingExperiencia.colaborador : 'Experiência de 45 e 90 dias'}
          aoFechar={fecharForm}
          rodape={<>
            <button type="button" className="btn" onClick={fecharForm}>Cancelar</button>
            <button type="submit" form="form-experiencia" className="btn btn-primario">{editingExperiencia ? 'Salvar alterações' : 'Cadastrar'}</button>
          </>}
        >
          <form id="form-experiencia" onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && <p role="alert" className="erro-form">{errorMsg}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block sm:col-span-2">
                <span className="rotulo">Nome completo *</span>
                <input type="text" required className="campo w-full" value={colaborador} onChange={(e) => setColaborador(e.target.value)} />
              </label>
              <label className="block">
                <span className="rotulo">Função *</span>
                <input type="text" required className="campo w-full" value={funcao} onChange={(e) => setFuncao(e.target.value)} />
              </label>
              <label className="block">
                <span className="rotulo">Admissão *</span>
                <input type="date" required className="campo w-full" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} />
                <span className="ajuda block">Os prazos de 45 e 90 dias saem daqui.</span>
              </label>
              <label className="block">
                <span className="rotulo">Sede *</span>
                <select required className="campo w-full" value={sede} onChange={(e) => setSede(e.target.value)}>
                  <option value="">Escolha…</option>
                  {sede && !sedes.some(s => s.nome === sede) && <option value={sede}>{sede}</option>}
                  {sedes.map((s) => <option key={s.id} value={s.nome}>{s.sigla ? `${s.sigla} · ${s.nome}` : s.nome}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="rotulo">Setor</span>
                <select className="campo w-full" value={setor} onChange={(e) => setSetor(e.target.value)}>
                  {sectorsList.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="rotulo">Supervisor imediato</span>
                <input type="text" className="campo w-full" value={supervisor} onChange={(e) => setSupervisor(e.target.value)} />
              </label>
              <label className="block sm:col-span-2">
                <span className="rotulo">Observações</span>
                <textarea rows={3} className="campo w-full" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
              </label>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
