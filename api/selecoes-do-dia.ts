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
 * token de ninguém para o Firestore autorizar. Ela deve ter leitura e nada mais.
 */
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { montarEmailSelecoes } from '../src/utils/emailSelecoes';
import type { Selecao } from '../src/types';

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

export default async function handler(req: any, res: any) {
  // Trava 1: só o cron da Vercel (ou quem tem o segredo) dispara.
  const segredo = process.env.CRON_SECRET;
  const autorizacao = req.headers?.authorization || '';
  if (!segredo || autorizacao !== `Bearer ${segredo}`) {
    return res.status(401).json({ erro: 'não autorizado' });
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

    if (!ativo) return res.status(200).json({ enviado: false, motivo: 'desligado na configuração' });
    if (!lista.length) return res.status(200).json({ enviado: false, motivo: 'sem destinatários configurados' });

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
    if (!email.vale) return res.status(200).json({ enviado: false, motivo: `sem seleções em ${dia}` });

    const transporte = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_APP_PASSWORD },
    });
    await transporte.sendMail({
      from: `SGPC <${process.env.SMTP_USER}>`,
      to: lista,
      subject: email.assunto,
      text: email.texto,
      html: email.html,
    });

    return res.status(200).json({ enviado: true, dia, destinatarios: lista.length, assunto: email.assunto });
  } catch (e: any) {
    console.error('[selecoes-do-dia]', e?.message || e);
    return res.status(500).json({ erro: 'falha ao enviar', detalhe: String(e?.message || e).slice(0, 200) });
  }
}
