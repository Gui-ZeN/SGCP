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

/**
 * @param dia   DD/MM/AAAA — o dia do resumo
 * @param selecoes  já escopadas por unidade por quem chama
 */
export function montarEmailSelecoes(dia: string, selecoes: Selecao[]): EmailSelecoes {
  const doDia = selecoes.filter(s => (s.data || '').trim() === dia);
  const realizadas = doDia.filter(ehRealizada);
  const agendadas = doDia.filter(s => !ehRealizada(s));
  const t = totaisDeSelecoes(doDia);

  // Dia sem seleção NÃO gera e-mail. Um aviso diário que na maior parte dos
  // dias diz "nada aconteceu" é o caminho mais curto para o filtro de lixeira.
  if (doDia.length === 0) {
    return { assunto: '', html: '', texto: '', vale: false };
  }

  const resumo = [
    `${t.convocados} convocados`,
    `${t.compareceram} compareceram`,
    t.taxa !== null ? `${t.taxa}% de comparecimento` : '',
    t.contratados ? plural(t.contratados, 'contratado', 'contratados') : '',
  ].filter(Boolean).join(' · ');

  const assunto = t.convocados > 0
    ? `Seleções de ${dia} — ${t.compareceram} de ${t.convocados} compareceram`
    : `Seleções de ${dia} — ${plural(agendadas.length, 'seleção agendada', 'seleções agendadas')}`;

  const linha = (s: Selecao) => {
    const vagas = codigosDasVagas(s).map(c => `#${c}`).join(' ');
    const numeros = ehRealizada(s)
      ? `${s.convocados || 0} / ${s.compareceram || 0} / ${s.ausentes || 0}`
      : `${s.convocados || 0} / — / —`;
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#1e293b">
        <strong>${escapar(s.cargo)}</strong>${vagas ? ` <span style="color:#64748b">${escapar(vagas)}</span>` : ''}
      </td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#334155">${escapar(s.sede || '—')}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#334155">${escapar(s.responsavel || '—')}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#1e293b;text-align:right;white-space:nowrap">${numeros}</td>
    </tr>`;
  };

  const motivos = new Map<string, number>();
  doDia.forEach(s => Object.entries(s.motivos || {}).forEach(([m, n]) => {
    if (n > 0) motivos.set(m, (motivos.get(m) || 0) + n);
  }));

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;color:#1e293b">
  <p style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#64748b;margin:0 0 4px">SGPC · Seleções do dia</p>
  <h1 style="font-size:20px;margin:0 0 2px">${escapar(dia)}</h1>
  <p style="font-size:14px;color:#334155;margin:0 0 16px"><strong>${escapar(resumo)}</strong></p>

  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border:1px solid #e2e8f0">
    <thead>
      <tr style="background:#f8fafc">
        <th align="left" style="padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#475569;border-bottom:1px solid #e2e8f0">Cargo</th>
        <th align="left" style="padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#475569;border-bottom:1px solid #e2e8f0">Sede</th>
        <th align="left" style="padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#475569;border-bottom:1px solid #e2e8f0">Responsável</th>
        <th align="right" style="padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#475569;border-bottom:1px solid #e2e8f0">Conv. / Comp. / Aus.</th>
      </tr>
    </thead>
    <tbody>${[...realizadas, ...agendadas].map(linha).join('')}</tbody>
  </table>

  ${agendadas.length ? `<p style="font-size:13px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;margin:14px 0 0">
    ${plural(agendadas.length, 'seleção ainda sem confirmação de presença', 'seleções ainda sem confirmação de presença')}.
  </p>` : ''}

  ${motivos.size ? `<p style="font-size:12px;color:#475569;margin:14px 0 0">
    <strong>Desistências:</strong> ${[...motivos.entries()].sort((a, b) => b[1] - a[1]).map(([m, n]) => `${escapar(m)} (${n})`).join(' · ')}
  </p>` : ''}

  <p style="font-size:11px;color:#94a3b8;margin:20px 0 0">
    Enviado automaticamente pelo SGPC. Para mudar quem recebe: Painel Admin → Notificações.
  </p>
</div>`;

  const texto = [
    `SGPC — Seleções do dia ${dia}`,
    resumo,
    '',
    ...[...realizadas, ...agendadas].map(s => {
      const n = ehRealizada(s)
        ? `${s.convocados || 0} convocados, ${s.compareceram || 0} compareceram, ${s.ausentes || 0} ausentes`
        : `${s.convocados || 0} convocados, presença a confirmar`;
      return `- ${s.cargo} · ${s.sede || 's/ sede'} · ${s.responsavel || 's/ responsável'}: ${n}`;
    }),
    agendadas.length ? `\n${plural(agendadas.length, 'seleção sem confirmação', 'seleções sem confirmação')} de presença.` : '',
  ].filter(Boolean).join('\n');

  return { assunto, html, texto, vale: true };
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
 * Token de acesso a partir da conta de serviço, assinando o JWT à mão.
 *
 * São 20 linhas de `node:crypto` em vez de arrastar `google-auth-library` e
 * suas dependências para dentro de uma função serverless que faz uma única
 * chamada. Menos peso no cold start e menos superfície para auditar.
 */
async function tokenDeAcesso(): Promise<string> {
  const bruto = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!bruto) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON ausente');
  const conta = JSON.parse(bruto);

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

    const email = montarEmailSelecoes(dia, selecoes);
    // Dia sem seleção não vira e-mail: aviso que quase sempre diz "nada
    // aconteceu" ensina o destinatário a ignorar o remetente.
    if (!email.vale) {
      // Registrado mesmo sem enviar: é o que separa "não houve seleção" de
      // "quebrou". Sem essa linha, os dois parecem iguais de fora.
      await registrarDisparo(token, { quando, dia, enviado: false, motivo: 'nenhuma seleção neste dia' });
      return res.status(200).json({ enviado: false, motivo: `sem seleções em ${dia}` });
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
