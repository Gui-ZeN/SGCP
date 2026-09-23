import React, { useMemo, useState } from 'react';
import type { Selecao, Vaga, Integracao, Entrevista, Consulta, Experiencia } from '../types';
import type { Sede } from '../hooks/useMetadata';
import type { Atividade } from '../hooks/useAtividades';
import { relatoPorPessoa, TAREFAS_PADRAO, type EntradaLog, type Diario, type Tarefa } from '../utils/resumoDia';
import { siglaCanonica } from '../utils/unidade';
import { montarAgendaDoDia, resumoDeOutrosModulos } from '../utils/agenda';
import { formatDateBR, toISOInput, dataISOLocal } from '../utils/date';
import {
  ehRealizada, estaAtrasada, totaisDeSelecoes, codigosDasVagas,
  validarAgendamento, validarConfirmacao, camposDaConfirmacao,
} from '../utils/selecao';
import {
  Users, ChevronLeft, ChevronRight, ChevronDown, PlusCircle, X, CalendarClock, AlertTriangle, Trash2, Pencil,
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
  /** E-mail de quem está logado — para achar o próprio "Meu dia". */
  emailAtual?: string;
  /** As linhas do log de quem está logado: o "do sistema" do formulário. */
  meuLog?: EntradaLog[];
  vagas: Vaga[];
  integracoes: Integracao[];
  entrevistas: Entrevista[];
  consultas: Consulta[];
  experiencias: Experiencia[];
  /** Ausentes = somente leitura (Visualizador). */
  agendarSelecao?: (dados: Omit<Selecao, 'id'>) => Promise<void>;
  confirmarSelecao?: (id: string, campos: Partial<Selecao>) => Promise<void>;
  sedes?: Sede[];
  /** Sede do usuário — o agendamento já abre nela. Vazio para quem vê todas. */
  sedePadrao?: string;
  /** Nome de quem está logado: quem agenda quase sempre é quem conduz. */
  responsavelPadrao?: string;
}

const campoCls = 'w-full text-sm px-3 py-2.5 border border-slate-200 rounded-xl outline-none bg-white font-medium focus:border-slate-800';
const rotuloCls = 'block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1';
const thCls = 'px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-500';
const numCls = 'px-4 py-3 text-sm font-bold tabular-nums text-right';
/** Título de cada bloco da tela. */
const tituloCls = 'text-sm font-bold text-slate-900';

/** Soma dias a uma data ISO (YYYY-MM-DD) sem passar por fuso. */
function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  return dataISOLocal(new Date(a, m - 1, d + dias));
}

export const SelecoesSection: React.FC<SelecoesSectionProps> = (props) => {
  const {
    agendarSelecao, confirmarSelecao, sedes = [], sedePadrao = '', responsavelPadrao = '',
    atividades = [], adicionarAtividade, atualizarAtividade, removerAtividade, confirmAction,
    logs, usuarios = [], diarios = [], salvarMeuDia, emailAtual = '', meuLog = [],
    tarefas = TAREFAS_PADRAO, criarTarefa, ajustarTarefa,
    ...fontes
  } = props;
  const [diaISO, setDiaISO] = useState(() => dataISOLocal());
  const hojeISO = dataISOLocal();

  const [abrindoAgenda, setAbrindoAgenda] = useState(false);
  const [form, setForm] = useState({
    dataISO: '', cargo: '', sede: '', convocados: 0, responsavel: '', vagaIds: [] as string[],
  });
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

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
  const [filtroSede, setFiltroSede] = useState('TODAS');

  const naSede = useMemo(() => {
    if (filtroSede === 'TODAS') return () => true;
    const alvo = siglaCanonica(sedes, filtroSede);
    return (s: Selecao) => siglaCanonica(sedes, s.sede) === alvo;
  }, [filtroSede, sedes]);

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
    const alvo = filtroSede === 'TODAS' ? null : siglaCanonica(sedes, filtroSede);
    return atividades.filter(a =>
      (a.data || '').trim() === dia &&
      (!alvo || !(a.sede || '').trim() || siglaCanonica(sedes, a.sede) === alvo)
    );
  }, [atividades, dia, filtroSede, sedes]);

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
          sede: filtroSede === 'TODAS' ? (sedePadrao || '') : filtroSede,
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
      await adicionarAtividade({ titulo, data: dia, sede: filtroSede === 'TODAS' ? (sedePadrao || '') : filtroSede, responsavel: responsavelPadrao || '' });
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
  const contexto = useMemo(
    () => resumoDeOutrosModulos(montarAgendaDoDia(dia, fontes).resumo),
    [dia, fontes]
  );

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

  const vagasAbertas = useMemo(
    () => fontes.vagas
      .filter(v => ['ABERTA', 'REABERTA', 'DOCUMENTAÇÃO'].includes(v.status))
      .sort((a, b) => a.vaga.localeCompare(b.vaga, 'pt-BR')),
    [fontes.vagas]
  );

  /**
   * Vagas da sede escolhida. Comparação pela SIGLA CANÔNICA, não pela string:
   * o campo `sede` das vagas mistura nome e sigla da mesma unidade ("DT" e
   * "DIONISIO TORRES"), e comparar cru esconderia metade das vagas do lugar.
   */
  const vagasDaSede = useMemo(() => {
    if (!form.sede) return [];
    const alvo = siglaCanonica(sedes, form.sede);
    return vagasAbertas.filter(v => siglaCanonica(sedes, v.sede) === alvo);
  }, [vagasAbertas, sedes, form.sede]);

  const abrirAgendamento = (dataInicial = diaISO) => {
    // Sede e responsável já vêm de quem está logado: o RH agenda para a própria
    // sede e conduz a própria seleção. Ambos continuam editáveis.
    setForm({
      dataISO: dataInicial, cargo: '', sede: sedePadrao, convocados: 0,
      responsavel: responsavelPadrao, vagaIds: [],
    });
    setErros([]);
    setAbrindoAgenda(true);
  };

  /** Trocar a sede invalida as vagas marcadas — eram de outro lugar. */
  const escolherSede = (sede: string) => {
    setForm(f => ({ ...f, sede, vagaIds: [], cargo: f.vagaIds.length ? '' : f.cargo }));
  };

  /**
   * Marca/desmarca uma vaga. O cargo só é preenchido sozinho quando todas as
   * vagas marcadas têm o MESMO cargo — é o caso comum (2 vagas de ASG, uma
   * seleção). Com cargos diferentes o campo fica para quem está agendando: o
   * sistema não tem como saber se o dia é de "ASG" ou de "ASG e Porteiro".
   */
  const alternarVaga = (vagaId: string) => {
    setForm(f => {
      const vagaIds = f.vagaIds.includes(vagaId)
        ? f.vagaIds.filter(id => id !== vagaId)
        : [...f.vagaIds, vagaId];
      const cargos = [...new Set(
        vagaIds.map(id => vagasDaSede.find(v => v.id === id)?.vaga).filter(Boolean)
      )];
      return { ...f, vagaIds, cargo: cargos.length === 1 ? cargos[0]! : f.cargo };
    });
  };

  const salvarAgendamento = async () => {
    const data = formatDateBR(form.dataISO);
    const problemas = validarAgendamento({ data, cargo: form.cargo, sede: form.sede, convocados: form.convocados });
    setErros(problemas);
    if (problemas.length || !agendarSelecao) return;

    const escolhidas = vagasDaSede.filter(v => form.vagaIds.includes(v.id));
    setSalvando(true);
    try {
      await agendarSelecao({
        data,
        cargo: form.cargo.trim(),
        sede: form.sede.trim(),
        responsavel: form.responsavel.trim(),
        origem: 'geral',
        status: 'agendado',
        convocados: form.convocados,
        compareceram: 0,
        ausentes: 0,
        contratados: 0,
        desistiram: 0,
        ...(escolhidas.length
          ? { vagaIds: escolhidas.map(v => v.id), vagaCodigos: escolhidas.map(v => Number(v.codigo)) }
          : {}),
      });
      setAbrindoAgenda(false);
      setDiaISO(form.dataISO);
    } catch (e: any) {
      setErros([`Não foi possível agendar: ${e?.message || e}`]);
    } finally {
      setSalvando(false);
    }
  };

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
    ? `Nenhuma seleção neste dia${filtroSede === 'TODAS' ? '' : ` em ${filtroSede}`}.`
    : [
        totais.convocados > 0 &&
          `${totais.convocados} convocados · ${totais.compareceram} compareceram${totais.taxa !== null ? ` · ${totais.taxa}%` : ''}`,
        totais.aConfirmar > 0 &&
          `${convocadosAConfirmar} convocados em ${totais.aConfirmar === 1 ? '1 seleção' : `${totais.aConfirmar} seleções`} a confirmar`,
      ].filter(Boolean).join(' · ');

  const cards = [
    { n: totais.convocados, t: 'Convocados', cor: 'text-slate-800' },
    { n: totais.compareceram, t: 'Compareceram', cor: 'text-emerald-600' },
    { n: totais.ausentes, t: 'Ausentes', cor: 'text-rose-600' },
    { n: totais.contratados, t: 'Contratados', cor: 'text-sky-600' },
    { n: totais.desistiram, t: 'Desistiram', cor: 'text-amber-600' },
    ...(totais.aConfirmar > 0
      ? [{ n: convocadosAConfirmar, t: 'A confirmar', cor: 'text-amber-600' }]
      : []),
  ];

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-850 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-500" />
            Resumo do Dia
          </h2>
          {/* O dia vale para a tela inteira — Meu dia, equipe e seleções —, por
              isso mora aqui, e não dentro do bloco de seleções. */}
          <p className="text-sm text-slate-500 font-semibold mt-1 first-letter:uppercase">
            {nomeDoDia}{diaISO === hojeISO && ' · hoje'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          <button
            onClick={() => setDiaISO(d => somarDias(d, -1))}
            aria-label="Dia anterior"
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 cursor-pointer transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={toISOInput(dia)}
            onChange={e => e.target.value && setDiaISO(e.target.value)}
            aria-label="Escolher o dia"
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer outline-none focus:border-slate-800"
          />
          <button
            onClick={() => setDiaISO(d => somarDias(d, 1))}
            aria-label="Próximo dia"
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 cursor-pointer transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {diaISO !== hojeISO && (
            <button
              onClick={() => setDiaISO(hojeISO)}
              className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition"
            >
              Hoje
            </button>
          )}
          {agendarSelecao && (
            <button
              onClick={() => abrirAgendamento()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-slate-900/15 transition"
            >
              <PlusCircle className="w-4 h-4" /> Agendar seleção
            </button>
          )}
        </div>
      </div>

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
                  className="px-2 py-1 bg-white border border-amber-200 rounded-lg text-[10px] font-bold text-amber-800 hover:bg-amber-100 cursor-pointer transition"
                >
                  {s.data} · {s.cargo}
                </button>
              ))}
              {atrasadas.length > 6 && (
                <span className="px-2 py-1 text-[10px] font-bold text-amber-700">
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
                <p className="text-[11px] font-bold text-slate-700">O que o sistema não vê</p>
                {ajustarTarefa && (
                  <button
                    type="button"
                    onClick={() => setGerenciando(g => !g)}
                    className="text-[10px] font-bold uppercase tracking-wide text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    {gerenciando ? 'Concluir' : 'Gerenciar tarefas'}
                  </button>
                )}
              </div>

              {/* Gerenciar (Admin/Coordenador): renomear e arquivar. Arquivar,
                  nunca apagar — a arquivada ainda nomeia o que já foi contado. */}
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
                        className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        {t.arquivada ? 'Reativar' : 'Arquivar'}
                      </button>
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
                        <span className="block text-[11px] font-bold text-slate-700 leading-snug min-h-[2.75em]">{t.nome}</span>
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
                      <span role="status" className="text-[11px] font-bold text-amber-700">
                        Não salvo — a prévia já mostra, o e-mail ainda não.
                      </span>
                    ) : avisoMeuDia ? (
                      <span role="status" className={`text-[11px] font-bold ${avisoMeuDia === 'Salvo.' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {avisoMeuDia}
                      </span>
                    ) : meuDiarioSalvo ? (
                      <span className="text-[11px] font-bold text-emerald-700">Salvo.</span>
                    ) : null}
                    <button
                      onClick={salvarMeuDiaAgora}
                      disabled={salvandoMeuDia || !mudouMeuDia}
                      className="px-4 py-2 rounded-xl bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-default"
                    >
                      {salvandoMeuDia ? 'Salvando...' : 'Salvar contagens'}
                    </button>
                  </div>
                </>
              )}

              {/* Tarefa nova — de qualquer pessoa do RH, para a equipe toda. */}
              {criarTarefa && !gerenciando && (
                <div className="mt-4">
                  <label htmlFor="nova-tarefa" className="block text-[11px] font-bold text-slate-700 mb-1.5">
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
                      className="shrink-0 px-3 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-default"
                    >
                      Criar
                    </button>
                  </div>
                  {erroTarefa
                    ? <p role="alert" className="text-[11px] font-semibold text-rose-700 mt-1">{erroTarefa}</p>
                    : <p className="text-[10px] text-slate-500 font-medium mt-1">Vira um contador para toda a equipe do RH.</p>}
                </div>
              )}

              {adicionarAtividade && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <label htmlFor="algo-mais" className="block text-[11px] font-bold text-slate-700 mb-1.5">Algo mais</label>
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
                      className="shrink-0 px-3 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-default"
                    >
                      {salvandoAlgo ? 'Adicionando...' : 'Adicionar'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium mt-1">
                    Entra no e-mail na hora, sem precisar salvar. Para editar, use “Também no dia”, mais abaixo.
                  </p>
                </div>
              )}
            </div>

            {/* ── a prévia do e-mail ───────────────────────────────────── */}
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-700 mb-1.5">Como os diretores recebem</p>
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
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{s.titulo}</p>
                        {s.frases.map((f, i) => (
                          <p key={i} className="text-xs text-slate-800 leading-relaxed">• {f}</p>
                        ))}
                      </div>
                    ))}
                    {(minhaPrevia.acumulado.mes.length > 0 || minhaPrevia.acumulado.ano.length > 0) && (
                      <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-[11px] text-slate-600 font-medium space-y-0.5">
                        {minhaPrevia.acumulado.mes.length > 0 && <p><strong className="text-slate-700">No mês:</strong> {minhaPrevia.acumulado.mes.join(' · ')}</p>}
                        {minhaPrevia.acumulado.ano.length > 0 && <p><strong className="text-slate-700">No ano:</strong> {minhaPrevia.acumulado.ano.join(' · ')}</p>}
                      </div>
                    )}
                  </div>
                )}
                {temDoSistema && (
                  <p className="text-[10px] text-slate-600 font-medium mt-2 flex items-start gap-1.5">
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
                            <span className="block text-[10px] font-bold uppercase tracking-wide text-amber-700">
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
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{s.titulo}</p>
                            <ul className="space-y-0.5">
                              {s.frases.map((f, i) => (
                                <li key={i} className="text-xs text-slate-700 leading-relaxed">{f}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                        {(p.acumulado.mes.length > 0 || p.acumulado.ano.length > 0) && (
                          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 font-medium space-y-0.5">
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
            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="filtro-sede" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Sede
              </label>
              <select
                id="filtro-sede"
                value={filtroSede}
                onChange={e => setFiltroSede(e.target.value)}
                className="text-xs px-3 py-1.5 border border-slate-200 rounded-xl bg-white font-bold text-slate-700 outline-none focus:border-slate-800 cursor-pointer"
              >
                <option value="TODAS">Todas as sedes</option>
                {sedes.map(s => <option key={s.nome} value={s.nome}>{s.nome}</option>)}
              </select>
            </div>
          )}
        </div>
        <p className="text-sm font-bold text-slate-700 mt-1">{resumoDoDia}</p>
        {contexto && (
          <p className="text-[11px] text-slate-500 font-semibold mt-1.5">
            No mesmo dia, fora de seleção: {contexto}.
          </p>
        )}

        {motivosDoDia.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Por que desistiram:
            </span>
            {motivosDoDia.map(([motivo, n]) => (
              <span key={motivo}
                className="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-800">
                {motivo} · {n}
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2.5 mt-4">
          {cards.map(c => (
            <div key={c.t} className="bg-slate-50 rounded-xl p-3 text-center">
              <span className={`block text-xl font-black ${c.n ? c.cor : 'text-slate-300'}`}>{c.n}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{c.t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* A aba QUANTI, coluna por coluna */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {doDia.length === 0 ? (
          <div className="py-14 text-center px-6">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-600">
              Nenhuma seleção registrada neste dia{filtroSede === 'TODAS' ? '' : ` em ${filtroSede}`}.
            </p>
            {/* Com filtro ligado, o vazio pode ser do filtro e não do dia —
                dizer isso evita o RH concluir que o dia está em branco. */}
            {filtroSede !== 'TODAS' ? (
              <button
                onClick={() => setFiltroSede('TODAS')}
                className="text-[11px] text-slate-600 font-bold mt-1 underline cursor-pointer hover:text-slate-900"
              >
                Ver todas as sedes deste dia
              </button>
            ) : (
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                Use “Agendar seleção” para lançar quem foi chamado — a presença é confirmada depois.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className={thCls}>Cargo</th>
                  <th className={thCls}>Sede</th>
                  <th className={thCls}>Responsável RH</th>
                  <th className={`${thCls} text-right`}>Convocados</th>
                  <th className={`${thCls} text-right`}>Compareceram</th>
                  <th className={`${thCls} text-right`}>Ausentes</th>
                  <th className={`${thCls} text-right`}>Contratados</th>
                  <th className={`${thCls} text-right`}>Desistiram</th>
                  {/* Presa à direita: em linha larga a tabela rola, e a ação do
                      dia não pode ser justamente o que sai da tela. */}
                  <th className={`${thCls} sticky right-0 bg-slate-50 border-l border-slate-200`}>
                    Motivo / situação
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {doDia.map(s => {
                  const realizada = ehRealizada(s);
                  const motivos = Object.entries(s.motivos || {});
                  return (
                    <tr key={s.id} className="group hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold text-slate-800">{s.cargo}</span>
                        {codigosDasVagas(s).map(codigo => (
                          <span key={codigo} className="ml-1.5 text-[10px] font-bold text-slate-500 tabular-nums">
                            #{codigo}
                          </span>
                        ))}
                        <span className={`ml-2 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                          s.origem === 'pedagogico'
                            ? 'bg-violet-50 text-violet-700 border-violet-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {s.origem === 'pedagogico' ? 'Pedagógico' : 'Geral'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-700">{s.sede || '—'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-700">{s.responsavel || '—'}</td>
                      <td className={`${numCls} text-slate-800`}>{s.convocados}</td>
                      <td className={`${numCls} ${realizada ? 'text-emerald-700' : 'text-slate-300'}`}>
                        {realizada ? s.compareceram : '—'}
                      </td>
                      <td className={`${numCls} ${realizada ? 'text-rose-700' : 'text-slate-300'}`}>
                        {realizada ? s.ausentes : '—'}
                      </td>
                      <td className={`${numCls} ${s.contratados ? 'text-sky-700' : 'text-slate-300'}`}>
                        {realizada ? (s.contratados || '—') : '—'}
                      </td>
                      <td className={`${numCls} ${s.desistiram ? 'text-amber-700' : 'text-slate-300'}`}>
                        {s.desistiram || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap sticky right-0 bg-white group-hover:bg-slate-50 border-l border-slate-100">
                        {!realizada ? (
                          confirmarSelecao ? (
                            <button
                              onClick={() => abrirConfirmacao(s)}
                              title="Registrar quantos apareceram"
                              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition"
                            >
                              Confirmar
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                              <CalendarClock className="w-3 h-3" /> Agendada
                            </span>
                          )
                        ) : motivos.length ? (
                          <span className="flex flex-wrap gap-1 max-w-[280px] whitespace-normal">
                            {motivos.map(([m, n]) => (
                              <span key={m} title={m}
                                className="inline-block max-w-[170px] truncate px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-800">
                                {m}{n > 1 && ` (${n})`}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1.5 transition"
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
              <p role="alert" className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {erroAtiv}
              </p>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => { setFormAtiv(null); setErroAtiv(''); }}
                className="px-3 py-2 rounded-xl text-[11px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={salvarAtividade}
                disabled={salvandoAtiv}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
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
                    <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
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
                <span className="text-[11px] font-bold text-slate-500 shrink-0 tabular-nums">
                  {s.sede} · {s.convocados} convocados
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Agendar seleção */}
      {abrindoAgenda && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div role="dialog" aria-modal="true" aria-labelledby="ag-titulo"
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 id="ag-titulo" className="text-sm font-bold text-slate-800">Agendar seleção</h3>
              <button onClick={() => setAbrindoAgenda(false)} aria-label="Fechar"
                className="w-8 h-8 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              {/* A sede vem PRIMEIRO: é ela que decide quais vagas existem. */}
              <div>
                <label htmlFor="ag-sede" className={rotuloCls}>Sede *</label>
                {sedes.length > 0 ? (
                  <select id="ag-sede" className={campoCls} value={form.sede} onChange={e => escolherSede(e.target.value)}>
                    <option value="">Selecione…</option>
                    {sedes.map(s => <option key={s.nome} value={s.nome}>{s.nome}</option>)}
                  </select>
                ) : (
                  <input id="ag-sede" className={campoCls} value={form.sede} onChange={e => escolherSede(e.target.value)} />
                )}
              </div>

              <fieldset>
                <legend className={rotuloCls}>Vagas atendidas (opcional)</legend>
                {!form.sede ? (
                  <p className="text-[11px] text-slate-500 font-semibold py-2">
                    Escolha a sede para ver as vagas abertas dela.
                  </p>
                ) : vagasDaSede.length === 0 ? (
                  <p className="text-[11px] text-slate-500 font-semibold py-2">
                    Nenhuma vaga aberta nesta sede — dá para agendar sem vaga.
                  </p>
                ) : (
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-44 overflow-y-auto">
                    {vagasDaSede.map(v => (
                      <label key={v.id}
                        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-slate-50">
                        <input type="checkbox" checked={form.vagaIds.includes(v.id)}
                          onChange={() => alternarVaga(v.id)}
                          className="w-4 h-4 accent-slate-900 cursor-pointer shrink-0" />
                        <span className="text-[11px] font-bold text-slate-500 tabular-nums shrink-0">#{v.codigo}</span>
                        <span className="text-sm font-semibold text-slate-700 truncate">{v.vaga}</span>
                        {v.setor && (
                          <span className="text-[10px] font-semibold text-slate-500 truncate ml-auto shrink-0">{v.setor}</span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-slate-500 font-semibold mt-1">
                  {form.vagaIds.length > 1
                    ? `${form.vagaIds.length} vagas neste mesmo dia — os convocados valem para todas elas.`
                    : 'Dá para marcar mais de uma: chamar 20 pessoas para as 2 vagas de ASG é uma seleção só.'}
                </p>
              </fieldset>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ag-data" className={rotuloCls}>Data *</label>
                  <input id="ag-data" type="date" className={`${campoCls} cursor-pointer`}
                    value={form.dataISO} onChange={e => setForm(f => ({ ...f, dataISO: e.target.value }))} />
                </div>
                <div>
                  <label htmlFor="ag-convocados" className={rotuloCls}>Convocados *</label>
                  <input id="ag-convocados" type="number" min={1} className={campoCls}
                    value={form.convocados || ''} onChange={e => setForm(f => ({ ...f, convocados: Number(e.target.value) }))} />
                </div>
              </div>

              <div>
                <label htmlFor="ag-cargo" className={rotuloCls}>Cargo *</label>
                <input id="ag-cargo" className={campoCls} placeholder="Ex.: Professor(a)…"
                  value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} />
              </div>

              <div>
                <label htmlFor="ag-responsavel" className={rotuloCls}>Responsável (RH)</label>
                <input id="ag-responsavel" className={campoCls}
                  value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} />
              </div>

              {erros.length > 0 && (
                <ul role="alert" className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-3.5 py-2.5 text-[11px] font-semibold space-y-1">
                  {erros.map(e => <li key={e}>{e}</li>)}
                </ul>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setAbrindoAgenda(false)}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold rounded-xl text-slate-650 cursor-pointer">
                Cancelar
              </button>
              <button onClick={salvarAgendamento} disabled={salvando}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-bold rounded-xl text-white shadow-md cursor-pointer disabled:opacity-60">
                {salvando ? 'Agendando…' : 'Agendar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar presença */}
      {confirmando && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div role="dialog" aria-modal="true" aria-labelledby="cf-titulo"
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 bg-slate-50 border-b border-slate-100">
              <h3 id="cf-titulo" className="text-sm font-bold text-slate-800">Confirmar presença</h3>
              <p className="text-[11px] text-slate-600 font-semibold mt-0.5">{confirmando.titulo}</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="cf-presentes" className={rotuloCls}>
                  Quantos compareceram? (de {confirmando.convocados} convocados)
                </label>
                <input id="cf-presentes" type="number" min={0} max={confirmando.convocados} className={campoCls}
                  value={presentes} onChange={e => setPresentes(Number(e.target.value))} />
                <p className="text-[10px] text-slate-500 font-semibold mt-1">
                  Ausentes: <strong>{Math.max(0, confirmando.convocados - presentes)}</strong> — calculado, não digitado.
                </p>
              </div>

              {erroConfirmar && (
                <p role="alert" className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-3.5 py-2.5 text-[11px] font-semibold">
                  {erroConfirmar}
                </p>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setConfirmando(null)}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold rounded-xl text-slate-650 cursor-pointer">
                Cancelar
              </button>
              <button onClick={salvarConfirmacao} disabled={salvando}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-bold rounded-xl text-white shadow-md cursor-pointer disabled:opacity-60">
                {salvando ? 'Salvando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
