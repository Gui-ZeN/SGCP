/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * O relato do dia de cada pessoa — o que ela fez no SGPC, escrito em frases.
 *
 * Nasceu da reunião de 22/09/2026 com a direção: o relatório diário do RH
 * existe para dar VISIBILIDADE ao trabalho do setor, e a primeira versão
 * "não mostrou nada". A segunda repetia o log do sistema linha a linha, e
 * "parece log". Por isso as frases são montadas a partir dos CAMPOS que cada
 * ação grava (`ref`: cargo, sede, números, nome do item), não do texto do log.
 *
 * Decisões da reunião que moram aqui:
 *  - um relato por COLABORADOR por dia;
 *  - sem registro por horário — a ata aponta risco trabalhista (controle de
 *    jornada), e o relato conta O QUE foi feito, não QUANDO;
 *  - acumulado do mês e do ano da própria pessoa.
 *
 * ⚠️ Esta regra existe DUAS vezes: aqui (para a tela) e em
 * `api/selecoes-do-dia.ts` (para o e-mail). A função da Vercel não pode
 * importar de `src/` — ela transpila sem empacotar e o import some no
 * servidor (disparo quebrado de 17/09). O teste `relato concorda com a tela`
 * em `api/` impede as duas cópias de divergirem.
 */

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

function frasesDeSelecao(es: EntradaLog[], dia: string): string[] {
  const frases: string[] = [];
  const conduzidas = es.filter(e => e.acao === 'ALTEROU');
  const agendadas = es.filter(e => e.acao === 'CRIOU');

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
    if (q <= 0) continue;
    frases.push(`${nomeDe.get(id) || id}: ${q}.`);
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
    { titulo: 'Seleções', frases: frasesDeSelecao(porModulo.get('Seleções') || [], dia) },
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
    [conta(e => ehSelecao(e) && e.acao === 'ALTEROU'), 'seleção conduzida', 'seleções conduzidas'],
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
      if (q > 0) somaPorTarefa.set(id, (somaPorTarefa.get(id) || 0) + q);
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
  logs = logs.filter(e => !CADASTROS.has(e.modulo));
  const doAno = logs.filter(e => quem(e.usuario) && ano(diaEmFortaleza(e.timestamp)) === ano(dia));
  const nomeDe = new Map(listaDeTarefas(tarefas).map(t => [t.id, t.nome]));

  // Quem aparece no dia: mexeu no sistema OU informou algo no "Meu dia".
  const pessoasDoDia = new Set<string>();
  for (const e of logs) if (quem(e.usuario) && diaEmFortaleza(e.timestamp) === dia) pessoasDoDia.add(quem(e.usuario));
  for (const d of diarios) {
    const informou = Object.values(d.contagens || {}).some(n => (Math.floor(Number(n)) || 0) > 0);
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
