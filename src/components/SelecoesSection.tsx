import React, { useMemo, useState } from 'react';
import type { Selecao, Vaga, Integracao, Entrevista, Consulta, Experiencia } from '../types';
import type { Sede } from '../hooks/useMetadata';
import type { Atividade } from '../hooks/useAtividades';
import type { Candidato } from '../types';
import { CandidatosDoDia } from './CandidatosDoDia';
import { relatoPorPessoa, TAREFAS_PADRAO, totalContado, type EntradaLog, type Diario, type Tarefa } from '../utils/resumoDia';
import { siglaCanonica } from '../utils/unidade';
import { montarAgendaDoDia } from '../utils/agenda';
import { FiltroMultiplo } from './ui/FiltroMultiplo';
import { Modal } from './ui/Modal';
import { ModalSelecao, formularioVazio, sugestoesDeSelecoes } from './selecoes/ModalSelecao';
import { Atalho, LinkVaga } from './ui/Atalhos';
import type { Aba } from '../lib/rotas';
import { formatDateBR, toISOInput, dataISOLocal } from '../utils/date';
import {
  ehRealizada, estaAtrasada, totaisDeSelecoes, codigosDasVagas,
  validarConfirmacao, camposDaConfirmacao,
} from '../utils/selecao';
import {
  Users, ChevronLeft, ChevronRight, ChevronDown, PlusCircle, CalendarClock, AlertTriangle, Trash2, Pencil,
  Minus, Plus, Lock,
} from 'lucide-react';

/**
 * Resumo do dia — o dia de seleção no formato da planilha que o RH já preenche,
 * MAIS o que a equipe fez fora das seleções.
 *
 * Substituiu a Agenda beta a pedido do RH: as abas QUANTI da planilha de
 * Seleções JÁ são a agenda deles, dia a dia, e repetir isso numa tela de
 * formato diferente era pedir que aprendessem duas linguagens para o mesmo
 * trabalho. As colunas aqui são as mesmas da aba — CARGO, SEDE, RESPONSÁVEL,
 * CONVOCADOS, COMPARECERAM, AUSENTES, DESISTIRAM — na mesma ordem.
 *
 * O que a Agenda mostrava além de seleção (integração, desligamento, vaga,
 * prazo de experiência) não sumiu: virou a linha de contexto no topo do dia.
 *
 * As ATIVIDADES são o registro do que não cabe em nenhum módulo — montar os
 * kits do Setembro Amarelo, força-tarefa de documentação. Vivem em coleção
 * própria e aparecem em bloco próprio: juntas na leitura, nunca somadas aos
 * números da seleção.
 */
interface SelecoesSectionProps {
  selecoes: Selecao[];
  /** Dia a abrir, vindo de outra tela (#/resumo-do-dia?dia=…). O token reaplica. */
  foco?: { dia: string; token: number } | null;
  /**
   * O que o RH fez no dia e não foi seleção. Lista SEPARADA de propósito:
   * atividade não tem cargo, vaga nem comparecimento, e somada às seleções
   * viraria uma linha de colunas vazias contada como seleção do dia.
   */
  atividades?: Atividade[];
  adicionarAtividade?: (dados: Omit<Atividade, 'id'>) => Promise<void>;
  atualizarAtividade?: (id: string, campos: Partial<Atividade>) => Promise<void>;
  removerAtividade?: (id: string) => Promise<void>;
  confirmAction?: (titulo: string, mensagem: string, onConfirm: () => void | Promise<void>) => void;
  /** Excluir uma seleção AGENDADA (só Administrador e Coordenador recebem). */
  excluirSelecao?: (selecao: Selecao) => void;
  /**
   * O log de auditoria — tudo que cada pessoa fez no sistema. Só chega aqui
   * para Administrador e Coordenador (é o que as regras deixam ler), e já vem
   * recortado pela região do Coordenador. Ausente = o bloco não aparece.
   */
  logs?: EntradaLog[];
  /** Para trocar o e-mail do log pelo nome de quem fez. */
  usuarios?: { email: string; nome?: string }[];
  /** "Meu dia" de todo mundo — as quatro contagens informadas à mão. */
  diarios?: Diario[];
  /** Grava o "Meu dia" de QUEM ESTÁ LOGADO. Ausente = sem o card. */
  salvarMeuDia?: (data: string, contagens: Record<string, number>) => Promise<void>;
  /** A lista de tarefas da equipe (padrão + criadas), inclusive arquivadas. */
  tarefas?: Tarefa[];
  /** Qualquer pessoa do RH cria tarefa nova. Ausente = sem o campo. */
  criarTarefa?: (nome: string) => Promise<void>;
  /** Renomear/arquivar — só Admin e Coordenador. Ausente = sem "Gerenciar". */
  ajustarTarefa?: (id: string, campos: { nome?: string; arquivada?: boolean }) => Promise<void>;
  /** Apagar tarefa NUNCA contada — só Admin e Coordenador. Ausente = sem o botão. */
  apagarTarefa?: (id: string) => Promise<void>;
  /** E-mail de quem está logado — para achar o próprio "Meu dia". */
  emailAtual?: string;
  /** As linhas do log de quem está logado: o "do sistema" do formulário. */
  meuLog?: EntradaLog[];
  vagas: Vaga[];
  integracoes: Integracao[];
  entrevistas: Entrevista[];
  consultas: Consulta[];
  experiencias: Experiencia[];
  /**
   * Candidatos de cada dia de seleção. Ausente = sem a lista (Visualizador:
   * a regra do banco nem deixa ler — tem nome e resultado de teste).
   */
  candidatos?: Candidato[];
  salvarCandidato?: (selecao: Selecao, dados: Pick<Candidato, 'nome' | 'resultado' | 'contratado' | 'motivo' | 'observacao'>, id?: string) => Promise<void>;
  registrarCandidatos?: (selecao: Selecao, nomes: string[]) => Promise<void>;
  removerCandidato?: (selecao: Selecao, id: string) => Promise<void>;
  /** Ausentes = somente leitura (Visualizador). */
  /** Criar seleção pelo formulário único (o mesmo de Seleções e do Kanban). */
  criarSelecao?: (campos: Omit<Selecao, 'id'>, nomes: string[]) => Promise<void>;
  confirmarSelecao?: (id: string, campos: Partial<Selecao>) => Promise<void>;
  sedes?: Sede[];
  /** Sede do usuário — o agendamento já abre nela. Vazio para quem vê todas. */
  sedePadrao?: string;
  /** Nome de quem está logado: quem agenda quase sempre é quem conduz. */
  responsavelPadrao?: string;
}

const campoCls = 'campo w-full';
const rotuloCls = 'block text-[12.5px] font-semibold text-slate-600 mb-1';
const thCls = 'px-4 py-2.5 text-left text-[12.5px] font-semibold text-slate-500';
const numCls = 'px-4 py-3 text-[14px] font-semibold tabular-nums text-right';
/** Título de cada bloco da tela. */
const tituloCls = 'text-[16px] font-bold text-slate-900';

/** Soma dias a uma data ISO (YYYY-MM-DD) sem passar por fuso. */
function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  return dataISOLocal(new Date(a, m - 1, d + dias));
}

export const SelecoesSection: React.FC<SelecoesSectionProps> = (props) => {
  const {
    criarSelecao, confirmarSelecao, sedes = [], sedePadrao = '', responsavelPadrao = '',
    atividades = [], adicionarAtividade, atualizarAtividade, removerAtividade, confirmAction,
    logs, usuarios = [], diarios = [], salvarMeuDia, emailAtual = '', meuLog = [],
    tarefas = TAREFAS_PADRAO, criarTarefa, ajustarTarefa, apagarTarefa,
    candidatos, salvarCandidato, registrarCandidatos, removerCandidato, foco, excluirSelecao,
    ...fontes
  } = props;
  const [diaISO, setDiaISO] = useState(() => foco?.dia || dataISOLocal());
  React.useEffect(() => {
    if (foco?.dia && /^\d{4}-\d{2}-\d{2}$/.test(foco.dia)) setDiaISO(foco.dia);
  }, [foco?.token]);
  const hojeISO = dataISOLocal();

  // "Agendar seleção" abre o formulário único (selecoes/ModalSelecao).
  const [agendando, setAgendando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Dia de seleção com a lista de candidatos aberta.
  const [candidatosDe, setCandidatosDe] = useState<string | null>(null);
  const porSelecao = useMemo(() => {
    const m = new Map<string, Candidato[]>();
    for (const c of candidatos || []) (m.get(c.selecaoId) || m.set(c.selecaoId, []).get(c.selecaoId)!).push(c);
    return m;
  }, [candidatos]);

  const [confirmando, setConfirmando] = useState<{ id: string; convocados: number; titulo: string } | null>(null);
  const [presentes, setPresentes] = useState(0);
  const [erroConfirmar, setErroConfirmar] = useState('');

  const dia = formatDateBR(diaISO);
  const hoje = formatDateBR(hojeISO);

  /**
   * Filtro de sede. O escopo por UNIDADE (Colégio × Universidade) já vem
   * pronto do App; este filtro é o corte de dentro — num mesmo dia há seleção
   * em várias sedes, e quem responde por uma não quer ler as outras.
   *
   * Vale para a tabela, os totais, a cobrança de atrasadas e as próximas: um
   * filtro que muda a lista mas não os números seria pior que nenhum.
   */
  const [filtroSede, setFiltroSede] = useState<string[]>([]);
  const siglasFiltro = useMemo(() => new Set(filtroSede.map(x => siglaCanonica(sedes, x))), [filtroSede, sedes]);
  // Para frases e para a sede de uma atividade nova: só vale quando há UMA sede marcada.
  const sedeUnica = filtroSede.length === 1 ? filtroSede[0] : '';
  const rotuloFiltro = filtroSede.map(x => sedes.find(s => s.nome === x)?.sigla || x).join(', ');

  const naSede = useMemo(() => {
    if (!filtroSede.length) return () => true;
    return (s: Selecao) => siglasFiltro.has(siglaCanonica(sedes, s.sede));
  }, [filtroSede, siglasFiltro, sedes]);

  const doDia = useMemo(
    () => fontes.selecoes.filter(s => (s.data || '').trim() === dia && naSede(s)),
    [fontes.selecoes, dia, naSede]
  );
  const totais = useMemo(() => totaisDeSelecoes(doDia), [doDia]);

  /**
   * Atividades do dia. Usa o MESMO filtro de sede da tabela: um filtro que
   * esconde metade da tela e deixa a outra metade passar é pior que nenhum.
   * Atividade sem sede aparece sempre — é trabalho da equipe toda.
   */
  const atividadesDoDia = useMemo(() => {
    return atividades.filter(a =>
      (a.data || '').trim() === dia &&
      (!filtroSede.length || !(a.sede || '').trim() || siglasFiltro.has(siglaCanonica(sedes, a.sede)))
    );
  }, [atividades, dia, filtroSede, siglasFiltro, sedes]);

  // `editandoAtiv` guarda o id quando é edição, e null quando é registro novo.
  // O formulário é o MESMO nos dois casos: dois formulários iguais lado a lado
  // divergem no primeiro campo que alguém acrescentar em só um deles.
  const [formAtiv, setFormAtiv] = useState<
    { id: string | null; titulo: string; detalhe: string; responsavel: string } | null
  >(null);
  const [salvandoAtiv, setSalvandoAtiv] = useState(false);
  const [erroAtiv, setErroAtiv] = useState('');

  const abrirAtividade = () => {
    setErroAtiv('');
    setFormAtiv({ id: null, titulo: '', detalhe: '', responsavel: responsavelPadrao });
  };

  const editarAtividade = (a: Atividade) => {
    setErroAtiv('');
    setFormAtiv({
      id: a.id,
      titulo: a.titulo || '',
      detalhe: a.detalhe || '',
      responsavel: a.responsavel || '',
    });
  };

  const salvarAtividade = async () => {
    if (!formAtiv) return;
    const titulo = formAtiv.titulo.trim();
    if (!titulo) return setErroAtiv('Escreva o que foi feito.');
    setSalvandoAtiv(true);
    setErroAtiv('');
    try {
      const campos = {
        titulo,
        // `|| ''` e não `|| undefined`: apagar o detalhe tem que APAGAR. Com
        // undefined o campo é omitido da gravação e o texto antigo fica lá.
        detalhe: formAtiv.detalhe.trim() || '',
        responsavel: formAtiv.responsavel.trim() || '',
      };
      if (formAtiv.id) {
        // Data e sede não entram na edição: mudar o dia de uma atividade é
        // movê-la para outro dia, e isso é registrar de novo lá.
        if (atualizarAtividade) await atualizarAtividade(formAtiv.id, campos);
      } else if (adicionarAtividade) {
        await adicionarAtividade({
          ...campos,
          data: dia,
          // A sede do filtro, e não a do usuário: quem está olhando Benfica
          // registrando uma atividade está registrando a atividade de Benfica.
          sede: sedeUnica || sedePadrao || '',
        });
      }
      setFormAtiv(null);
    } catch (e: any) {
      setErroAtiv(`Não foi possível salvar: ${e?.message || e}`);
    } finally {
      setSalvandoAtiv(false);
    }
  };

  /**
   * O relato do dia de cada pessoa — a MESMA regra do e-mail das 18h
   * (`relatoPorPessoa`), para a tela e o e-mail nunca contarem histórias
   * diferentes sobre o mesmo dia.
   */
  const pessoasDoDia = useMemo(() => {
    if (!logs) return null;
    const nomes = new Map(
      usuarios
        .filter(u => u.email && u.nome)
        .map(u => [u.email.trim().toLowerCase(), (u.nome || '').trim()] as [string, string])
    );
    return relatoPorPessoa(logs, diarios, dia, nomes, tarefas);
  }, [logs, usuarios, diarios, dia]);

  // ── "Meu dia" ───────────────────────────────────────────────────────────────
  // Poucos números e pronto: foi o combinado com a direção ("não queria que o
  // RH passasse uma hora preenchendo papel"). Abre com o que já foi salvo no
  // dia que está na tela, então dá para corrigir ontem sem refazer nada.
  const meuDiarioSalvo = useMemo(
    () => diarios.find(d => d.data === dia && d.email.trim().toLowerCase() === emailAtual.trim().toLowerCase()),
    [diarios, dia, emailAtual]
  );
  /** As tarefas que aparecem no formulário. Arquivada só sai daqui. */
  const tarefasAtivas = useMemo(() => tarefas.filter(t => !t.arquivada), [tarefas]);
  const salvas = meuDiarioSalvo?.contagens || {};
  const [meuDia, setMeuDia] = useState<Record<string, number>>({});
  const [salvandoMeuDia, setSalvandoMeuDia] = useState(false);
  const [avisoMeuDia, setAvisoMeuDia] = useState('');
  // Troca de dia (ou chegada do dado do banco) recarrega o formulário. A chave
  // em texto evita recarregar a cada render por um objeto novo e igual.
  const chaveSalvas = JSON.stringify(salvas);
  React.useEffect(() => {
    setMeuDia({ ...salvas });
    setAvisoMeuDia('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dia, chaveSalvas]);

  const qtd = (id: string) => meuDia[id] || 0;
  const mudar = (id: string, n: number) => setMeuDia(m => ({ ...m, [id]: Math.max(0, Math.min(999, Math.floor(n) || 0)) }));
  const mudouMeuDia = [...new Set([...Object.keys(meuDia), ...Object.keys(salvas)])]
    .some(id => (meuDia[id] || 0) !== (salvas[id] || 0));

  // Tarefa nova (qualquer pessoa do RH) e ajustes (Admin/Coordenador).
  const [novaTarefa, setNovaTarefa] = useState('');
  const [erroTarefa, setErroTarefa] = useState('');
  const [gerenciando, setGerenciando] = useState(false);
  const criarTarefaAgora = async () => {
    if (!criarTarefa || !novaTarefa.trim()) return;
    setErroTarefa('');
    try {
      await criarTarefa(novaTarefa);
      setNovaTarefa('');
    } catch (e: any) {
      setErroTarefa(e?.message || String(e));
    }
  };

  /**
   * A prévia do e-mail DELA, ao vivo. Usa a mesma função do disparo das 18h,
   * com as contagens ainda não salvas no lugar das salvas — o que se vê aqui é
   * o que o diretor vai ler, se ela salvar agora.
   */
  const minhaPrevia = useMemo(() => {
    const eu = emailAtual.trim().toLowerCase();
    if (!eu) return null;
    const outrosDias = diarios.filter(d => d.email.trim().toLowerCase() === eu && d.data !== dia);
    const rascunho: Diario = { email: eu, data: dia, contagens: meuDia };
    const meuNome = usuarios.find(u => u.email?.trim().toLowerCase() === eu)?.nome || '';
    const [r] = relatoPorPessoa(meuLog, [...outrosDias, rascunho], dia, new Map(meuNome ? [[eu, meuNome]] : []), tarefas);
    return r || null;
  }, [meuLog, diarios, meuDia, dia, emailAtual, usuarios, tarefas]);

  // O "do sistema" é o relato sem o que ela mesma informou — é a parte travada.
  const temDoSistema = (minhaPrevia?.secoes || []).some(s => s.titulo !== 'Também informou');

  // "Algo mais": vira uma atividade do dia (mesma coleção da lista de baixo),
  // e com isso entra no relato pelo log, como qualquer outra coisa que ela fez.
  const [algoMais, setAlgoMais] = useState('');
  const [salvandoAlgo, setSalvandoAlgo] = useState(false);
  const adicionarAlgoMais = async () => {
    const titulo = algoMais.trim();
    if (!titulo || !adicionarAtividade) return;
    setSalvandoAlgo(true);
    try {
      await adicionarAtividade({ titulo, data: dia, sede: sedeUnica || sedePadrao || '', responsavel: responsavelPadrao || '' });
      setAlgoMais('');
    } finally {
      setSalvandoAlgo(false);
    }
  };

  const salvarMeuDiaAgora = async () => {
    if (!salvarMeuDia) return;
    setSalvandoMeuDia(true);
    setAvisoMeuDia('');
    try {
      // Todas as tarefas ativas vão, inclusive zeradas: o banco mescla, e uma
      // que baixou para 0 e não fosse enviada ficaria com o número antigo.
      const todas = Object.fromEntries(tarefasAtivas.map(t => [t.id, qtd(t.id)]));
      await salvarMeuDia(dia, { ...meuDia, ...todas });
      setAvisoMeuDia('Salvo.');
    } catch (e: any) {
      setAvisoMeuDia(`Não foi possível salvar: ${e?.message || e}`);
    } finally {
      setSalvandoMeuDia(false);
    }
  };
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const alternarPessoa = (email: string) => setAbertos(a => {
    const novo = new Set(a);
    novo.has(email) ? novo.delete(email) : novo.add(email);
    return novo;
  });

  const apagarAtividade = (a: Atividade) => {
    if (!removerAtividade) return;
    const acao = () => removerAtividade(a.id);
    if (confirmAction) confirmAction('Remover atividade', `Remover "${a.titulo}" do dia ${dia}?`, acao);
    else acao();
  };

  /** O resto do RH no mesmo dia — contexto, não lista. */
  const contexto = useMemo(() => {
    const r = montarAgendaDoDia(dia, fontes).resumo;
    const p = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
    return ([
      [r.vagasAbertas, p(r.vagasAbertas, 'vaga aberta', 'vagas abertas'), 'vagas'],
      [r.vagasConcluidas, p(r.vagasConcluidas, 'vaga concluída', 'vagas concluídas'), 'vagas'],
      [r.integracoes, p(r.integracoes, 'integração', 'integrações'), 'integracao'],
      [r.entrevistas, p(r.entrevistas, 'entrevista de saída', 'entrevistas de saída'), 'entrevistas'],
      [r.prazos, p(r.prazos, 'prazo de experiência', 'prazos de experiência'), 'experiencias'],
    ] as [number, string, Aba][]).filter(([n]) => n > 0).map(([, texto, aba]) => ({ texto, aba }));
  }, [dia, fontes]);

  /**
   * Agendamentos cuja data passou sem ninguém confirmar. A Agenda não cobrava
   * isso e o dado ficava pendurado: convocados lançados, presença nunca
   * registrada, funil contando um dia que ninguém fechou.
   */
  const atrasadas = useMemo(
    () => fontes.selecoes.filter(s => naSede(s) && estaAtrasada(s, hoje))
      .sort((a, b) => a.data.localeCompare(b.data)),
    [fontes.selecoes, hoje, naSede]
  );

  const proximas = useMemo(() => {
    const chave = (br: string) => br.split('/').reverse().join('');
    return fontes.selecoes
      .filter(s => naSede(s) && !ehRealizada(s) && chave(s.data) > chave(hoje))
      .sort((a, b) => chave(a.data).localeCompare(chave(b.data)))
      .slice(0, 5);
  }, [fontes.selecoes, hoje, naSede]);

  const nomeDoDia = useMemo(() => {
    const [a, m, d] = diaISO.split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  }, [diaISO]);

  const abrirConfirmacao = (s: Selecao) => {
    setConfirmando({ id: s.id, convocados: s.convocados || 0, titulo: `${s.cargo} · ${s.sede} · ${s.data}` });
    setPresentes(s.convocados || 0);
    setErroConfirmar('');
  };

  const salvarConfirmacao = async () => {
    if (!confirmando || !confirmarSelecao) return;
    const problemas = validarConfirmacao(confirmando.convocados, presentes);
    setErroConfirmar(problemas[0] || '');
    if (problemas.length) return;

    setSalvando(true);
    try {
      await confirmarSelecao(confirmando.id, camposDaConfirmacao(confirmando.convocados, presentes));
      setConfirmando(null);
    } catch (e: any) {
      setErroConfirmar(`Não foi possível confirmar: ${e?.message || e}`);
    } finally {
      setSalvando(false);
    }
  };

  /** Convocados dos dias ainda não confirmados — ficam fora da taxa, não da tela. */
  const convocadosAConfirmar = useMemo(
    () => doDia.filter(s => !ehRealizada(s)).reduce((t, s) => t + (s.convocados || 0), 0),
    [doDia]
  );

  /**
   * A frase do dia. Um dia só com agendamento NÃO é um dia vazio — dizer
   * "nenhuma seleção" com 12 convocados na tabela logo abaixo era a própria
   * tela se contradizendo.
   */
  const resumoDoDia = doDia.length === 0
    ? `Nenhuma seleção neste dia${filtroSede.length ? ` em ${rotuloFiltro}` : ''}.`
    : [
        totais.convocados > 0 &&
          `${totais.convocados} convocados · ${totais.compareceram} compareceram${totais.taxa !== null ? ` · ${totais.taxa}%` : ''}`,
        totais.aConfirmar > 0 &&
          `${convocadosAConfirmar} convocados em ${totais.aConfirmar === 1 ? '1 seleção' : `${totais.aConfirmar} seleções`} a confirmar`,
      ].filter(Boolean).join(' · ');

  // O que pede ação vem primeiro: as seleções do dia que esperam o resultado.
  const esperando = doDia.filter(x => !ehRealizada(x));
  /** O botão de ação de uma seleção agendada (com lista: por nome; sem: o número). */
  const acaoDaSelecao = (x: Selecao) =>
    x.numerosPelaLista && porSelecao.get(x.id)?.length ? (
      <button type="button" className="btn btn-sm btn-primario" onClick={() => setCandidatosDe(x.id)}>Lançar resultados</button>
    ) : confirmarSelecao ? (
      <button type="button" className="btn btn-sm btn-primario" onClick={() => abrirConfirmacao(x)} title="Registrar quantos apareceram">Confirmar presença</button>
    ) : (
      <span className="etiqueta"><CalendarClock className="w-3 h-3" /> Agendada</span>
    );

  /**
   * Motivos de desistência do dia, somados — as 18 colunas discriminadas que a
   * aba QUANTI GERAL carrega. Como coluna de tabela seriam 18, sendo 7 sempre
   * zeradas na planilha do ano inteiro; aqui viram lista, e só aparecem os
   * motivos que de fato aconteceram.
   */
  const motivosDoDia = useMemo(() => {
    const soma = new Map<string, number>();
    doDia.forEach(s => Object.entries(s.motivos || {}).forEach(([motivo, n]) => {
      if (n > 0) soma.set(motivo, (soma.get(motivo) || 0) + n);
    }));
    return [...soma.entries()].sort((a, b) => b[1] - a[1]);
  }, [doDia]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="pagina-cab">
        <div>
          <p className="pagina-trilha">Recrutamento › Resumo do Dia</p>
          <h2 className="pagina-titulo">Resumo do Dia</h2>
          {/* O dia vale para a tela inteira — Meu dia, equipe e seleções —, por
              isso mora aqui, e não dentro do bloco de seleções. */}
          <p className="text-[15px] font-semibold mt-1.5 first-letter:uppercase" style={{ color: 'var(--tinta-2)' }}>
            {nomeDoDia}{diaISO === hojeISO && ' · hoje'}
          </p>
        </div>
        <div className="pagina-acoes">
          <div className="seg" role="group" aria-label="Escolher o dia">
            <button type="button" onClick={() => setDiaISO(d => somarDias(d, -1))} aria-label="Dia anterior"><ChevronLeft className="w-4 h-4" /></button>
            <button type="button" aria-pressed={diaISO === hojeISO} onClick={() => setDiaISO(hojeISO)}>Hoje</button>
            <button type="button" onClick={() => setDiaISO(d => somarDias(d, 1))} aria-label="Próximo dia"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <input type="date" className="campo" value={toISOInput(dia)} onChange={e => e.target.value && setDiaISO(e.target.value)} aria-label="Escolher o dia" />
          {criarSelecao && (
            <button type="button" className="btn btn-primario" onClick={() => setAgendando(true)}><Plus />Agendar seleção</button>
          )}
        </div>
      </header>

      {/* Cobrança: agendamento vencido sem presença confirmada */}
      {atrasadas.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-amber-800">
              {atrasadas.length === 1
                ? '1 seleção passou sem confirmar quem apareceu.'
                : `${atrasadas.length} seleções passaram sem confirmar quem apareceu.`}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {atrasadas.slice(0, 6).map(s => (
                <button
                  key={s.id}
                  onClick={() => setDiaISO(toISOInput(s.data))}
                  className="px-2 py-1 bg-white border border-amber-200 rounded-lg text-[12px] font-bold text-amber-800 hover:bg-amber-100 cursor-pointer transition"
                >
                  {s.data} · {s.cargo}
                </button>
              ))}
              {atrasadas.length > 6 && (
                <span className="px-2 py-1 text-[12px] font-bold text-amber-700">
                  +{atrasadas.length - 6}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Meu dia — o formulário do relatório diário, combinado com a direção em
          22/09/2026: ela aponta, o sistema molda o texto. Vem PRIMEIRO na tela:
          é a única coisa que cada pessoa do RH tem de fazer todo dia. À
          esquerda, só o que o sistema não vê; à direita, o e-mail dela montando
          ao vivo — e é nele que se confere o que o SGPC já registrou (travado:
          se um número estiver errado, corrige-se na própria seleção ou vaga, e o
          e-mail acompanha). Repetir essas frases dos dois lados era ler o mesmo
          texto duas vezes. Se ela não abrir isto até as 18h, o e-mail sai só com
          o que o sistema registrou. */}
      {salvarMeuDia && (
        <section aria-labelledby="meu-dia-titulo" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 id="meu-dia-titulo" className={tituloCls}>Meu dia</h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5 mb-4">
            Complete com o que o sistema não vê. A prévia do e-mail que os diretores recebem às 18h se monta junto.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* ── o formulário ─────────────────────────────────────────── */}
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-[12.5px] font-bold text-slate-700">O que o sistema não vê</p>
                {ajustarTarefa && (
                  <button
                    type="button"
                    onClick={() => setGerenciando(g => !g)}
                    className="text-[12px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    {gerenciando ? 'Concluir' : 'Gerenciar tarefas'}
                  </button>
                )}
              </div>

              {/* Gerenciar (Admin/Coordenador): renomear, arquivar e apagar. Apagar a
                  já contada tira os números dela do acumulado (a confirmação diz
                  quantos); arquivar some do formulário e mantém o histórico. */}
              {gerenciando && ajustarTarefa ? (
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {tarefas.map(t => (
                    <div key={t.id} className="flex items-center gap-2 px-3 py-2">
                      <input
                        defaultValue={t.nome}
                        aria-label={`Nome da tarefa ${t.nome}`}
                        maxLength={60}
                        disabled={t.arquivada}
                        onBlur={e => {
                          const nome = e.target.value.trim();
                          if (nome && nome !== t.nome) ajustarTarefa(t.id, { nome });
                        }}
                        className={`flex-1 min-w-0 text-xs font-semibold bg-transparent outline-none border-b border-transparent focus:border-slate-400 ${t.arquivada ? 'text-slate-400 line-through' : 'text-slate-800'}`}
                      />
                      <button
                        type="button"
                        onClick={() => ajustarTarefa(t.id, { arquivada: !t.arquivada })}
                        className="shrink-0 text-[12px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        {t.arquivada ? 'Reativar' : 'Arquivar'}
                      </button>
                      {apagarTarefa && !TAREFAS_PADRAO.some(p => p.id === t.id) && (
                        <button
                          type="button"
                          aria-label={`Apagar ${t.nome}`}
                          onClick={() => {
                            // Apagar a já contada é permitido (pedido do RH), mas os
                            // números dela saem do acumulado — dito ANTES, com o total.
                            const total = totalContado(t.id, diarios);
                            const aviso = total > 0
                              ? `"${t.nome}" já foi contada ${total} ${total === 1 ? 'vez' : 'vezes'}. Apagando, essas contagens saem do acumulado do mês e do ano. Para manter o histórico, use Arquivar.`
                              : `Apagar "${t.nome}"? Ela nunca foi contada, então nenhum número se perde.`;
                            const apagar = () => apagarTarefa(t.id);
                            if (confirmAction) confirmAction('Apagar tarefa', aviso, apagar);
                            else apagar();
                          }}
                          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {tarefasAtivas.map(t => (
                      <label key={t.id} className="block border border-slate-200 rounded-xl p-2.5 cursor-text focus-within:border-slate-800">
                        {/* Duas linhas de leading-snug (1,375 × 2): rótulo curto
                            ao lado de um que quebra não desalinha os botões. */}
                        <span className="block text-[12.5px] font-bold text-slate-700 leading-snug min-h-[2.75em]">{t.nome}</span>
                        <span className="flex items-center gap-1.5 mt-1">
                          <button
                            type="button"
                            aria-label={`Menos em ${t.nome}`}
                            onClick={() => mudar(t.id, qtd(t.id) - 1)}
                            disabled={qtd(t.id) === 0}
                            className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default"
                          ><Minus className="w-3.5 h-3.5" /></button>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={999}
                            aria-label={t.nome}
                            value={qtd(t.id)}
                            onChange={e => mudar(t.id, Number(e.target.value))}
                            className={`w-full min-w-0 text-center text-base font-bold tabular-nums outline-none bg-transparent ${qtd(t.id) ? 'text-slate-900' : 'text-slate-400'}`}
                          />
                          <button
                            type="button"
                            aria-label={`Mais em ${t.nome}`}
                            onClick={() => mudar(t.id, qtd(t.id) + 1)}
                            className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                          ><Plus className="w-3.5 h-3.5" /></button>
                        </span>
                      </label>
                    ))}
                  </div>

                  {/* Salvar fica colado nos contadores, que é o que ele salva — e
                      o estado (salvo / não salvo / erro) mora num lugar só. */}
                  <div className="flex items-center justify-end gap-3 mt-2.5">
                    {mudouMeuDia ? (
                      <span role="status" className="text-[12.5px] font-bold text-amber-700">
                        Não salvo — a prévia já mostra, o e-mail ainda não.
                      </span>
                    ) : avisoMeuDia ? (
                      <span role="status" className={`text-[12.5px] font-bold ${avisoMeuDia === 'Salvo.' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {avisoMeuDia}
                      </span>
                    ) : meuDiarioSalvo ? (
                      <span className="text-[12.5px] font-bold text-emerald-700">Salvo.</span>
                    ) : null}
                    <button
                      onClick={salvarMeuDiaAgora}
                      disabled={salvandoMeuDia || !mudouMeuDia}
                      className="px-4 py-2 rounded-xl bg-slate-900 text-white text-[12.5px] font-bold hover:bg-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-default"
                    >
                      {salvandoMeuDia ? 'Salvando...' : 'Salvar contagens'}
                    </button>
                  </div>
                </>
              )}

              {/* Tarefa nova — de qualquer pessoa do RH, para a equipe toda. */}
              {criarTarefa && !gerenciando && (
                <div className="mt-4">
                  <label htmlFor="nova-tarefa" className="block text-[12.5px] font-bold text-slate-700 mb-1.5">
                    Falta uma tarefa?
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="nova-tarefa"
                      className={campoCls}
                      placeholder="Ex.: Conferência de ponto"
                      maxLength={60}
                      value={novaTarefa}
                      onChange={e => { setNovaTarefa(e.target.value); setErroTarefa(''); }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); criarTarefaAgora(); } }}
                    />
                    <button
                      type="button"
                      onClick={criarTarefaAgora}
                      disabled={!novaTarefa.trim()}
                      className="shrink-0 px-3 rounded-xl border border-slate-200 text-[12.5px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-default"
                    >
                      Criar
                    </button>
                  </div>
                  {erroTarefa
                    ? <p role="alert" className="text-[12.5px] font-semibold text-rose-700 mt-1">{erroTarefa}</p>
                    : <p className="text-[12px] text-slate-500 font-medium mt-1">Vira um contador para toda a equipe do RH.</p>}
                </div>
              )}

              {adicionarAtividade && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <label htmlFor="algo-mais" className="block text-[12.5px] font-bold text-slate-700 mb-1.5">Algo mais</label>
                  <div className="flex gap-2">
                    <input
                      id="algo-mais"
                      className={campoCls}
                      placeholder="Ex.: Montagem dos kits do Setembro Amarelo, 120 kits"
                      value={algoMais}
                      onChange={e => setAlgoMais(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarAlgoMais(); } }}
                    />
                    <button
                      onClick={adicionarAlgoMais}
                      disabled={salvandoAlgo || !algoMais.trim()}
                      className="shrink-0 px-3 rounded-xl border border-slate-200 text-[12.5px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-default"
                    >
                      {salvandoAlgo ? 'Adicionando...' : 'Adicionar'}
                    </button>
                  </div>
                  <p className="text-[12px] text-slate-500 font-medium mt-1">
                    Entra no e-mail na hora, sem precisar salvar. Para editar, use “Também no dia”, mais abaixo.
                  </p>
                </div>
              )}
            </div>

            {/* ── a prévia do e-mail ───────────────────────────────────── */}
            <div className="min-w-0">
              <p className="text-[12.5px] font-bold text-slate-700 mb-1.5">Como os diretores recebem</p>
              <div className="rounded-xl bg-slate-100/80 p-4">
                {!minhaPrevia || minhaPrevia.secoes.length === 0 ? (
                  <p className="text-xs text-slate-600 font-medium">
                    Nada para contar em {dia} ainda.{' '}
                    {dia === hoje ? 'Sem nada registrado, o seu e-mail não sai hoje.' : 'Sem nada registrado, não há e-mail seu neste dia.'}
                  </p>
                ) : (
                  <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <p className="text-base font-bold text-slate-900 leading-tight">{minhaPrevia.nome}</p>
                    <p className="text-xs font-bold text-indigo-700 mt-0.5">Resumo do dia · {dia}</p>
                    {minhaPrevia.secoes.map(s => (
                      <div key={s.titulo} className="mt-3 pt-2.5 border-t border-slate-100">
                        <p className="text-[12px] font-bold text-slate-500 mb-1">{s.titulo}</p>
                        {s.frases.map((f, i) => (
                          <p key={i} className="text-xs text-slate-800 leading-relaxed">• {f}</p>
                        ))}
                      </div>
                    ))}
                    {(minhaPrevia.acumulado.mes.length > 0 || minhaPrevia.acumulado.ano.length > 0) && (
                      <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-[12.5px] text-slate-600 font-medium space-y-0.5">
                        {minhaPrevia.acumulado.mes.length > 0 && <p><strong className="text-slate-700">No mês:</strong> {minhaPrevia.acumulado.mes.join(' · ')}</p>}
                        {minhaPrevia.acumulado.ano.length > 0 && <p><strong className="text-slate-700">No ano:</strong> {minhaPrevia.acumulado.ano.join(' · ')}</p>}
                      </div>
                    )}
                  </div>
                )}
                {temDoSistema && (
                  <p className="text-[12px] text-slate-600 font-medium mt-2 flex items-start gap-1.5">
                    <Lock className="w-3 h-3 shrink-0 mt-px" />
                    Seleções, vagas e pessoas vêm do que você registrou no sistema. Para corrigir um número, ajuste na própria seleção ou vaga.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* No sistema — o relato de cada pessoa, o MESMO que vai no e-mail das
          18h (mesma função). Só existe para quem pode ler o log
          (Administrador e Coordenador). */}
      {pessoasDoDia && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className={tituloCls}>A equipe no dia</h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5 mb-3">
            O relato de cada pessoa, igual ao e-mail das 18h.
          </p>

          {pessoasDoDia.length === 0 ? (
            <p className="text-xs text-slate-500 font-medium">Nada registrado por ninguém neste dia.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pessoasDoDia.map(p => {
                const aberto = abertos.has(p.email);
                const semNome = p.nome === p.email;
                return (
                  <li key={p.email} className="py-2.5 first:pt-0 last:pb-0">
                    <button
                      onClick={() => alternarPessoa(p.email)}
                      aria-expanded={aberto}
                      className="w-full flex items-center justify-between gap-3 text-left cursor-pointer group"
                    >
                      <span className="min-w-0 flex items-center gap-2">
                        {aberto ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                        <span className="min-w-0">
                          <span className={`block text-sm font-bold truncate ${semNome ? 'text-slate-600' : 'text-slate-800'}`}>{p.nome}</span>
                          {semNome && (
                            // O e-mail das 18h sai com este mesmo texto no assunto.
                            <span className="block text-[12px] font-bold text-amber-700">
                              sem nome no cadastro de usuários
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-bold text-slate-500 tabular-nums group-hover:text-slate-800">
                        {p.acoes} {p.acoes === 1 ? 'ação' : 'ações'} no sistema
                      </span>
                    </button>

                    {aberto && (
                      <div className="mt-3 ml-5.5 space-y-3">
                        {p.secoes.map(s => (
                          <div key={s.titulo}>
                            <p className="text-[12px] font-bold text-slate-500 mb-1">{s.titulo}</p>
                            <ul className="space-y-0.5">
                              {s.frases.map((f, i) => (
                                <li key={i} className="text-xs text-slate-700 leading-relaxed">{f}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                        {(p.acumulado.mes.length > 0 || p.acumulado.ano.length > 0) && (
                          <div className="pt-2 border-t border-slate-100 text-[12.5px] text-slate-600 font-medium space-y-0.5">
                            {p.acumulado.mes.length > 0 && <p><strong className="text-slate-700">No mês:</strong> {p.acumulado.mes.join(' · ')}</p>}
                            {p.acumulado.ano.length > 0 && <p><strong className="text-slate-700">No ano:</strong> {p.acumulado.ano.join(' · ')}</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className={tituloCls}>Seleções</h3>
          {sedes.length > 1 && (
            <FiltroMultiplo
              rotulo="Sede"
              todos="todas"
              opcoes={sedes.map(x => ({ valor: x.nome, rotulo: x.sigla ? `${x.sigla} · ${x.nome}` : x.nome }))}
              selecionados={filtroSede}
              onChange={setFiltroSede}
            />
          )}
        </div>
        <p className="text-sm font-bold text-slate-700 mt-1">{resumoDoDia}</p>
        {contexto.length > 0 && (
          <p className="text-[13px] mt-1.5" style={{ color: 'var(--tinta-3)' }}>
            No mesmo dia, fora de seleção:{' '}
            {contexto.map((c, i) => (
              <React.Fragment key={c.texto}>{i > 0 && ' · '}<Atalho para={c.aba}>{c.texto}</Atalho></React.Fragment>
            ))}
          </p>
        )}

        {motivosDoDia.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-bold text-slate-500">
              Por que desistiram:
            </span>
            {motivosDoDia.map(([motivo, n]) => (
              <span key={motivo}
                className="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-[12px] font-bold text-amber-800">
                {motivo} · {n}
              </span>
            ))}
          </div>
        )}

        {esperando.length > 0 && (
          <div className="mt-4 rounded-lg px-4 py-3" style={{ background: '#FDF3DC' }}>
            <p className="text-[14px] font-bold" style={{ color: '#7A4E0B' }}>
              {esperando.length === 1 ? '1 seleção esperando o resultado' : `${esperando.length} seleções esperando o resultado`}
            </p>
            <ul className="mt-2 space-y-2">
              {esperando.map(x => (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-[14px]">
                  <span><b>{x.cargo}</b> <span style={{ color: 'var(--tinta-2)' }}>· {siglaCanonica(sedes, x.sede) || x.sede} · {x.convocados} convocados</span></span>
                  {acaoDaSelecao(x)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* A aba QUANTI, coluna por coluna */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {doDia.length === 0 ? (
          <div className="py-14 text-center px-6">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-600">
              Nenhuma seleção registrada neste dia{filtroSede.length ? ` em ${rotuloFiltro}` : ''}.
            </p>
            {/* Com filtro ligado, o vazio pode ser do filtro e não do dia —
                dizer isso evita o RH concluir que o dia está em branco. */}
            {filtroSede.length ? (
              <button
                onClick={() => setFiltroSede([])}
                className="text-[12.5px] text-slate-600 font-bold mt-1 underline cursor-pointer hover:text-slate-900"
              >
                Ver todas as sedes deste dia
              </button>
            ) : (
              <p className="text-[12.5px] text-slate-500 font-medium mt-1">
                Use “Agendar seleção” para lançar quem foi chamado — a presença é confirmada depois.
              </p>
            )}
          </div>
        ) : (
          // Sem rolagem de lado (regra de 08/10/2026): sede e responsável viram a
          // 2ª linha do cargo, e em tela estreita cada seleção vira um cartão.
          <table className="w-full tabela-empilha">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className={thCls}>Cargo</th>
                <th className={`${thCls} text-right`}>Convocados</th>
                <th className={`${thCls} text-right`}>Vieram</th>
                <th className={`${thCls} text-right`}>Faltaram</th>
                <th className={`${thCls} text-right`}>Contratados</th>
                <th className={`${thCls} text-right`}>Desistiram</th>
                <th className={thCls}>Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {doDia.map(s => {
                const realizada = ehRealizada(s);
                const motivos = Object.entries(s.motivos || {});
                return (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div>
                        <span className="text-[14.5px] font-bold text-slate-800">{s.cargo}</span>
                        {codigosDasVagas(s).map(codigo => (
                          <span key={codigo} className="ml-1.5"><LinkVaga codigo={codigo} /></span>
                        ))}
                        <span className="etiqueta ml-2">{s.origem === 'pedagogico' ? 'Pedagógico' : 'Geral'}</span>
                        <span className="block text-[12.5px] mt-0.5" style={{ color: 'var(--tinta-3)' }}>
                          {[s.sede, s.responsavel && `RH ${s.responsavel}`].filter(Boolean).join(' · ') || 'sem sede'}
                        </span>
                        <span className="block mt-1">
                          {candidatos && (
                            <button
                              onClick={() => setCandidatosDe(a => (a === s.id ? null : s.id))}
                              aria-expanded={candidatosDe === s.id}
                              className="atalho text-[12.5px] mr-3 cursor-pointer"
                            >
                              {porSelecao.get(s.id)?.length
                                ? `${porSelecao.get(s.id)!.length} candidato(s)`
                                : '+ Candidatos'}
                            </button>
                          )}
                          <Atalho para="selecoesLista" params={{ selecao: s.id }} className="atalho text-[12.5px]" title="Abrir esta seleção na tela de Seleções (dados e candidatos)">
                            Abrir em Seleções
                          </Atalho>
                        </span>
                      </div>
                    </td>
                    <td className={`${numCls} text-slate-800`} data-rotulo="Convocados">{s.convocados}</td>
                    <td className={`${numCls} ${realizada ? 'text-emerald-700' : 'text-slate-300'}`} data-rotulo="Vieram">
                      {realizada ? s.compareceram : '—'}
                    </td>
                    <td className={`${numCls} ${realizada ? 'text-rose-700' : 'text-slate-300'}`} data-rotulo="Faltaram">
                      {realizada ? s.ausentes : '—'}
                    </td>
                    <td className={`${numCls} ${s.contratados ? 'text-sky-700' : 'text-slate-300'}`} data-rotulo="Contratados">
                      {realizada ? (s.contratados || '—') : '—'}
                    </td>
                    <td className={`${numCls} ${s.desistiram ? 'text-amber-700' : 'text-slate-300'}`} data-rotulo="Desistiram">
                      {s.desistiram || '—'}
                    </td>
                    <td className="px-4 py-3" data-rotulo="Situação">
                      <div>
                        {!realizada ? acaoDaSelecao(s) : motivos.length ? (
                          <span className="flex flex-wrap gap-1 max-w-[260px]">
                            {motivos.map(([m, n]) => (
                              <span key={m} title={m}
                                className="inline-block max-w-[170px] truncate px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[12px] font-bold text-amber-800">
                                {m}{n > 1 && ` (${n})`}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="text-[12.5px] text-slate-400">—</span>
                        )}
                        {excluirSelecao && !realizada && (
                          <button
                            onClick={() => excluirSelecao(s)}
                            className="block mt-1.5 text-[12.5px] font-bold cursor-pointer hover:underline"
                            style={{ color: 'var(--atraso)' }}
                          >
                            Excluir seleção
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Candidatos do dia de seleção escolhido na tabela. Bloco próprio, e não
          linha expandida dentro da tabela: ela tem largura mínima e rola de
          lado no celular, e a lista tem campos para preencher. Só existe se o
          dia está na tela — trocar de dia fecha. */}
      {(() => {
        const sel = doDia.find(x => x.id === candidatosDe);
        if (!sel || !salvarCandidato || !registrarCandidatos || !removerCandidato) return null;
        return (
          <CandidatosDoDia
            selecao={sel}
            candidatos={porSelecao.get(sel.id) || []}
            onSalvar={(dados, id) => salvarCandidato(sel, dados, id)}
            onRegistrar={nomes => registrarCandidatos(sel, nomes)}
            onRemover={id => removerCandidato(sel, id)}
            onFechar={() => setCandidatosDe(null)}
            confirmAction={confirmAction}
          />
        );
      })()}

      {/* Também no dia — o que a equipe fez fora das seleções.
          Bloco PRÓPRIO, e não linhas na tabela acima: atividade não tem cargo,
          convocados nem comparecimento, e misturada viraria uma linha de
          colunas vazias contada como seleção do dia. */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className={tituloCls}>Também no dia</h3>
          {adicionarAtividade && !formAtiv && (
            <button
              onClick={abrirAtividade}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-[12.5px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1.5 transition"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Registrar atividade
            </button>
          )}
        </div>

        {formAtiv && (
          <div className="border border-slate-200 rounded-xl p-4 mb-3 space-y-3 bg-slate-50/60">
            <div>
              <label htmlFor="ativ-titulo" className={rotuloCls}>O que foi feito</label>
              <input
                id="ativ-titulo"
                className={campoCls}
                autoFocus
                placeholder="Ex.: Montagem dos kits do Setembro Amarelo"
                value={formAtiv.titulo}
                onChange={e => setFormAtiv(f => f && { ...f, titulo: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="ativ-detalhe" className={rotuloCls}>Detalhe (opcional)</label>
                <input
                  id="ativ-detalhe"
                  className={campoCls}
                  placeholder="Ex.: 120 kits; faltam 30 para Benfica"
                  value={formAtiv.detalhe}
                  onChange={e => setFormAtiv(f => f && { ...f, detalhe: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="ativ-resp" className={rotuloCls}>Responsável (opcional)</label>
                <input
                  id="ativ-resp"
                  className={campoCls}
                  placeholder="Vazio = equipe toda"
                  value={formAtiv.responsavel}
                  onChange={e => setFormAtiv(f => f && { ...f, responsavel: e.target.value })}
                />
              </div>
            </div>
            {erroAtiv && (
              <p role="alert" className="text-[12.5px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {erroAtiv}
              </p>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => { setFormAtiv(null); setErroAtiv(''); }}
                className="px-3 py-2 rounded-xl text-[12.5px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={salvarAtividade}
                disabled={salvandoAtiv}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-[12.5px] font-bold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                {salvandoAtiv ? 'Salvando...' : formAtiv.id ? 'Salvar' : 'Registrar'}
              </button>
            </div>
          </div>
        )}

        {atividadesDoDia.length === 0 ? (
          <p className="text-xs text-slate-500 font-medium">
            Nada registrado além das seleções em {dia}.
            {adicionarAtividade && ' Use "Registrar atividade" para o que a equipe fez fora delas.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {atividadesDoDia.map(a => (
              <li key={a.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">{a.titulo}</p>
                  {a.detalhe && <p className="text-xs text-slate-600 font-medium mt-0.5">{a.detalhe}</p>}
                  {(a.sede || a.responsavel) && (
                    <p className="text-[12.5px] text-slate-500 font-semibold mt-0.5">
                      {[a.sede, a.responsavel].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <span className="flex items-center gap-0.5 shrink-0">
                  {atualizarAtividade && (
                    <button
                      onClick={() => editarAtividade(a)}
                      aria-label={`Editar ${a.titulo}`}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {removerAtividade && (
                    <button
                      onClick={() => apagarAtividade(a)}
                      aria-label={`Remover ${a.titulo}`}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {proximas.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className={`${tituloCls} mb-3`}>Próximas seleções agendadas</h3>
          <div className="space-y-1.5">
            {proximas.map(s => (
              <button
                key={s.id}
                onClick={() => setDiaISO(toISOInput(s.data))}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 cursor-pointer text-left transition"
              >
                <span className="text-sm font-bold text-slate-700 truncate">
                  {s.data} · {s.cargo}
                </span>
                <span className="text-[12.5px] font-bold text-slate-500 shrink-0 tabular-nums">
                  {s.sede} · {s.convocados} convocados
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Agendar seleção: o formulário único, já no dia que está na tela */}
      {agendando && criarSelecao && (
        <ModalSelecao
          titulo="Agendar seleção"
          inicial={formularioVazio({ data: dia, sede: sedeUnica || sedePadrao, responsavel: responsavelPadrao })}
          sedes={sedes}
          vagas={fontes.vagas}
          sugestoes={sugestoesDeSelecoes(fontes.selecoes)}
          comNomes
          rotuloSalvar="Agendar"
          onSalvar={async (campos, nomes) => {
            await criarSelecao(campos, nomes);
            setDiaISO(toISOInput(campos.data));
          }}
          aoFechar={() => setAgendando(false)}
        />
      )}

      {/* Confirmar presença */}
      {confirmando && (
        <Modal
          largura="sm"
          titulo="Confirmar presença"
          antes={<span>{confirmando.titulo}</span>}
          aoFechar={() => setConfirmando(null)}
          rodape={<>
            <button type="button" className="btn" onClick={() => setConfirmando(null)}>Cancelar</button>
            <button type="button" className="btn btn-primario" onClick={salvarConfirmacao} disabled={salvando}>{salvando ? 'Salvando…' : 'Confirmar'}</button>
          </>}
        >
          <label className="block">
            <span className="block text-[13px] font-semibold mb-1">Quantos compareceram? (de {confirmando.convocados} convocados)</span>
            <input id="cf-presentes" type="number" min={0} max={confirmando.convocados} className="campo w-full"
              value={presentes} onChange={e => setPresentes(Number(e.target.value))} autoFocus />
          </label>
          <p className="text-[13px] mt-2" style={{ color: 'var(--tinta-3)' }}>
            Não vieram: <b style={{ color: 'var(--tinta)' }}>{Math.max(0, confirmando.convocados - presentes)}</b> (a conta é do sistema).
          </p>
          {erroConfirmar && (
            <p role="alert" className="mt-3 rounded-md px-3 py-2 text-[13.5px] font-semibold" style={{ background: 'var(--atraso-fundo)', color: 'var(--atraso)' }}>{erroConfirmar}</p>
          )}
        </Modal>
      )}
    </div>
  );
};
