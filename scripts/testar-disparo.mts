/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Diagnóstico do disparo das Seleções do dia — roda o MESMO caminho da função
 * da Vercel, na sua máquina, sem esperar as 18h.
 *
 *   npm run testar:disparo              confere tudo e MOSTRA o e-mail (não envia)
 *   npm run testar:disparo -- --enviar  envia de verdade para a lista configurada
 *   npm run testar:disparo -- --dia 17/09/2026   testa um dia específico
 *
 * De onde vêm os valores: das variáveis de ambiente do seu shell ou de um
 * arquivo `.env` na raiz (o `.gitignore` já bloqueia `.env*`). Nada é impresso:
 * o script só diz se a variável ESTÁ presente e se funcionou.
 *
 * Por que existe: a função roda com conta de serviço porque às 18h não há
 * usuário logado, e conta de serviço é justamente o que não se testa pelo
 * navegador. Sem isto, a primeira evidência de erro seria um e-mail que não
 * chegou — e ninguém percebe e-mail que não chega.
 */
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { montarEmailPessoa, relatoPorPessoa, lerContaDeServico, type EntradaLog, type Diario, type Tarefa } from '../api/selecoes-do-dia';

dotenv.config();

const PROJETO = 'project-312a1a63-026e-4dfa-91c';
const BANCO = 'ai-studio-2b395015-7429-44d1-83dd-233de9cd3c47';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/${BANCO}/documents`;

const ENVIAR = process.argv.includes('--enviar');
const iDia = process.argv.indexOf('--dia');
const DIA = iDia > -1 ? process.argv[iDia + 1] : new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Fortaleza', day: '2-digit', month: '2-digit', year: 'numeric',
}).format(new Date());

const ok = (t: string) => console.log(`  OK    ${t}`);
const falha = (t: string) => { console.log(`  FALHA ${t}`); process.exitCode = 1; };

console.log(`\nDiagnóstico do disparo — dia ${DIA}\n`);
console.log('1. Variáveis de ambiente');
// Só a conta de serviço é obrigatória para o diagnóstico: SMTP importa com
// `--enviar`, e o CRON_SECRET é da função na Vercel, não deste script. Marcar
// tudo como FALHA ensinaria a ignorar o relatório.
const temSA = !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
if (temSA) ok('GOOGLE_SERVICE_ACCOUNT_JSON presente');
else falha('GOOGLE_SERVICE_ACCOUNT_JSON AUSENTE — sem ela não há o que testar');

([['SMTP_USER', 'remetente'], ['SMTP_APP_PASSWORD', 'senha de app']] as const).forEach(([v, oque]) => {
  if (process.env[v]) ok(`${v} presente`);
  else console.log(`  ${ENVIAR ? 'FALHA' : '-    '} ${v} ausente (${oque}; necessário só com --enviar)`);
});
if (!process.env.CRON_SECRET) {
  console.log('  -     CRON_SECRET ausente (é da função na Vercel; este script não usa)');
}

if (ENVIAR && (!process.env.SMTP_USER || !process.env.SMTP_APP_PASSWORD)) {
  falha('--enviar exige SMTP_USER e SMTP_APP_PASSWORD');
  process.exit(1);
}
if (!temSA) process.exit(1);

console.log('\n2. Conta de serviço');
// Mesma leitura da função da Vercel, de propósito: em 21 e 22/09 o disparo
// quebrou aqui, e um diagnóstico que aceita o que a produção recusa (ou o
// contrário) é pior que nenhum.
let conta: { client_email: string; private_key: string; project_id?: string };
try {
  conta = lerContaDeServico(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
} catch (e: any) {
  falha(e?.message || String(e));
  process.exit(1);
}
ok(`identidade: ${conta.client_email}`);
if (conta.project_id !== PROJETO) {
  console.log(`  AVISO a conta é do projeto ${conta.project_id}, e o banco é do ${PROJETO} —`);
  console.log('        só funciona se ela tiver datastore.viewer LÁ no projeto do SGPC.');
}

// Mesmo código da função: JWT assinado à mão, sem biblioteca.
console.log('\n3. Token de acesso');
const agora = Math.floor(Date.now() / 1000);
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const cabecalhoJwt = b64({ alg: 'RS256', typ: 'JWT' });
const corpoJwt = b64({
  iss: conta.client_email,
  scope: 'https://www.googleapis.com/auth/datastore',
  aud: 'https://oauth2.googleapis.com/token',
  iat: agora, exp: agora + 3600,
});
let token = '';
try {
  const assinatura = crypto.createSign('RSA-SHA256')
    .update(`${cabecalhoJwt}.${corpoJwt}`)
    .sign(conta.private_key.replace(/\\n/g, '\n'), 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${cabecalhoJwt}.${corpoJwt}.${assinatura}`,
    }),
  });
  const j: any = await r.json();
  if (!j.access_token) { falha(`o Google recusou: ${j.error_description || j.error || 'sem detalhe'}`); process.exit(1); }
  token = j.access_token;
  ok('o Google aceitou a chave e devolveu token');
} catch (e: any) {
  falha(`não consegui assinar o JWT: ${e?.message || e}`);
  process.exit(1);
}

async function lerColecao(colecao: string): Promise<any[]> {
  const docs: any[] = [];
  let pageToken = '';
  do {
    const r = await fetch(`${BASE}/${colecao}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j: any = await r.json();
    if (j.error) throw new Error(j.error.message);
    docs.push(...(j.documents || []));
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  return docs;
}

console.log('\n4. Leitura do Firestore');
let configs: any[] = [];
let logsDocs: any[] = [];
let usuariosDocs: any[] = [];
let diarioDocs: any[] = [];
let tarefasDocs: any[] = [];
try {
  configs = await lerColecao('config');
  ok(`config lida (${configs.length} documentos)`);
} catch (e: any) {
  falha(`não leu config: ${e?.message || e}`);
  console.log('        provável falta de roles/datastore.viewer no projeto do SGPC.');
  process.exit(1);
}
try {
  logsDocs = await lerColecao('logs');
  ok(`log de auditoria lido (${logsDocs.length} registros)`);
  usuariosDocs = await lerColecao('usuarios');
  ok(`usuários lidos (${usuariosDocs.length})`);
  diarioDocs = await lerColecao('diario');
  ok(`"Meu dia" lido (${diarioDocs.length} registros)`);
  tarefasDocs = await lerColecao('tarefasDiario');
  ok(`tarefas da equipe lidas (${tarefasDocs.length} além das 4 padrão)`);
} catch (e: any) {
  falha(`não leu log/usuários/diário: ${e?.message || e}`);
  process.exit(1);
}

const txt = (d: any, c: string) => d?.fields?.[c]?.stringValue ?? '';
const num = (d: any, c: string) => Number(d?.fields?.[c]?.integerValue ?? d?.fields?.[c]?.doubleValue ?? 0);
const mapa = (campo: any) => {
  const f = campo?.mapValue?.fields;
  return f ? Object.fromEntries(Object.entries(f).map(([k, v]: [string, any]) =>
    [k, v.stringValue ?? (v.integerValue !== undefined ? Number(v.integerValue) : v.doubleValue)])) : undefined;
};

console.log('\n5. Destinatários');
const notif = configs.find(d => d.name.endsWith('/notificacoes'));
const lista: string[] = (notif?.fields?.destinatariosSelecoes?.arrayValue?.values || [])
  .map((v: any) => String(v.stringValue || '').trim())
  .filter((e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
const ativo = notif?.fields?.selecoesAtivo?.booleanValue !== false;
if (!notif) falha('config/notificacoes não existe — cadastre alguém em Painel Admin → Notificações');
else if (!lista.length) falha('a lista de destinatários está vazia');
else ok(`${lista.length} destinatário(s): ${lista.join(', ')}`);
if (!ativo) console.log('  AVISO o disparo está DESLIGADO na configuração — nada seria enviado às 18h.');

console.log('\n6. Conteúdo do dia — um e-mail por pessoa');
// O log inteiro, filtrado aqui: é diagnóstico, não precisa economizar leitura
// como a função da Vercel economiza.
const logs: EntradaLog[] = logsDocs.map(d => ({
  timestamp: txt(d, 'timestamp'), usuario: txt(d, 'usuario'),
  acao: txt(d, 'acao'), modulo: txt(d, 'modulo'), detalhes: txt(d, 'detalhes'),
  ref: mapa(d.fields?.ref),
}));
const diarios: Diario[] = diarioDocs.map(d => ({
  email: txt(d, 'email'), data: txt(d, 'data'),
  contagens: mapa(d.fields?.contagens) as Record<string, number> | undefined,
}));
const tarefas: Tarefa[] = tarefasDocs.map(d => ({
  id: d.name.split('/').pop(), nome: txt(d, 'nome'),
  arquivada: d.fields?.arquivada?.booleanValue === true,
  ...(d.fields?.ordem ? { ordem: num(d, 'ordem') } : {}),
}));
const nomes = new Map<string, string>(
  usuariosDocs
    .map(d => [txt(d, 'email').trim().toLowerCase(), txt(d, 'nome').trim()] as [string, string])
    .filter(([e, n]) => e && n)
);
const pessoas = relatoPorPessoa(logs, diarios, DIA, nomes, tarefas);
if (!pessoas.length) {
  console.log(`  Nada registrado em ${DIA} — nesse caso a função NÃO envia (de propósito).`);
  console.log('  Para ver o conteúdo, rode com --dia DD/MM/AAAA num dia com movimento.');
} else {
  ok(`${pessoas.length} pessoa(s) → ${pessoas.length} e-mail(s)`);
  const semNome = pessoas.filter(p => p.nome === p.email).length;
  if (semNome) console.log(`  AVISO ${semNome} sem nome no cadastro de Usuários — o assunto sai com o e-mail.`);
  for (const p of pessoas) {
    const e = montarEmailPessoa(DIA, p);
    console.log(`\n--- ${e.assunto} ---`);
    console.log(e.texto);
  }
  console.log('\n--- fim das prévias ---');
}

if (!ENVIAR) {
  console.log('\nNada enviado. Para enviar de verdade: npm run testar:disparo -- --enviar\n');
  process.exit(process.exitCode || 0);
}

console.log('\n7. Envio');
if (!pessoas.length) { console.log('  nada a enviar neste dia.'); process.exit(0); }
if (!lista.length) { falha('sem destinatários, não envio'); process.exit(1); }
const { default: nodemailer } = await import('nodemailer');
const transporte = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_APP_PASSWORD },
});
try {
  await transporte.verify();
  ok('o Gmail aceitou a senha de app');
} catch (e: any) {
  falha(`o Gmail recusou: ${e?.message || e}`);
  console.log('        senha de APP (16 letras), não a senha da conta; e a conta precisa de 2FA ativo.');
  process.exit(1);
}
for (const p of pessoas) {
  const e = montarEmailPessoa(DIA, p);
  try {
    const info = await transporte.sendMail({
      from: `SGPC <${process.env.SMTP_USER}>`,
      to: lista, subject: e.assunto, text: e.texto, html: e.html,
    });
    ok(`${e.assunto} — id ${info.messageId}`);
  } catch (err: any) {
    falha(`${e.assunto}: ${err?.message || err}`);
  }
}
