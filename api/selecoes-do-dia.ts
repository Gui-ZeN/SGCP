/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Disparo do e-mail "Seleções do dia" — 18h de Fortaleza, pelo cron da Vercel.
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
 * token de ninguém para o Firestore autorizar. Precisa de LEITURA (selecoes,
 * config) e de ESCRITA em `config/notificacoes`, onde cada execução deixa o
 * registro do que fez — `roles/datastore.user`.
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
 * O preço é a duplicação das três regrinhas de seleção (realizada, códigos de
 * vaga, somatório). O teste `concorda com src/utils/selecao` fica de guarda
 * contra elas divergirem.
 */

/** Um dia de seleção. Espelha `src/types.ts`, sem importar de fora. */
interface Selecao {
  id?: string;
  data: string;
  cargo: string;
  sede?: string;
  responsavel?: string;
  origem?: string;
  status?: 'agendado' | 'realizado';
  convocados?: number;
  compareceram?: number;
  ausentes?: number;
  contratados?: number;
  desistiram?: number;
  vagaCodigos?: number[];
  vagaCodigo?: number;
  motivos?: Record<string, number>;
}

/** Registro SEM status conta como realizado — os importados da planilha. */
const ehRealizada = (s: Selecao) => (s.status || 'realizado') === 'realizado';

/** Lê a lista de vagas e cai no campo único dos registros antigos. */
const codigosDasVagas = (s: Selecao): number[] =>
  s.vagaCodigos?.length ? s.vagaCodigos
    : (s.vagaCodigo === undefined || s.vagaCodigo === null ? [] : [s.vagaCodigo]);

/** Soma só o que já aconteceu: agendado tem 0 e derrubaria a taxa. */
function totaisDeSelecoes(selecoes: Selecao[]) {
  const realizadas = selecoes.filter(ehRealizada);
  const soma = (c: 'convocados' | 'compareceram' | 'ausentes' | 'desistiram' | 'contratados') =>
    realizadas.reduce((t, s) => t + (s[c] || 0), 0);
  const convocados = soma('convocados');
  const compareceram = soma('compareceram');
  return {
    convocados, compareceram,
    ausentes: soma('ausentes'),
    desistiram: soma('desistiram'),
    contratados: soma('contratados'),
    aConfirmar: selecoes.length - realizadas.length,
    taxa: convocados === 0 ? null : Math.round((compareceram / convocados) * 1000) / 10,
  };
}

export interface EmailSelecoes {
  assunto: string;
  html: string;
  /** Alternativa em texto puro — quem lê no relógio ou bloqueia HTML. */
  texto: string;
  /** false quando não há nada no dia e o e-mail não deve ser enviado. */
  vale: boolean;
}

const escapar = (t: string) =>
  String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** O que o RH fez no dia e não foi seleção. Espelha `src/hooks/useAtividades`. */
interface Atividade {
  id?: string;
  data: string;
  titulo: string;
  detalhe?: string;
  responsavel?: string;
  sede?: string;
}

/**
 * @param dia   DD/MM/AAAA — o dia do resumo
 * @param selecoes  já escopadas por unidade por quem chama
 * @param atividades  o que o RH fez fora das seleções, já escopadas também
 */
export function montarEmailSelecoes(
  dia: string,
  selecoes: Selecao[],
  atividades: Atividade[] = [],
): EmailSelecoes {
  const doDia = selecoes.filter(s => (s.data || '').trim() === dia);
  const atividadesDoDia = atividades.filter(a => (a.data || '').trim() === dia);
  const realizadas = doDia.filter(ehRealizada);
  const agendadas = doDia.filter(s => !ehRealizada(s));
  const t = totaisDeSelecoes(doDia);

  // Dia sem NADA registrado não gera e-mail. Um aviso diário que na maior parte
  // dos dias diz "nada aconteceu" é o caminho mais curto para o filtro de
  // lixeira. Antes a regra era "sem SELEÇÃO", e com ela um dia inteiro de
  // força-tarefa em kits não chegava a quem só lê o e-mail.
  if (doDia.length === 0 && atividadesDoDia.length === 0) {
    return { assunto: '', html: '', texto: '', vale: false };
  }

  // Convocados AGENDADOS entram no resumo por fora do total: `totaisDeSelecoes`
  // só conta o realizado (senão um dia que não chegou derruba a taxa), mas
  // anunciar "0 convocados" com 2 na tabela logo abaixo é a folha se
  // contradizendo. Medido em 21/09/2026, num dia só com agendamento.
  const convocadosAConfirmar = doDia
    .filter(s => !ehRealizada(s))
    .reduce((soma, s) => soma + (s.convocados || 0), 0);

  // Vírgula decimal: é pt-BR, e o HTML já escreve assim. Enquanto esta linha
  // dizia "28.6%" e o HTML dizia "28,6%", as duas partes da mesma mensagem
  // divergiam de novo — pelo separador, dessa vez.
  const taxaEscrita = t.taxa === null ? '' : `${String(t.taxa).replace('.', ',')}% de comparecimento`;

  const resumo = [
    t.convocados > 0 ? `${t.convocados} convocados` : '',
    t.convocados > 0 ? `${t.compareceram} compareceram` : '',
    taxaEscrita,
    t.contratados ? plural(t.contratados, 'contratado', 'contratados') : '',
    convocadosAConfirmar > 0
      ? `${convocadosAConfirmar} ${convocadosAConfirmar === 1 ? 'convocado' : 'convocados'} a confirmar`
      : '',
  ].filter(Boolean).join(' · ');

  // Assunto fixo, só variando a data — pedido do RH. Antes era
  // "Seleções de DD/MM/AAAA — X de Y compareceram". O número que importa saiu
  // daqui e vive no corpo; na caixa de entrada um dia se distingue do outro
  // só pela data.
  const assunto = `Resumo do dia - ${dia}`;

  const motivos = new Map<string, number>();
  doDia.forEach(s => Object.entries(s.motivos || {}).forEach(([m, n]) => {
    if (n > 0) motivos.set(m, (motivos.get(m) || 0) + n);
  }));

  const html = montarHtml({
    dia, realizadas, agendadas, totais: t, taxa: taxaEscrita,
    convocadosAConfirmar, motivos, atividades: atividadesDoDia,
  });

  // ⚠️ Abre com o MESMO título do HTML ("Resumo do dia"), e não com um título
  // próprio. Enquanto esta parte dizia "SGPC — Seleções do dia" e o HTML dizia
  // "Resumo do dia", as duas alternativas da mesma mensagem anunciavam coisas
  // diferentes — e mostrar uma coisa a um leitor e outra a outro é justamente
  // o que um filtro de phishing procura. Ver o comentário de `montarHtml`.
  const texto = [
    `Resumo do dia - ${dia}`,
    resumo,
    '',
    ...[...realizadas, ...agendadas].map(s => {
      const n = ehRealizada(s)
        ? `${s.convocados || 0} convocados, ${s.compareceram || 0} compareceram, ${s.ausentes || 0} ausentes`
        : `${s.convocados || 0} convocados, presença a confirmar`;
      return `- ${s.cargo} · ${s.sede || 's/ sede'} · ${s.responsavel || 's/ responsável'}: ${n}`;
    }),
    agendadas.length ? `\n${plural(agendadas.length, 'seleção sem confirmação', 'seleções sem confirmação')} de presença.` : '',
    // As atividades entram numa lista PRÓPRIA, nunca no meio das seleções: a
    // linha de seleção traz três números, a de atividade não traz nenhum, e
    // misturadas viram uma tabela em que metade das colunas está vazia.
    // "Outras" só quando houve seleção antes; sozinho, o "outras" sugere um
    // primeiro bloco que não existe.
    atividadesDoDia.length
      ? `\n${doDia.length ? 'Outras atividades do dia:' : 'Atividades do dia:'}`
      : '',
    ...atividadesDoDia.map(a => {
      const quem = (a.responsavel || '').trim();
      const onde = (a.sede || '').trim();
      const detalhe = (a.detalhe || '').trim();
      const contexto = [onde, quem].filter(Boolean).join(' · ');
      return `- ${a.titulo}${contexto ? ` (${contexto})` : ''}${detalhe ? `: ${detalhe}` : ''}`;
    }),
    '\nEnviado automaticamente pelo SGPC. Para mudar quem recebe: Painel Admin → Notificações.',
  ].filter(Boolean).join('\n');

  return { assunto, html, texto, vale: true };
}

/**
 * O corpo em HTML, no sistema visual do próprio SGPC.
 *
 * Paleta e regras vêm de `src/styles/swiss.css` (tema Suíço da aplicação):
 * fio de 1px no lugar de sombra, números tabulares, UM acento cobalto, zero
 * gradiente. O e-mail antes usava Arial e um cinza qualquer — parecia de outro
 * produto. Aqui não dá para importar a Hanken Grotesk (cliente de e-mail não
 * carrega fonte externa de forma confiável), então a pilha cai na grotesca do
 * sistema; é a única concessão da tipografia.
 *
 * Três decisões que vieram de defeito observado no Gmail, não de gosto:
 *
 *  1. Os três números saíram de uma célula só (`11 / 5 / 6`, indecifrável sem
 *     consultar o cabeçalho) para três colunas com rótulo inteiro. O cabeçalho
 *     abreviado "CONV. / COMP. / AUS." quebrava em três linhas.
 *  2. O total virou linha do RODAPÉ da mesma tabela, alinhado sob as colunas
 *     que soma — em vez de uma frase solta com pontinhos no topo. A taxa fica
 *     embaixo do total de compareceram, que é exatamente o que ela mede.
 *  3. O código de vaga é partido em dois <span>, e NÃO vai dentro de link —
 *     ver o comentário de `refVaga`.
 *
 * ⚠️ E TRÊS COISAS QUE NÃO ESTÃO AQUI, de propósito.
 *
 * Em 22 e 23/09 o Gmail carimbou este e-mail com a tarja vermelha "Esta
 * mensagem pode ser perigosa". Não era autenticação: SPF, DKIM e DMARC deram
 * PASS nos três. Era o corpo — e o corpo só tinha mudado na redesenhada.
 * Sobraram três suspeitos, todos padrões que classificador de phishing pesa:
 *
 *  a. TEXTO ESCONDIDO. Os rótulos de coluna do celular viviam em <span> com
 *     `display:none` no desktop. Texto que está no HTML e o leitor não vê é
 *     dos sinais mais antigos de mensagem maliciosa. Saiu — e com ele foi o
 *     empilhamento no celular, que dependia de media query. O preço é a tabela
 *     apertada em tela pequena; é menos ruim que um e-mail que ninguém abre.
 *  b. COMENTÁRIO EM HTML. Comentário viaja dentro da mensagem e some da vista.
 *     Toda explicação daqui em diante é comentário de código, nunca de HTML.
 *  c. AS DUAS PARTES DIVERGINDO. O texto puro abria com "SGPC — Seleções do
 *     dia" enquanto o HTML dizia "Resumo do dia". Divergência entre as partes
 *     text/plain e text/html é sinal clássico: é como se esconde de um leitor
 *     o que se mostra ao outro. As duas passaram a dizer a mesma coisa.
 *
 * Por isso também não há mais <!doctype>, <head> nem <style>: o formato que
 * nunca foi marcado era uma <div> com estilo inline, e voltamos a ele. Se a
 * tarja insistir mesmo assim, a causa está fora do corpo e a investigação
 * recomeça — mas não por aqui.
 */
function montarHtml(d: {
  dia: string;
  realizadas: Selecao[];
  agendadas: Selecao[];
  totais: ReturnType<typeof totaisDeSelecoes>;
  /** Já escrita, com vírgula decimal — vem pronta para as duas partes dizerem igual. */
  taxa: string;
  convocadosAConfirmar: number;
  atividades: Atividade[];
  motivos: Map<string, number>;
}): string {
  // Tokens do tema Suíço (src/styles/swiss.css). Literais porque e-mail não
  // tem custom property com suporte decente — mas os valores são os mesmos.
  const PAPEL = '#FFFFFF', CANVAS = '#ECEDF0', TINTA = '#1A1B1F';
  const HAIRLINE = '#DDE0E6', TINTA2 = '#45474D', TINTA3 = '#5F6169';
  const ACENTO = '#1B4DD8';
  const FONTE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
  const TNUM = "font-variant-numeric:tabular-nums;font-feature-settings:'tnum'";

  const rotulo = `font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${TINTA3}`;
  const celNum = `padding:12px 8px;text-align:right;font-size:16px;color:${TINTA};${TNUM};border-bottom:1px solid ${HAIRLINE}`;


  /**
   * Números de vaga — SEM link, e partidos em dois <span>.
   *
   * ⚠️ A primeira tentativa foi envolver o código num `<a href="#">`, que é a
   * receita conhecida contra o Gmail transformar 10 dígitos em link de
   * telefone. Custou caro: em 23/09 o Gmail marcou o e-mail inteiro com a
   * tarja vermelha "Esta mensagem pode ser perigosa". Um link cujo texto é um
   * número e cujo destino é lugar nenhum é justamente o padrão que o
   * classificador de phishing procura, e até então o e-mail não tinha link
   * algum. Trocamos um número azul por uma mensagem que ninguém abre.
   *
   * O corte em dois <span> separa os dígitos em dois nós de texto, o que
   * costuma bastar para o detector de telefone não enxergar a sequência — e,
   * ao contrário do espaço de largura zero, não injeta caractere invisível no
   * que a pessoa copia. Se ainda assim o Gmail pintar de azul, é só cosmético:
   * nunca mais vale um link falso aqui dentro.
   */
  const refVaga = (s: Selecao) => {
    const cods = codigosDasVagas(s);
    if (!cods.length) return '';
    const numeros = cods.map(c => {
      const texto = String(c);
      const corte = Math.ceil(texto.length / 2);
      return `<span>${texto.slice(0, corte)}</span><span>${texto.slice(corte)}</span>`;
    }).join(` <span style="color:${HAIRLINE}">·</span> `);
    return `<div style="font-size:11px;color:${TINTA3};margin-top:3px;${TNUM}">
      ${cods.length === 1 ? 'Vaga' : 'Vagas'} ${numeros}
    </div>`;
  };

  // O cargo NÃO leva etiqueta de pendente: as duas células de presença já dizem
  // "a confirmar", e empilhadas no celular a etiqueta quebrava no meio da
  // palavra ("· A / CONFIRMAR"). Dizer duas vezes custou legibilidade.
  //
  // Comentário de código, não de HTML: comentário HTML viaja dentro do e-mail.
  const linha = (s: Selecao) => {
    const feita = ehRealizada(s);
    const pendente = `<span style="color:${TINTA3};font-size:13px">a confirmar</span>`;
    return `<tr>
      <td style="padding:12px 8px;border-bottom:1px solid ${HAIRLINE};vertical-align:top">
        <div style="font-size:14px;font-weight:700;color:${TINTA};line-height:1.3">${escapar(s.cargo)}</div>
        <div style="font-size:12px;color:${TINTA2};margin-top:3px;line-height:1.4">
          ${escapar(s.sede || 'sem sede')} <span style="color:${HAIRLINE}">·</span> ${escapar(s.responsavel || 'sem responsável')}
        </div>
        ${refVaga(s)}
      </td>
      <td style="${celNum}">${s.convocados || 0}</td>
      <td style="${celNum}">${feita ? s.compareceram || 0 : pendente}</td>
      <td style="${celNum}">${feita ? s.ausentes || 0 : pendente}</td>
    </tr>`;
  };

  const t = d.totais;
  const taxa = d.taxa;
  const celTotal = `padding:12px 8px;text-align:right;font-size:17px;font-weight:700;color:${TINTA};${TNUM};border-top:2px solid ${TINTA}`;

  const th = (texto: string, alinha: 'left' | 'right') =>
    `<th align="${alinha}" style="padding:0 8px 8px;${rotulo};border-bottom:1px solid ${TINTA}">${texto}</th>`;

  // Dia só de atividade não leva a tabela: cabeçalho de colunas com corpo vazio
  // e "Total do dia 0 / 0 / 0" faz o e-mail parecer quebrado, não vazio.
  const semSelecoes = d.realizadas.length === 0 && d.agendadas.length === 0;

  /* As atividades vêm numa LISTA, e não em linhas da tabela de seleções. A
     linha de seleção é três números; a de atividade não é número nenhum.
     Juntas, metade das colunas fica vazia em cada linha — e, pior, a atividade
     passaria a ser contada como seleção do dia. */
  const listaAtividades = d.atividades.length === 0 ? '' : `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;margin-top:${semSelecoes ? 28 : 24}px;border-top:1px solid ${HAIRLINE}">
    <tr><td style="padding:16px 8px 0">
      <div style="${rotulo}">${semSelecoes ? 'Atividades do dia' : 'Também no dia'}</div>
      ${d.atividades.map(a => {
        const contexto = [a.sede, a.responsavel].map(x => (x || '').trim()).filter(Boolean).join(' · ');
        return `<div style="margin-top:10px">
          <div style="font-size:13px;font-weight:700;color:${TINTA};line-height:1.35">${escapar(a.titulo)}</div>
          ${a.detalhe ? `<div style="font-size:12px;color:${TINTA2};margin-top:2px;line-height:1.45">${escapar(a.detalhe)}</div>` : ''}
          ${contexto ? `<div style="font-size:11px;color:${TINTA3};margin-top:2px">${escapar(contexto)}</div>` : ''}
        </div>`;
      }).join('')}
    </td></tr>
  </table>`;

  return `<div style="background:${CANVAS};padding:24px 12px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse">
<tr><td align="center">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:${PAPEL};border:1px solid ${HAIRLINE};border-collapse:collapse">
<tr><td style="padding:32px 28px;font-family:${FONTE};color:${TINTA}">

  <h1 style="margin:0;font-size:32px;font-weight:700;letter-spacing:-.02em;line-height:1.05;color:${TINTA}">Resumo do dia</h1>
  <div style="margin-top:6px;font-size:15px;font-weight:700;color:${ACENTO};letter-spacing:-.01em;${TNUM}">${escapar(d.dia)}</div>

  ${semSelecoes ? '' : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;margin-top:28px">
    <thead>
      <tr>
        ${th('Cargo', 'left')}${th('Convocados', 'right')}${th('Compareceram', 'right')}${th('Ausentes', 'right')}
      </tr>
    </thead>
    <tbody>${[...d.realizadas, ...d.agendadas].map(linha).join('')}</tbody>
    <tfoot>
      <tr>
        <td style="padding:12px 8px;border-top:2px solid ${TINTA};${rotulo};vertical-align:top;white-space:nowrap">Total do dia</td>
        <td style="${celTotal}">${t.convocados}</td>
        <td style="${celTotal}">${t.compareceram}</td>
        <td style="${celTotal}">${t.ausentes}</td>
      </tr>
      ${taxa ? `<tr>
        <td colspan="4" align="right" style="padding:8px 8px 0;text-align:right;font-size:14px;font-weight:700;color:${ACENTO};letter-spacing:-.01em;${TNUM}">${taxa}</td>
      </tr>` : ''}
    </tfoot>
  </table>`}

  ${d.convocadosAConfirmar > 0 ? `<p style="margin:20px 0 0;font-size:13px;color:${TINTA2};line-height:1.5">
    <strong style="color:${TINTA}">${d.convocadosAConfirmar} ${d.convocadosAConfirmar === 1 ? 'convocado' : 'convocados'} a confirmar</strong>
    em ${plural(d.agendadas.length, 'seleção ainda sem confirmação de presença', 'seleções ainda sem confirmação de presença')}.
  </p>` : ''}

  ${d.motivos.size ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;margin-top:24px;border-top:1px solid ${HAIRLINE}">
    <tr><td style="padding:16px 8px 0">
      <div style="${rotulo}">Desistências</div>
      <div style="font-size:13px;color:${TINTA2};margin-top:6px;line-height:1.6">${
        [...d.motivos.entries()].sort((a, b) => b[1] - a[1])
          .map(([m, n]) => `${escapar(m)} (${n})`)
          .join(` <span style="color:${HAIRLINE}">·</span> `)
      }</div>
    </td></tr>
  </table>` : ''}
  ${listaAtividades}

  <p style="margin:32px 0 0;padding-top:16px;border-top:1px solid ${HAIRLINE};font-size:11px;color:${TINTA3};line-height:1.6">
    Enviado automaticamente pelo SGPC. Para mudar quem recebe: Painel Admin → Notificações.
  </p>

</td></tr>
</table>

</td></tr>
</table>
</div>`;
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

const txt = (d: any, campo: string) => d?.fields?.[campo]?.stringValue ?? '';
const num = (d: any, campo: string) => Number(d?.fields?.[campo]?.integerValue ?? d?.fields?.[campo]?.doubleValue ?? 0);

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
    const selecoes: Selecao[] = (await lerColecao('selecoes', token)).map(d => ({
      id: d.name.split('/').pop(),
      data: txt(d, 'data'),
      cargo: txt(d, 'cargo'),
      sede: txt(d, 'sede'),
      responsavel: txt(d, 'responsavel'),
      origem: (txt(d, 'origem') || 'geral') as Selecao['origem'],
      status: (txt(d, 'status') || undefined) as Selecao['status'],
      convocados: num(d, 'convocados'),
      compareceram: num(d, 'compareceram'),
      ausentes: num(d, 'ausentes'),
      contratados: num(d, 'contratados'),
      desistiram: num(d, 'desistiram'),
      vagaCodigos: (d.fields?.vagaCodigos?.arrayValue?.values || []).map((v: any) => Number(v.integerValue ?? v.doubleValue ?? 0)),
      motivos: Object.fromEntries(
        Object.entries(d.fields?.motivos?.mapValue?.fields || {})
          .map(([k, v]: any) => [k, Number(v.integerValue ?? v.doubleValue ?? 0)])
      ),
    }));

    const atividades: Atividade[] = (await lerColecao('atividades', token)).map(d => ({
      id: d.name.split('/').pop(),
      data: txt(d, 'data'),
      titulo: txt(d, 'titulo'),
      detalhe: txt(d, 'detalhe'),
      responsavel: txt(d, 'responsavel'),
      sede: txt(d, 'sede'),
    }));

    const email = montarEmailSelecoes(dia, selecoes, atividades);
    // Dia sem NADA registrado não vira e-mail: aviso que quase sempre diz "nada
    // aconteceu" ensina o destinatário a ignorar o remetente. Dia que teve só
    // atividade SAI — houve trabalho e o resumo tem o que contar.
    if (!email.vale) {
      // Registrado mesmo sem enviar: é o que separa "não houve nada" de
      // "quebrou". Sem essa linha, os dois parecem iguais de fora.
      await registrarDisparo(token, { quando, dia, enviado: false, motivo: 'nada registrado neste dia' });
      return res.status(200).json({ enviado: false, motivo: `nada registrado em ${dia}` });
    }

    const transporte = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_APP_PASSWORD },
    });
    try {
      await transporte.sendMail({
        from: `SGPC <${process.env.SMTP_USER}>`,
        to: lista,
        subject: email.assunto,
        text: email.texto,
        html: email.html,
      });
    } catch (e: any) {
      // A falha do SMTP é registrada ANTES de subir: é o caso em que o RH
      // precisa saber que houve tentativa, e o motivo (senha de app recusada,
      // caixa cheia, Gmail bloqueando).
      await registrarDisparo(token, {
        quando, dia, enviado: false,
        motivo: `falha no envio: ${String(e?.message || e).slice(0, 140)}`,
      });
      throw e;
    }

    await registrarDisparo(token, {
      quando, dia, enviado: true,
      motivo: 'enviado',
      destinatarios: lista.length,
      assunto: email.assunto,
    });
    return res.status(200).json({ enviado: true, dia, destinatarios: lista.length, assunto: email.assunto });
  } catch (e: any) {
    console.error('[selecoes-do-dia]', e?.message || e);
    return res.status(500).json({ erro: 'falha ao enviar', detalhe: String(e?.message || e).slice(0, 200) });
  }
}
