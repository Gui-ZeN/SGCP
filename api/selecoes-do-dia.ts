/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Disparo do "Resumo do dia" — 18h de Fortaleza, pelo cron da Vercel.
 *
 * UM e-mail por colaborador do RH que trabalhou no dia, todos para a lista de
 * diretores configurada. É o relato do dia em frases — "Conduziu a seleção de
 * ASG em Dionísio Torres: 3 convocados, 1 compareceu" —, montado a partir do
 * log de auditoria e do "Meu dia" que a pessoa preenche. Desenho combinado na
 * reunião de 22/09/2026 com a direção.
 *
 * VARIÁVEIS DE AMBIENTE (painel da Vercel; nenhuma entra no repositório):
 *   CRON_SECRET                 segredo que a Vercel envia no Authorization
 *   SMTP_USER                   e-mail remetente
 *   SMTP_APP_PASSWORD           senha de APP do Gmail (não a senha da conta)
 *   GOOGLE_SERVICE_ACCOUNT_JSON conta de serviço com leitura no Firestore do SGPC
 *
 * DUAS TRAVAS, porque um endpoint de e-mail aberto na internet é um relay:
 *  1. só responde a quem apresenta o CRON_SECRET;
 *  2. os destinatários vêm do Firestore, NUNCA do corpo da requisição — mesmo
 *     que alguém passe da trava 1, não consegue mandar e-mail para fora da
 *     lista que o admin configurou.
 *
 * A conta de serviço é necessária porque o cron roda sem usuário logado: não há
 * token de ninguém para o Firestore autorizar. Precisa de LEITURA (logs,
 * diario, usuarios, config) e de ESCRITA em `config/notificacoes`, onde cada
 * execução deixa o registro do que fez — `roles/datastore.user`.
 */
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';

/**
 * TUDO NESTE ARQUIVO, de propósito.
 *
 * A primeira versão importava o construtor do e-mail de `../src/utils/`. A
 * Vercel TRANSPILA a função em vez de empacotar: o arquivo de fora nunca
 * chegou ao servidor e o cron das 18h de 17/09/2026 morreu com
 * `ERR_MODULE_NOT_FOUND: /var/task/src/utils/emailSelecoes`. Falhou sem
 * enviar e sem ninguém notar — a evidência de um e-mail que não chega é
 * nenhuma.
 *
 * O preço é a duplicação do relato por pessoa, que também vive em
 * `src/utils/resumoDia.ts` para a tela. O teste `relato concorda com a tela`
 * fica de guarda contra as duas cópias divergirem.
 */

// ═══ O relato de cada pessoa ══════════════════════════════════════════════
// CÓPIA de src/utils/resumoDia.ts, colada sem edição. Mudou lá, cola aqui de
// novo — o teste `relato concorda com a tela` falha se as duas divergirem.
export type Ref = Record<string, string | number | undefined>;

export interface EntradaLog {
  timestamp: string; // ISO, UTC
  usuario: string;   // e-mail de quem fez
  acao: string;      // CRIOU | ALTEROU | EXCLUIU | SINALIZOU
  modulo: string;
  detalhes: string;
  /** Campos da ação. Ausente nos registros anteriores a 22/09/2026. */
  ref?: Ref;
}

/**
 * Uma tarefa do "Meu dia" — o que o SGPC não registra sozinho.
 *
 * A lista é da EQUIPE, não de cada pessoa: qualquer uma cria uma tarefa nova
 * e ela aparece para todas. Nome igual entre as pessoas é o que faz o
 * acumulado somar — com listas individuais, "Atendimento", "atendimentos" e
 * "Atend." virariam três tarefas. Arquivada some do formulário mas continua
 * dando nome ao que já foi contado nela.
 */
export interface Tarefa {
  id: string;
  nome: string;
  arquivada?: boolean;
  /** Posição no formulário; sem ela, a ordem de criação. */
  ordem?: number;
}

/**
 * As quatro que nasceram da reunião de 22/09/2026 com a direção. Vivem no
 * código para o formulário nunca abrir vazio; um documento com o MESMO id na
 * coleção `tarefasDiario` renomeia ou arquiva a padrão.
 */
export const TAREFAS_PADRAO: Tarefa[] = [
  { id: 'atendimentos', nome: 'Atendimentos a colaboradores', ordem: 1 },
  { id: 'testes', nome: 'Testes psicológicos aplicados', ordem: 2 },
  { id: 'divulgacoes', nome: 'Vagas divulgadas', ordem: 3 },
  { id: 'acolhimentos', nome: 'Novos colaboradores acolhidos', ordem: 4 },
];

/** As padrão mescladas com as da equipe — o documento do banco vence. */
export function listaDeTarefas(daEquipe: Tarefa[]): Tarefa[] {
  const porId = new Map(TAREFAS_PADRAO.map(t => [t.id, t]));
  for (const t of daEquipe) porId.set(t.id, { ...porId.get(t.id), ...t });
  return [...porId.values()].sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** O que a pessoa informou à mão num dia: tarefa → quantidade. */
export interface Diario {
  email: string;
  data: string; // DD/MM/AAAA
  contagens?: Record<string, number>;
}

export interface Secao { titulo: string; frases: string[] }

export interface RelatoPessoa {
  email: string;
  /** Nome do cadastro de usuários; sem ele, o próprio e-mail. */
  nome: string;
  /** Ações registradas no sistema no dia. */
  acoes: number;
  secoes: Secao[];
  /** "No mês" e "No ano": só o que é diferente de zero. */
  acumulado: { mes: string[]; ano: string[] };
}

// ─── datas ──────────────────────────────────────────────────────────────────

/** DD/MM/AAAA de um instante, no fuso de Fortaleza (UTC-3, sem verão). */
export function diaEmFortaleza(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Fortaleza', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(d);
}

const mesAno = (dia: string) => dia.slice(3);  // MM/AAAA
const ano = (dia: string) => dia.slice(6);     // AAAA

// ─── português ──────────────────────────────────────────────────────────────

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** "A", "A e B", "A, B e C". */
function enumerar(itens: string[]): string {
  const limpos = itens.map(s => s.trim()).filter(Boolean);
  if (limpos.length <= 1) return limpos[0] || '';
  return `${limpos.slice(0, -1).join(', ')} e ${limpos[limpos.length - 1]}`;
}

/** Nomes demais viram "A, B, C e mais 4" — a frase não pode virar lista. */
function enumerarComTeto(itens: string[], teto = 4): string {
  const unicos = [...new Set(itens.map(s => s.trim()).filter(Boolean))];
  if (unicos.length <= teto) return enumerar(unicos);
  return `${unicos.slice(0, teto).join(', ')} e mais ${unicos.length - teto}`;
}

/** "DIONISIO TORRES" → "Dionisio Torres". Sigla curta (DT, BS) fica como está. */
function titulo(t: unknown): string {
  const s = String(t ?? '').trim();
  if (!s || s.length <= 3) return s;
  return s.toLowerCase().replace(/(^|[\s/(-])(\p{L})/gu, (_, sep, l) => sep + l.toUpperCase())
    .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, m => m.toLowerCase());
}

const txt = (r: Ref | undefined, k: string) => String(r?.[k] ?? '').trim();
const num = (r: Ref | undefined, k: string) => {
  const n = Number(r?.[k]);
  return Number.isFinite(n) ? n : 0;
};

// ─── classificação ─────────────────────────────────────────────────────────

/**
 * A seleção só ganhou módulo próprio no log em 22/09/2026; antes ela ia como
 * "Vagas", e só o começo do texto a distingue de uma alteração de vaga.
 */
function ehSelecao(e: EntradaLog): boolean {
  if (e.modulo === 'Seleções') return true;
  return e.modulo === 'Vagas' && /^(Seleção agendada|Presença confirmada)/.test(e.detalhes || '');
}

/**
 * Configurar usuário, sede ou cargo é manutenção do sistema, não trabalho do RH
 * para a direção ler — fica fora do relato, e não faz ninguém "trabalhar no dia".
 */
const CADASTROS = new Set(['Usuários', 'Sedes', 'Cargos', 'Setores', 'Regiões']);
const ehImportacao = (e: EntradaLog) =>
  e.ref?.tipo === 'importacao' || /^(Import|Importação)/.test(e.detalhes || '');

// ─── as frases ─────────────────────────────────────────────────────────────

/** Lançamentos do módulo Seleções que não são conduzir/agendar no dia. */
const REGISTRO_DE_TELA = new Set(['edicao', 'lancamento']);

function frasesDeSelecao(es: EntradaLog[], dia: string): string[] {
  const frases: string[] = [];
  // Correção feita no módulo Seleções (cargo, setor, números da planilha): não
  // é conduzir a seleção — sem separar, o e-mail diria "Conduziu" a cada ajuste.
  // Idem para a seleção lançada DEPOIS do fato (a planilha no sistema): quem
  // lança hoje a seleção de semana passada não a "conduziu" hoje.
  const edicoes = es.filter(e => e.ref?.tipo === 'edicao').length;
  const lancadas = es.filter(e => e.ref?.tipo === 'lancamento').length;
  const conduzidas = es.filter(e => e.acao === 'ALTEROU' && !REGISTRO_DE_TELA.has(String(e.ref?.tipo)));
  const agendadas = es.filter(e => e.acao === 'CRIOU' && !REGISTRO_DE_TELA.has(String(e.ref?.tipo)));

  for (const e of conduzidas) {
    if (!e.ref) continue;
    const conv = num(e.ref, 'convocados');
    const comp = num(e.ref, 'compareceram');
    const onde = txt(e.ref, 'sede') ? ` em ${titulo(e.ref.sede)}` : '';
    // Zero de comparecimento é dito com todas as letras. Foi a queixa do
    // primeiro relatório ("oito horas esperando três pessoas que não vieram"),
    // e esconder isso não ajuda ninguém a resolver.
    const quantos = comp === 0
      ? `${plural(conv, 'convocado', 'convocados')}, nenhum compareceu`
      : `${plural(conv, 'convocado', 'convocados')}, ${comp} ${comp === 1 ? 'compareceu' : 'compareceram'}`;
    frases.push(`Conduziu a seleção de ${titulo(e.ref.cargo)}${onde}: ${quantos}.`);
  }
  const semRefConduzidas = conduzidas.filter(e => !e.ref).length;
  if (semRefConduzidas) frases.push(`Registrou o comparecimento de ${plural(semRefConduzidas, 'seleção', 'seleções')}.`);

  for (const e of agendadas) {
    if (!e.ref) continue;
    const quando = txt(e.ref, 'data') === dia ? 'para hoje' : `para ${txt(e.ref, 'data')}`;
    const onde = txt(e.ref, 'sede') ? ` em ${titulo(e.ref.sede)}` : '';
    frases.push(`Agendou ${quando} a seleção de ${titulo(e.ref.cargo)}${onde}, com ${plural(num(e.ref, 'convocados'), 'convocado', 'convocados')}.`);
  }
  const semRefAgendadas = agendadas.filter(e => !e.ref).length;
  if (semRefAgendadas) frases.push(`Agendou ${plural(semRefAgendadas, 'seleção', 'seleções')}.`);
  if (lancadas) frases.push(`Lançou ${plural(lancadas, 'seleção já realizada', 'seleções já realizadas')} no sistema.`);
  if (edicoes) frases.push(`Corrigiu os dados de ${plural(edicoes, 'seleção', 'seleções')}.`);
  return frases;
}

/**
 * Candidatos lançados no dia, UMA frase por seleção. Cada candidato salvo é
 * uma linha no log; uma frase por linha viraria lista de chamada no e-mail.
 * ⚠️ Só a contagem: nome de candidato e resultado de teste psicológico nunca
 * vão para o e-mail — o log só guarda cargo, data e o id do candidato.
 */
function frasesDeCandidatos(es: EntradaLog[]): string[] {
  const porSelecao = new Map<string, { cargo: string; data: string; novos: Set<string>; resultados: Set<string> }>();
  let semRef = 0;
  for (const e of es) {
    if (!e.ref) { semRef++; continue; }
    const k = `${txt(e.ref, 'cargo')}|${txt(e.ref, 'data')}`;
    const g = porSelecao.get(k) || { cargo: txt(e.ref, 'cargo'), data: txt(e.ref, 'data'), novos: new Set<string>(), resultados: new Set<string>() };
    // Por candidato, não por linha: lançar e corrigir o resultado da mesma
    // pessoa duas vezes é um resultado lançado, não dois.
    const quem = txt(e.ref, 'candidato') || String(g.novos.size + g.resultados.size);
    if (e.acao === 'CRIOU') g.novos.add(quem);
    else if (e.acao === 'ALTEROU') g.resultados.add(quem);
    porSelecao.set(k, g);
  }
  const frases: string[] = [];
  for (const g of porSelecao.values()) {
    const naSelecao = `na seleção de ${titulo(g.cargo)}${g.data ? ` de ${g.data}` : ''}`;
    if (g.novos.size) frases.push(`Registrou ${plural(g.novos.size, 'candidato', 'candidatos')} ${naSelecao}.`);
    // Quem acabou de ser registrado e já teve o resultado lançado conta uma vez.
    const soResultado = [...g.resultados].filter(id => !g.novos.has(id)).length;
    if (soResultado) frases.push(`Lançou o resultado de ${plural(soResultado, 'candidato', 'candidatos')} ${naSelecao}.`);
  }
  if (semRef) frases.push(`Atualizou ${plural(semRef, 'candidato', 'candidatos')} em seleções.`);
  return frases;
}

function frasesDeVagas(es: EntradaLog[]): string[] {
  const frases: string[] = [];
  const abertas = es.filter(e => e.acao === 'CRIOU' && !ehImportacao(e));

  // Agrupadas por sede: "Abriu 2 vagas em Dom Luís: Assistente de Tesouraria e ASG."
  const porSede = new Map<string, { cargos: string[]; n: number }>();
  let semRef = 0;
  for (const e of abertas) {
    if (!e.ref) { semRef++; continue; }
    const sede = titulo(e.ref.sede);
    const q = Math.max(1, num(e.ref, 'quantidade'));
    const g = porSede.get(sede) || { cargos: [], n: 0 };
    g.cargos.push(q > 1 ? `${q} de ${titulo(e.ref.cargo)}` : titulo(e.ref.cargo));
    g.n += q;
    porSede.set(sede, g);
  }
  for (const [sede, g] of porSede) {
    frases.push(`Abriu ${plural(g.n, 'vaga', 'vagas')}${sede ? ` em ${sede}` : ''}: ${enumerarComTeto(g.cargos)}.`);
  }
  if (semRef) frases.push(`Abriu ${plural(semRef, 'vaga', 'vagas')}.`);

  const alteradas = es.filter(e => e.acao === 'ALTEROU').length;
  if (alteradas) frases.push(`Atualizou o andamento de ${plural(alteradas, 'vaga', 'vagas')}.`);
  const removidas = es.filter(e => e.acao === 'EXCLUIU').length;
  if (removidas) frases.push(`Removeu ${plural(removidas, 'vaga', 'vagas')}.`);
  return frases;
}

/** Nomes das pessoas citadas nas entradas com ref; o resto só conta. */
function comNomes(es: EntradaLog[], campo: string) {
  return { nomes: es.map(e => txt(e.ref, campo)).filter(Boolean), semNome: es.filter(e => !txt(e.ref, campo)).length };
}

function frasesDePessoas(porModulo: Map<string, EntradaLog[]>): string[] {
  const frases: string[] = [];
  const doModulo = (m: string, acao: string) =>
    (porModulo.get(m) || []).filter(e => e.acao === acao && !ehImportacao(e));

  // Período de experiência (45 e 90 dias).
  const exp = comNomes(doModulo('Experiências', 'CRIOU'), 'colaborador');
  if (exp.nomes.length) frases.push(`Iniciou o acompanhamento do período de experiência de ${enumerarComTeto(exp.nomes)}.`);
  if (exp.semNome) frases.push(`Iniciou ${plural(exp.semNome, 'acompanhamento', 'acompanhamentos')} de período de experiência.`);
  const expAlt = doModulo('Experiências', 'ALTEROU').length;
  if (expAlt) frases.push(`Registrou ${plural(expAlt, 'avaliação', 'avaliações')} de período de experiência.`);

  const integ = comNomes(doModulo('Integrações', 'CRIOU'), 'colaborador');
  if (integ.nomes.length) frases.push(`Registrou a integração de ${enumerarComTeto(integ.nomes)}.`);
  if (integ.semNome) frases.push(`Registrou ${plural(integ.semNome, 'integração', 'integrações')} de novos colaboradores.`);

  const desl = comNomes(doModulo('Entrevistas', 'CRIOU'), 'colaborador');
  if (desl.nomes.length) frases.push(`Realizou a entrevista de desligamento de ${enumerarComTeto(desl.nomes)}.`);
  if (desl.semNome) frases.push(`Realizou ${plural(desl.semNome, 'entrevista', 'entrevistas')} de desligamento.`);

  const trein = doModulo('Treinamentos', 'CRIOU');
  const temas = trein.map(e => txt(e.ref, 'tema')).filter(Boolean);
  if (temas.length) frases.push(`Registrou ${temas.length === 1 ? 'o treinamento' : 'os treinamentos'} ${enumerarComTeto(temas.map(t => `“${t}”`))}.`);
  const treinSem = trein.filter(e => !txt(e.ref, 'tema')).length;
  if (treinSem) frases.push(`Registrou ${plural(treinSem, 'treinamento', 'treinamentos')}.`);

  // ⚠️ Consulta leva nome e especialidade — dado de saúde. Só a contagem vai
  // para o relato, nunca quem nem qual especialidade.
  const cons = doModulo('Consultas', 'CRIOU').length;
  if (cons) frases.push(`Encaminhou ${plural(cons, 'consulta', 'consultas')} de colaboradores.`);

  if ((porModulo.get('Turnover') || []).some(e => e.acao === 'CRIOU')) {
    frases.push('Lançou o balanço mensal de headcount e turnover.');
  }
  return frases;
}

/**
 * Tudo que o relato não escreve por extenso vira uma frase de contagem por
 * módulo, para nada que a pessoa fez sumir do e-mail.
 */
function frasesDeManutencao(porModulo: Map<string, EntradaLog[]>): string[] {
  const frases: string[] = [];
  const ajustes = (m: string) =>
    (porModulo.get(m) || []).filter(e => e.acao !== 'CRIOU' || ehImportacao(e));

  const pessoas = ['Experiências', 'Integrações', 'Entrevistas', 'Treinamentos', 'Consultas', 'Turnover'];
  for (const m of pessoas) {
    // Experiências ALTEROU já virou frase própria ("avaliações de experiência").
    const n = ajustes(m).filter(e => !(m === 'Experiências' && e.acao === 'ALTEROU') && !ehImportacao(e)).length;
    if (n) frases.push(`Atualizou ${plural(n, 'registro', 'registros')} de ${m.toLowerCase()}.`);
  }

  const imports = [...porModulo.values()].flat().filter(ehImportacao).length;
  if (imports) frases.push(`Importou ${plural(imports, 'planilha', 'planilhas')} para o sistema.`);

  const org = (porModulo.get('Organograma') || []).length;
  if (org) frases.push(`Fez ${plural(org, 'ajuste', 'ajustes')} no organograma.`);
  return frases;
}

/**
 * "Atendimentos a colaboradores: 6." — nome da tarefa e a quantidade.
 *
 * Sem plural automático de propósito: a tarefa tem o nome que alguém da equipe
 * digitou, e flexionar texto livre em português erra mais do que acerta.
 */
function frasesDasContagens(contagens: Record<string, number> | undefined, nomeDe: Map<string, string>): string[] {
  const frases: string[] = [];
  for (const [id, n] of Object.entries(contagens || {})) {
    const q = Math.floor(Number(n)) || 0;
    // Contador APAGADO não tem mais nome: a contagem dele deixa de existir
    // para o relato (antes o e-mail mostraria o id interno no lugar do nome).
    if (q <= 0 || !nomeDe.has(id)) continue;
    frases.push(`${nomeDe.get(id)}: ${q}.`);
  }
  return frases;
}

function frasesInformadas(diario: Diario | undefined, atividades: EntradaLog[], nomeDe: Map<string, string>): string[] {
  const frases: string[] = frasesDasContagens(diario?.contagens, nomeDe);
  for (const a of atividades.filter(a => a.acao === 'CRIOU')) {
    const t = txt(a.ref, 'titulo');
    const det = txt(a.ref, 'detalhe');
    // Atividade antiga, sem ref: o texto do log ainda é a melhor descrição.
    frases.push(t ? `${t}${det ? ` — ${det}` : ''}.` : (a.detalhes || '').replace(/^Atividade /, ''));
  }
  return frases;
}

/** O relato de UM dia de UMA pessoa, a partir das entradas dela nesse dia. */
function secoesDoDia(entradas: EntradaLog[], dia: string, diario: Diario | undefined, nomeDe: Map<string, string>): Secao[] {
  const porModulo = new Map<string, EntradaLog[]>();
  for (const e of entradas) {
    const m = ehSelecao(e) ? 'Seleções' : e.modulo;
    if (!porModulo.has(m)) porModulo.set(m, []);
    porModulo.get(m)!.push(e);
  }
  const secoes: Secao[] = [
    { titulo: 'Seleções', frases: [...frasesDeSelecao(porModulo.get('Seleções') || [], dia), ...frasesDeCandidatos(porModulo.get('Candidatos') || [])] },
    { titulo: 'Vagas', frases: frasesDeVagas((porModulo.get('Vagas') || []).filter(e => !ehImportacao(e))) },
    { titulo: 'Pessoas', frases: frasesDePessoas(porModulo) },
    { titulo: 'Também informou', frases: frasesInformadas(diario, porModulo.get('Resumo do Dia') || [], nomeDe) },
    { titulo: 'Manutenção do sistema', frases: frasesDeManutencao(porModulo) },
  ];
  return secoes.filter(s => s.frases.length > 0);
}

// ─── acumulado ─────────────────────────────────────────────────────────────

/** Contagens que valem somar num período — os marcos do trabalho, não os ajustes. */
function marcos(entradas: EntradaLog[], diarios: Diario[], nomeDe: Map<string, string>): string[] {
  const conta = (f: (e: EntradaLog) => boolean) => entradas.filter(f).length;
  const vagas = entradas
    .filter(e => e.modulo === 'Vagas' && e.acao === 'CRIOU' && !ehImportacao(e) && !ehSelecao(e))
    .reduce((t, e) => t + Math.max(1, num(e.ref, 'quantidade')), 0);
  const itens: [number, string, string][] = [
    [conta(e => ehSelecao(e) && e.acao === 'ALTEROU' && !REGISTRO_DE_TELA.has(String(e.ref?.tipo))), 'seleção conduzida', 'seleções conduzidas'],
    [vagas, 'vaga aberta', 'vagas abertas'],
    [conta(e => e.modulo === 'Experiências' && e.acao === 'CRIOU' && !ehImportacao(e)), 'experiência iniciada', 'experiências iniciadas'],
    [conta(e => e.modulo === 'Integrações' && e.acao === 'CRIOU' && !ehImportacao(e)), 'integração', 'integrações'],
    [conta(e => e.modulo === 'Entrevistas' && e.acao === 'CRIOU'), 'entrevista de desligamento', 'entrevistas de desligamento'],
    [conta(e => e.modulo === 'Treinamentos' && e.acao === 'CRIOU' && !ehImportacao(e)), 'treinamento', 'treinamentos'],
  ];
  const doSistema = itens.filter(([n]) => n > 0).map(([n, um, varios]) => plural(n, um, varios));

  // As tarefas da equipe somam pelo id, e aparecem como "Nome: total" — o
  // mesmo formato da frase do dia. Ordem: a da lista, não a do banco.
  const somaPorTarefa = new Map<string, number>();
  for (const d of diarios) {
    for (const [id, n] of Object.entries(d.contagens || {})) {
      const q = Math.floor(Number(n)) || 0;
      if (q > 0 && nomeDe.has(id)) somaPorTarefa.set(id, (somaPorTarefa.get(id) || 0) + q);
    }
  }
  const ordemDasTarefas = [...nomeDe.keys()];
  const informadas = [...somaPorTarefa.entries()]
    .sort(([a], [b]) => (ordemDasTarefas.indexOf(a) + 1 || 999) - (ordemDasTarefas.indexOf(b) + 1 || 999))
    .map(([id, total]) => `${nomeDe.get(id) || id}: ${total}`);

  return [...doSistema, ...informadas];
}

// ─── entrada ───────────────────────────────────────────────────────────────

/**
 * @param logs      o log do ANO até o dia (o acumulado precisa dele); a função
 *                  recorta o dia, o mês e o ano por conta própria
 * @param diarios   o que cada pessoa informou à mão, do ano
 * @param dia       DD/MM/AAAA no fuso de Fortaleza
 * @param nomes     e-mail (minúsculo) → nome de exibição
 * @param tarefas   a lista da equipe (sem as padrão: a função as acrescenta).
 *                  Arquivadas entram também — dão nome ao que já foi contado.
 */
export function relatoPorPessoa(
  logs: EntradaLog[],
  diarios: Diario[],
  dia: string,
  nomes: Map<string, string> = new Map(),
  tarefas: Tarefa[] = [],
): RelatoPessoa[] {
  const quem = (e: string) => (e || '').trim().toLowerCase();
  // `sistema` é o autor de import e manutenção feitos fora da tela (e o que
  // o app grava sem usuário logado): não é gente, não recebe relato.
  logs = logs.filter(e => !CADASTROS.has(e.modulo) && quem(e.usuario) !== 'sistema');
  const doAno = logs.filter(e => quem(e.usuario) && ano(diaEmFortaleza(e.timestamp)) === ano(dia));
  const nomeDe = new Map(listaDeTarefas(tarefas).map(t => [t.id, t.nome]));

  // Quem aparece no dia: mexeu no sistema OU informou algo no "Meu dia".
  const pessoasDoDia = new Set<string>();
  for (const e of logs) if (quem(e.usuario) && diaEmFortaleza(e.timestamp) === dia) pessoasDoDia.add(quem(e.usuario));
  for (const d of diarios) {
    const informou = Object.entries(d.contagens || {}).some(([id, n]) => nomeDe.has(id) && (Math.floor(Number(n)) || 0) > 0);
    if (d.data === dia && informou) pessoasDoDia.add(quem(d.email));
  }

  const resultado: RelatoPessoa[] = [];
  for (const email of pessoasDoDia) {
    const minhas = doAno.filter(e => quem(e.usuario) === email);
    const noDia = minhas.filter(e => diaEmFortaleza(e.timestamp) === dia);
    const noMes = minhas.filter(e => mesAno(diaEmFortaleza(e.timestamp)) === mesAno(dia) && ordem(diaEmFortaleza(e.timestamp)) <= ordem(dia));
    const noAnoAteHoje = minhas.filter(e => ordem(diaEmFortaleza(e.timestamp)) <= ordem(dia));
    const meusDiarios = diarios.filter(d => quem(d.email) === email && ano(d.data) === ano(dia) && ordem(d.data) <= ordem(dia));

    resultado.push({
      email,
      nome: (nomes.get(email) || '').trim() || email,
      acoes: noDia.length,
      secoes: secoesDoDia(noDia, dia, meusDiarios.find(d => d.data === dia), nomeDe),
      acumulado: {
        mes: marcos(noMes, meusDiarios.filter(d => mesAno(d.data) === mesAno(dia)), nomeDe),
        ano: marcos(noAnoAteHoje, meusDiarios, nomeDe),
      },
    });
  }

  // Quem mais fez primeiro; empate, ordem alfabética — estável entre dias.
  return resultado.sort((a, b) => b.acoes - a.acoes || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** DD/MM/AAAA → AAAAMMDD, para comparar datas como texto. */
function ordem(dia: string): string {
  const [d, m, a] = dia.split('/');
  return `${a}${m}${d}`;
}

// ═══ O e-mail de UMA pessoa ═════════════════════════════════════════════════

export interface EmailPessoa {
  assunto: string;
  html: string;
  /** Alternativa em texto puro — quem lê no relógio ou bloqueia HTML. */
  texto: string;
}

const escapar = (t: string) =>
  String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/**
 * Sequência longa de dígitos partida em dois <span>.
 *
 * O Gmail transforma 10 dígitos seguidos em link de telefone (os códigos de
 * vaga do banco têm 10). Envolver em <a> resolvia — e fez o e-mail inteiro ser
 * marcado como perigoso em 22/09, porque link cujo texto é número e cujo
 * destino é lugar nenhum é padrão de phishing. Dois nós de texto quebram a
 * sequência sem link nenhum, e sem caractere invisível no que se copia.
 */
const partirNumerosLongos = (html: string) =>
  html.replace(/\d{8,}/g, n => {
    const corte = Math.ceil(n.length / 2);
    return `<span>${n.slice(0, corte)}</span><span>${n.slice(corte)}</span>`;
  });

/**
 * O relato de uma pessoa, no sistema visual do próprio SGPC.
 *
 * Paleta de `src/styles/swiss.css`: fio de 1px, UM acento cobalto, zero
 * gradiente. A fonte cai na grotesca do sistema porque cliente de e-mail não
 * carrega fonte externa com confiança.
 *
 * ⚠️ AS REGRAS QUE CUSTARAM CARO, e que valem para todo e-mail daqui:
 *
 * Em 22 e 23/09 o Gmail carimbou a mensagem com a tarja vermelha "Esta
 * mensagem pode ser perigosa" com SPF, DKIM e DMARC todos em PASS — era o
 * corpo. Por isso este HTML NUNCA tem:
 *  - link (<a>): link falso foi o primeiro suspeito, e o e-mail não precisa;
 *  - texto escondido (display:none) nem <style>: texto que está no HTML e o
 *    leitor não vê é dos sinais mais antigos de mensagem maliciosa;
 *  - comentário em HTML: viaja dentro da mensagem e some da vista.
 * E o texto puro diz EXATAMENTE o mesmo que o HTML, começando pelo assunto:
 * divergir entre as partes text/plain e text/html é mostrar uma coisa a um
 * leitor e outra a outro. Há teste para cada uma dessas.
 */
export function montarEmailPessoa(dia: string, p: RelatoPessoa): EmailPessoa {
  // O nome no assunto: com um e-mail por pessoa, cinco mensagens com o mesmo
  // "Resumo do dia - 22/09/2026" seriam indistinguíveis na caixa de entrada.
  const assunto = `Resumo do dia - ${dia} - ${p.nome}`;
  const subtitulo = p.acoes > 0
    ? `${p.acoes} ${p.acoes === 1 ? 'ação registrada' : 'ações registradas'} no sistema`
    : 'Informado no "Meu dia"';

  // ── texto puro ────────────────────────────────────────────────────────────
  const linhas: string[] = [assunto, subtitulo];
  for (const s of p.secoes) {
    linhas.push('', s.titulo.toUpperCase());
    for (const f of s.frases) linhas.push(`• ${f}`);
  }
  if (p.acumulado.mes.length || p.acumulado.ano.length) {
    linhas.push('');
    if (p.acumulado.mes.length) linhas.push(`No mês: ${p.acumulado.mes.join(' · ')}`);
    if (p.acumulado.ano.length) linhas.push(`No ano: ${p.acumulado.ano.join(' · ')}`);
  }
  linhas.push('', 'Enviado automaticamente pelo SGPC. Para mudar quem recebe: Painel Admin → Notificações.');
  const texto = linhas.join('\n');

  // ── HTML ──────────────────────────────────────────────────────────────────
  const PAPEL = '#FFFFFF', CANVAS = '#ECEDF0', TINTA = '#1A1B1F';
  const HAIRLINE = '#DDE0E6', TINTA2 = '#45474D', TINTA3 = '#5F6169';
  const ACENTO = '#1B4DD8';
  const FONTE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
  const TNUM = "font-variant-numeric:tabular-nums;font-feature-settings:'tnum'";
  const rotulo = `font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${TINTA3}`;

  const secaoHtml = (s: Secao) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;margin-top:22px;border-top:1px solid ${HAIRLINE}">
    <tr><td style="padding:14px 0 0">
      <div style="${rotulo}">${escapar(s.titulo)}</div>
      ${s.frases.map(f => `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;margin-top:8px">
        <tr>
          <td valign="top" style="width:16px;padding:0;font-size:14px;line-height:1.45;color:${ACENTO}">•</td>
          <td valign="top" style="padding:0;font-size:14px;line-height:1.45;color:${TINTA}">${partirNumerosLongos(escapar(f))}</td>
        </tr>
      </table>`).join('')}
    </td></tr>
  </table>`;

  const acumuladoHtml = (p.acumulado.mes.length || p.acumulado.ano.length) ? `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;margin-top:26px;background:#F4F5F7">
    <tr><td style="padding:14px 16px">
      ${p.acumulado.mes.length ? `<div style="font-size:12px;line-height:1.55;color:${TINTA2};${TNUM}"><strong style="color:${TINTA}">No mês:</strong> ${escapar(p.acumulado.mes.join(' · '))}</div>` : ''}
      ${p.acumulado.ano.length ? `<div style="font-size:12px;line-height:1.55;color:${TINTA2};margin-top:4px;${TNUM}"><strong style="color:${TINTA}">No ano:</strong> ${escapar(p.acumulado.ano.join(' · '))}</div>` : ''}
    </td></tr>
  </table>` : '';

  const html = `<div style="background:${CANVAS};padding:24px 12px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse">
<tr><td align="center">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:${PAPEL};border:1px solid ${HAIRLINE};border-collapse:collapse">
<tr><td style="padding:32px 28px;font-family:${FONTE};color:${TINTA}">

  <h1 style="margin:0;font-size:30px;font-weight:700;letter-spacing:-.02em;line-height:1.05;color:${TINTA}">${escapar(p.nome)}</h1>
  <div style="margin-top:6px;font-size:14px;font-weight:700;color:${ACENTO};letter-spacing:-.01em;${TNUM}">Resumo do dia · ${escapar(dia)}</div>
  <div style="margin-top:4px;font-size:12px;font-weight:600;color:${TINTA3};${TNUM}">${escapar(subtitulo)}</div>
  ${p.secoes.map(secaoHtml).join('')}
  ${acumuladoHtml}

  <p style="margin:32px 0 0;padding-top:16px;border-top:1px solid ${HAIRLINE};font-size:11px;color:${TINTA3};line-height:1.6">
    Enviado automaticamente pelo SGPC. Para mudar quem recebe: Painel Admin → Notificações.
  </p>

</td></tr>
</table>

</td></tr>
</table>
</div>`;

  return { assunto, html, texto };
}

const PROJETO = 'project-312a1a63-026e-4dfa-91c';
const BANCO = 'ai-studio-2b395015-7429-44d1-83dd-233de9cd3c47';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/${BANCO}/documents`;

/** Data de hoje em DD/MM/AAAA no fuso de Fortaleza (UTC-3, sem horário de verão). */
function hojeEmFortaleza(): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Fortaleza', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date());
  return partes;
}

/**
 * Uma impressão digital do valor que NÃO revela o valor.
 *
 * O conteúdo da variável é a chave privada: não pode aparecer em log nenhum.
 * Mas "não é JSON válido" sozinho não diz em que camada está o defeito, e foi
 * exatamente isso que fez a gente ir e voltar. Tamanho, primeiro caractere e a
 * presença de quebra de linha crua identificam o problema sem entregar nada.
 */
function digital(v: string): string {
  const primeiro = v.trim()[0] ?? '(vazio)';
  return `${v.length} caracteres, começa com «${primeiro}»${/[\n\r]/.test(v) ? ', contém quebra de linha crua' : ''}`;
}

/**
 * Lê a conta de serviço do ambiente e garante que ela TEM o que vai ser usado.
 *
 * ⚠️ Esta função existe por causa de quatro dias de disparo quebrado.
 *
 * Em 21/09 morreu em "Cannot read properties of undefined (reading 'replace')":
 * o `JSON.parse` funcionou mas devolveu uma STRING, não o objeto — o valor
 * estava com aspas em volta, um JSON dentro de outro. Em 22/09, com o parse
 * duplo já no ar, o de dentro também falhou: sinal de `private_key` com quebra
 * de linha de verdade, que é JSON inválido (o arquivo traz `\n` escapado, e
 * copiar e colar desfaz esse escape).
 *
 * Daí o base64 ser o caminho recomendado: é uma linha só, sem aspas e sem
 * quebra, então não existe o que o copiar-e-colar possa estragar. Os outros
 * formatos continuam aceitos para não quebrar quem já está configurado.
 */
export function lerContaDeServico(bruto: string | undefined): { client_email: string; private_key: string; project_id?: string } {
  if (!bruto || !bruto.trim()) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON ausente');
  const valor = bruto.trim();
  const dica = 'Recomendado: gravar o valor em base64 (uma linha, nada a escapar) — `base64 -w0 conta.json`.';

  let conta: any;
  if (valor[0] === '{') {
    try { conta = JSON.parse(valor); }
    catch { throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON começa como objeto mas não é JSON válido (${digital(valor)}). Quase sempre é a private_key com quebra de linha real em vez de \\n. ${dica}`); }
  } else if (valor[0] === '"') {
    let interno: unknown;
    try { interno = JSON.parse(valor); }
    catch { throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON está entre aspas e nem as aspas fecham direito (${digital(valor)}). ${dica}`); }
    try { conta = JSON.parse(String(interno)); }
    catch { throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON está entre aspas, e o que está dentro não é JSON (${digital(valor)}). Tire as aspas de fora, ou melhor: ${dica}`); }
  } else {
    // Sem `{` nem `"`: só pode ser base64. Se não for, a mensagem diz isso.
    try { conta = JSON.parse(Buffer.from(valor, 'base64').toString('utf-8')); }
    catch { throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON não é objeto JSON, nem JSON entre aspas, nem base64 de um JSON (${digital(valor)}). ${dica}`); }
  }

  const faltando = ['client_email', 'private_key'].filter(c => typeof conta?.[c] !== 'string' || !conta[c]);
  if (faltando.length) {
    throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON não parece uma conta de serviço: falta ${faltando.join(' e ')}`);
  }
  return conta;
}

/**
 * Token de acesso a partir da conta de serviço, assinando o JWT à mão.
 *
 * São 20 linhas de `node:crypto` em vez de arrastar `google-auth-library` e
 * suas dependências para dentro de uma função serverless que faz uma única
 * chamada. Menos peso no cold start e menos superfície para auditar.
 */
async function tokenDeAcesso(): Promise<string> {
  const conta = lerContaDeServico(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

  const agora = Math.floor(Date.now() / 1000);
  const base64url = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64url');
  const cabecalho = base64url({ alg: 'RS256', typ: 'JWT' });
  const corpo = base64url({
    iss: conta.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: agora,
    exp: agora + 3600,
  });
  const assinatura = crypto
    .createSign('RSA-SHA256')
    .update(`${cabecalho}.${corpo}`)
    .sign(conta.private_key.replace(/\\n/g, '\n'), 'base64url');

  const resposta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${cabecalho}.${corpo}.${assinatura}`,
    }),
  });
  const json: any = await resposta.json();
  if (!json.access_token) throw new Error(`OAuth falhou: ${JSON.stringify(json).slice(0, 200)}`);
  return json.access_token;
}

const campoTexto = (d: any, campo: string) => d?.fields?.[campo]?.stringValue ?? '';

async function lerColecao(colecao: string, token: string): Promise<any[]> {
  const docs: any[] = [];
  let pageToken = '';
  do {
    const r = await fetch(`${BASE}/${colecao}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j: any = await r.json();
    if (j.error) throw new Error(`${colecao}: ${j.error.message}`);
    docs.push(...(j.documents || []));
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  return docs;
}

/**
 * O log do ANO até o fim do dia, filtrado NO BANCO.
 *
 * O ano inteiro e não só o dia: o relato leva o acumulado do mês e do ano da
 * pessoa. Ainda assim é filtro no banco — nada de anos anteriores nem do que
 * veio depois. `timestamp` é ISO em UTC, e ISO compara como texto na ordem
 * certa — daí o filtro por faixa de texto.
 *
 * O dia de Fortaleza começa às 03:00 UTC (UTC-3, sem horário de verão desde
 * 2019). `relatoPorPessoa` confere dia, mês e ano de novo por conta própria;
 * este filtro é economia, não é a regra.
 */
async function lerLogDoAno(dia: string, token: string): Promise<EntradaLog[]> {
  const [d, m, a] = dia.split('/');
  const inicio = new Date(`${a}-01-01T03:00:00.000Z`);
  const fim = new Date(new Date(`${a}-${m}-${d}T03:00:00.000Z`).getTime() + 24 * 3600 * 1000);
  const filtro = (op: string, valor: string) => ({
    fieldFilter: { field: { fieldPath: 'timestamp' }, op, value: { stringValue: valor } },
  });
  const r = await fetch(`${BASE}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'logs' }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              filtro('GREATER_THAN_OR_EQUAL', inicio.toISOString()),
              filtro('LESS_THAN', fim.toISOString()),
            ],
          },
        },
      },
    }),
  });
  const j: any = await r.json();
  if (!Array.isArray(j)) throw new Error(`logs: ${j?.error?.message || 'resposta inesperada'}`);
  return j
    .filter((x: any) => x.document)
    .map((x: any) => ({
      timestamp: campoTexto(x.document, 'timestamp'),
      usuario: campoTexto(x.document, 'usuario'),
      acao: campoTexto(x.document, 'acao'),
      modulo: campoTexto(x.document, 'modulo'),
      detalhes: campoTexto(x.document, 'detalhes'),
      ref: lerMapa(x.document?.fields?.ref),
    }));
}

/** Um mapa do Firestore (REST) em objeto simples. Ausente → undefined. */
function lerMapa(campo: any): Ref | undefined {
  const fields = campo?.mapValue?.fields;
  if (!fields) return undefined;
  return Object.fromEntries(Object.entries(fields).map(([k, v]: [string, any]) => [
    k,
    v.stringValue ?? (v.integerValue !== undefined ? Number(v.integerValue) : v.doubleValue),
  ]));
}

const campoNumero = (d: any, campo: string) =>
  Number(d?.fields?.[campo]?.integerValue ?? d?.fields?.[campo]?.doubleValue ?? 0);

/** O "Meu dia" de todo mundo — coleção pequena, um documento por pessoa por dia. */
async function lerDiarios(token: string): Promise<Diario[]> {
  return (await lerColecao('diario', token)).map(d => ({
    email: campoTexto(d, 'email'),
    data: campoTexto(d, 'data'),
    contagens: lerMapa(d.fields?.contagens) as Record<string, number> | undefined,
  }));
}

/** A lista da equipe, inclusive arquivadas — elas nomeiam o que já foi contado. */
async function lerTarefas(token: string): Promise<Tarefa[]> {
  return (await lerColecao('tarefasDiario', token)).map(d => ({
    id: d.name.split('/').pop(),
    nome: campoTexto(d, 'nome'),
    arquivada: d.fields?.arquivada?.booleanValue === true,
    ...(d.fields?.ordem ? { ordem: campoNumero(d, 'ordem') } : {}),
  }));
}

/**
 * Grava o resultado de CADA execução em `config/notificacoes.ultimoDisparo`.
 *
 * Sem isto, sucesso e falha são indistinguíveis: a evidência de sucesso é um
 * e-mail na caixa de outra pessoa, e a de falha é silêncio — que também é o que
 * um dia sem seleção produz. Levamos três dias para notar que o disparo de
 * 17/09 tinha morrido.
 *
 * `updateMask` limitado ao campo: a lista de destinatários não é tocada.
 * Falhar aqui NÃO derruba o envio — registro é diagnóstico, não a tarefa.
 */
async function registrarDisparo(token: string, dados: Record<string, string | number | boolean>) {
  try {
    const fields = Object.fromEntries(Object.entries(dados).map(([k, v]) => [
      k,
      typeof v === 'boolean' ? { booleanValue: v }
        : typeof v === 'number' ? { integerValue: String(v) }
        : { stringValue: String(v) },
    ]));
    const r = await fetch(`${BASE}/config/notificacoes?updateMask.fieldPaths=ultimoDisparo`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { ultimoDisparo: { mapValue: { fields } } } }),
    });
    if (!r.ok) {
      // 403 aqui quer dizer conta de serviço só-leitura. Sem este aviso o
      // registro sumiria no catch e a tela ficaria eternamente em "nenhum
      // registro ainda" — trocaríamos um silêncio por outro.
      console.error(
        `[selecoes-do-dia] não gravei o registro (${r.status}). ` +
        'A conta de serviço precisa de permissão de ESCRITA no Firestore (roles/datastore.user).'
      );
    }
  } catch (e: any) {
    console.error('[selecoes-do-dia] não consegui registrar o disparo:', e?.message || e);
  }
}

export default async function handler(req: any, res: any) {
  // Trava 1: só o cron da Vercel (ou quem tem o segredo) dispara.
  //
  // "Não configurado" e "chamador errado" respondem DIFERENTE de propósito: os
  // dois devolviam 401 e, no log, ninguém distinguia a função sem variável de
  // ambiente de alguém batendo na porta. Variável adicionada depois do deploy
  // não vale para o deploy que já está no ar — é a causa mais provável de o
  // e-mail não chegar, e agora o log diz isso em vez de "não autorizado".
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    console.error('[selecoes-do-dia] CRON_SECRET ausente neste deploy — refaça o deploy após configurar as variáveis.');
    return res.status(503).json({ erro: 'disparo não configurado neste deploy' });
  }
  const faltando = ['SMTP_USER', 'SMTP_APP_PASSWORD', 'GOOGLE_SERVICE_ACCOUNT_JSON']
    .filter(v => !process.env[v]);
  if ((req.headers?.authorization || '') !== `Bearer ${segredo}`) {
    return res.status(401).json({ erro: 'não autorizado' });
  }
  if (faltando.length) {
    console.error(`[selecoes-do-dia] variáveis ausentes: ${faltando.join(', ')}`);
    return res.status(503).json({ erro: 'disparo não configurado', faltando });
  }

  try {
    const token = await tokenDeAcesso();

    // Trava 2: destinatários SEMPRE do banco, nunca do corpo da requisição.
    const configs = await lerColecao('config', token);
    const notif = configs.find(d => d.name.endsWith('/notificacoes'));
    const lista: string[] = (notif?.fields?.destinatariosSelecoes?.arrayValue?.values || [])
      .map((v: any) => String(v.stringValue || '').trim())
      .filter((e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
    const ativo = notif?.fields?.selecoesAtivo?.booleanValue !== false;

    const quando = new Date().toISOString();
    if (!ativo) {
      await registrarDisparo(token, { quando, enviado: false, motivo: 'desligado na configuração' });
      return res.status(200).json({ enviado: false, motivo: 'desligado na configuração' });
    }
    if (!lista.length) {
      await registrarDisparo(token, { quando, enviado: false, motivo: 'sem destinatários configurados' });
      return res.status(200).json({ enviado: false, motivo: 'sem destinatários configurados' });
    }

    const dia = hojeEmFortaleza();

    // Nome de exibição de cada e-mail. O log só guarda o endereço; sem nome
    // cadastrado, o assunto sai com o próprio endereço, que ainda é melhor que
    // pular a pessoa.
    const nomes = new Map<string, string>(
      (await lerColecao('usuarios', token))
        .map(d => [campoTexto(d, 'email').trim().toLowerCase(), campoTexto(d, 'nome').trim()] as [string, string])
        .filter(([email, nome]) => email && nome)
    );

    const pessoas = relatoPorPessoa(
      await lerLogDoAno(dia, token), await lerDiarios(token), dia, nomes, await lerTarefas(token),
    );

    // Dia em que ninguém registrou nada não vira e-mail: aviso que quase
    // sempre diz "nada aconteceu" ensina o destinatário a ignorar o remetente.
    if (pessoas.length === 0) {
      // Registrado mesmo sem enviar: é o que separa "não houve nada" de
      // "quebrou". Sem essa linha, os dois parecem iguais de fora.
      await registrarDisparo(token, { quando, dia, enviado: false, motivo: 'nada registrado por ninguém neste dia' });
      return res.status(200).json({ enviado: false, motivo: `nada registrado em ${dia}` });
    }

    const transporte = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_APP_PASSWORD },
    });

    // UM e-mail por pessoa, todos para a MESMA lista (os diretores). A trava 2
    // segue de pé: quem aparece no log é o ASSUNTO do e-mail, nunca o
    // destinatário — o disparo não manda nada para endereço que não esteja na
    // lista configurada.
    //
    // Uma falha não derruba as outras: se o terceiro e-mail falhar, os
    // diretores ainda recebem os outros quatro, e o registro diz qual faltou.
    const falhas: string[] = [];
    for (const p of pessoas) {
      const email = montarEmailPessoa(dia, p);
      try {
        await transporte.sendMail({
          from: `SGPC <${process.env.SMTP_USER}>`,
          to: lista,
          subject: email.assunto,
          text: email.texto,
          html: email.html,
        });
      } catch (e: any) {
        falhas.push(`${p.nome}: ${String(e?.message || e).slice(0, 80)}`);
      }
    }

    const enviados = pessoas.length - falhas.length;
    if (enviados === 0) {
      // Todos falharam: quase sempre é a senha de app ou o Gmail bloqueando, e
      // o motivo do primeiro já diz qual.
      await registrarDisparo(token, {
        quando, dia, enviado: false,
        motivo: `falha no envio: ${falhas[0].slice(0, 140)}`,
      });
      throw new Error(falhas[0]);
    }

    await registrarDisparo(token, {
      quando, dia, enviado: true,
      motivo: falhas.length ? `${falhas.length} de ${pessoas.length} falharam — ${falhas.join('; ').slice(0, 140)}` : 'enviado',
      emails: enviados,
      pessoas: pessoas.length,
      destinatarios: lista.length,
    });
    return res.status(200).json({ enviado: true, dia, emails: enviados, pessoas: pessoas.length, destinatarios: lista.length, falhas });
  } catch (e: any) {
    console.error('[selecoes-do-dia]', e?.message || e);
    return res.status(500).json({ erro: 'falha ao enviar', detalhe: String(e?.message || e).slice(0, 200) });
  }
}
