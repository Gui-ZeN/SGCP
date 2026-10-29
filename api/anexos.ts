/**
 * Anexos dos treinamentos (fotos e PDFs) num Drive compartilhado do RH
 * (29/10/2026). Quem vê e mexe pelo SGPC: só o RH (editor) da unidade da
 * turma — a mesma regra da presença. As coordenadoras veem direto no Drive,
 * por decisão do Guilherme; isso fica fora deste controle.
 *
 * Desenho e travas vêm da revisão de segurança antes do código (29/10/2026):
 *  1. A conta de serviço `sgpc-anexos` entra pela federação OIDC da Vercel
 *     (sem chave guardada) e com escopo `drive.file`: só enxerga o que ela
 *     mesma criou. Uma credencial vazada não lê o resto do Drive.
 *  2. O registro dos anexos é o próprio Drive (`appProperties` do arquivo),
 *     não o Firestore: o documento da turma é lido até pelo Visualizador, e
 *     a conta do servidor não ganha poder de escrita no banco.
 *  3. A unidade é a da TURMA no Firestore, nunca a do pedido; a pasta de cada
 *     unidade é conferida pela marca que a própria conta gravou nela.
 *  4. O Drive não confere o conteúdo: no confirmar, os primeiros bytes têm de
 *     bater com o tipo declarado (senão, lixeira). Na entrega, o tipo sai da
 *     lista fixa, com `nosniff` e `sandbox` — um HTML disfarçado não roda.
 *  5. Upload direto do navegador para o Drive (sessão resumável): a Vercel
 *     recusa corpo acima de ~4,5 MB. Download de PDF em pedaços pelo mesmo
 *     motivo.
 *  6. Teto de 10 por turma decidido no confirmar, por ordem de criação: a
 *     corrida não passa de 10 confirmados.
 *  7. Varredura diária (cron): lixeira para o que nunca foi confirmado em 24 h
 *     e para anexo de turma apagada; muda de pasta o de turma que trocou de
 *     unidade.
 *  8. Log só com ids e status — nunca nome de arquivo, e-mail, token ou a URL
 *     da sessão (que vale como credencial de envio).
 *
 * VARIÁVEIS (Vercel; nenhuma entra no repositório):
 *   GCP_WIF_AUDIENCE          //iam.googleapis.com/projects/<nº>/locations/global/workloadIdentityPools/<pool>/providers/<provedor>
 *   DRIVE_SA_EMAIL            sgpc-anexos@project-312a1a63-026e-4dfa-91c.iam.gserviceaccount.com
 *   DRIVE_PASTA_COLEGIO       id da pasta do Colégio (criada pela conta: scripts/criar-pastas-anexos.mjs)
 *   DRIVE_PASTA_UNIVERSIDADE  id da pasta da Universidade
 *   APP_ORIGEM                https://<domínio do SGPC> — o único Origin que o Drive aceita no envio
 *   CRON_SECRET               (já existe) autoriza a varredura
 */
import crypto from 'node:crypto';
import { editorQuePede } from './quadro-infra.js';
import { BASE, campoTexto, tokenDeAcesso } from './selecoes-do-dia.js';

type Unidade = 'colegio' | 'universidade';
const MB = 1024 * 1024;
export const MAX_ANEXOS = 10;
/** Pedaço do download: abaixo do teto de resposta da Vercel (~4,5 MB). */
export const PEDACO = 4 * MB;

/** Os únicos tipos aceitos, com o teto e a assinatura dos primeiros bytes. */
export const TIPOS: Record<string, { ext: string; teto: number; assinatura: (b: Uint8Array) => boolean }> = {
  'image/jpeg': { ext: 'jpg', teto: 3 * MB, assinatura: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: 'png', teto: 3 * MB, assinatura: b => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x) },
  'image/webp': { ext: 'webp', teto: 3 * MB, assinatura: b => texto(b, 0, 4) === 'RIFF' && texto(b, 8, 12) === 'WEBP' },
  'application/pdf': { ext: 'pdf', teto: 10 * MB, assinatura: b => texto(b, 0, 5) === '%PDF-' },
};
const texto = (b: Uint8Array, de: number, ate: number) => String.fromCharCode(...b.slice(de, ate));

const ID_TURMA = /^[A-Za-z0-9_-]{1,128}$/;
const ID_DRIVE = /^[A-Za-z0-9_-]{10,100}$/;
const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const DIA_MS = 24 * 60 * 60 * 1000;

class Recusa extends Error { constructor(public status: number, msg: string) { super(msg); } }

/**
 * O nome que a pessoa deu, limpo para guardar e mostrar: sem caminho, sem
 * caractere de controle nem de inversão de texto, até 100 bytes (o Drive
 * aceita 124 por chave + valor em `appProperties`).
 */
export function nomeLimpo(bruto: unknown): string {
  let s = String(bruto ?? '').split(/[\\/]/).pop() || '';
  s = s.replace(/[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').trim();
  // Corta por caractere inteiro: cortar no meio de um emoji deixava meio par
  // UTF-16 e o download daquele anexo quebrava (revisão de segurança, 29/10/2026).
  const cs = [...s];
  while (Buffer.byteLength(cs.join(''), 'utf8') > 100) cs.pop();
  s = cs.join('');
  return s || 'arquivo';
}

/** `Content-Disposition` com o nome em UTF-8 e uma alternativa ASCII (sem aspas nem quebra). */
export function disposicao(tipo: 'inline' | 'attachment', nome: string): string {
  const ascii = nome.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '') || 'arquivo';
  return `${tipo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}

// ── credencial do Drive (federação OIDC da Vercel → conta de serviço) ─────────

let cache: { token: string; ate: number } | null = null;

export async function tokenDoDrive(req: any): Promise<string> {
  if (cache && cache.ate > Date.now()) return cache.token;
  const audiencia = process.env.GCP_WIF_AUDIENCE?.trim();
  const conta = process.env.DRIVE_SA_EMAIL?.trim();
  const oidc = req?.headers?.['x-vercel-oidc-token'] || process.env.VERCEL_OIDC_TOKEN;
  if (!audiencia || !conta || !oidc) throw new Recusa(503, 'anexos não configurados');

  const sts = await fetch('https://sts.googleapis.com/v1/token', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grantType: 'urn:ietf:params:oauth:grant-type:token-exchange', audience: audiencia,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
      subjectToken: oidc, subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt',
    }),
  });
  if (!sts.ok) throw new Error(`sts ${sts.status}`);
  const federado = (await sts.json()).access_token;
  const r = await fetch(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(conta)}:generateAccessToken`, {
    method: 'POST', headers: { Authorization: `Bearer ${federado}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: ['https://www.googleapis.com/auth/drive.file'], lifetime: '900s' }),
  });
  if (!r.ok) throw new Error(`iamcredentials ${r.status}`);
  const token = (await r.json()).accessToken as string;
  cache = { token, ate: Date.now() + 10 * 60 * 1000 };
  return token;
}
/** Só para os testes. */
export const esquecerToken = () => { cache = null; };

// ── Drive ────────────────────────────────────────────────────────────────────

interface Arquivo {
  id: string; mimeType: string; size?: string; parents?: string[]; trashed?: boolean; createdTime: string;
  appProperties?: Record<string, string>;
}
const CAMPOS = 'id,mimeType,size,parents,trashed,createdTime,appProperties';

async function drive(token: string, caminho: string, init: RequestInit = {}): Promise<Response> {
  const r = await fetch(caminho, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  if (!r.ok && r.status !== 404) throw new Error(`drive ${r.status}`);
  return r;
}
async function metadados(token: string, id: string): Promise<Arquivo | null> {
  const r = await drive(token, `${DRIVE}/${encodeURIComponent(id)}?supportsAllDrives=true&fields=${CAMPOS}`);
  return r.status === 404 ? null : r.json();
}
async function paraLixeira(token: string, id: string) {
  await drive(token, `${DRIVE}/${encodeURIComponent(id)}?supportsAllDrives=true`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }),
  });
}
async function listar(token: string, q: string): Promise<Arquivo[]> {
  const todos: Arquivo[] = [];
  let pagina = '';
  do {
    const r = await drive(token, `${DRIVE}?supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&pageSize=200`
      + `&orderBy=createdTime&fields=nextPageToken,files(${CAMPOS})&q=${encodeURIComponent(q)}${pagina ? `&pageToken=${pagina}` : ''}`);
    const j = await r.json();
    todos.push(...(j.files || []));
    pagina = j.nextPageToken || '';
  } while (pagina);
  return todos;
}
const daTurma = (token: string, turma: string) =>
  listar(token, `appProperties has { key='treinamentoId' and value='${turma}' } and trashed=false`);
/** Confirmados, na ordem que decide o teto (criação, depois id). */
const confirmados = (l: Arquivo[]) => l.filter(a => a.appProperties?.confirmado === 'sim')
  .sort((a, b) => a.createdTime.localeCompare(b.createdTime) || a.id.localeCompare(b.id));

const pastas = new Map<Unidade, string>();
/** A pasta da unidade, conferida pela marca gravada nela pela conta: variável trocada não vaza de uma unidade para a outra. */
async function pastaDa(token: string, unidade: Unidade): Promise<string> {
  const ja = pastas.get(unidade);
  if (ja) return ja;
  const col = process.env.DRIVE_PASTA_COLEGIO?.trim(), uni = process.env.DRIVE_PASTA_UNIVERSIDADE?.trim();
  const id = unidade === 'colegio' ? col : uni;
  if (!col || !uni || col === uni || !id || !ID_DRIVE.test(id)) throw new Recusa(503, 'anexos não configurados');
  const p = await metadados(token, id);
  if (!p || p.trashed || p.mimeType !== 'application/vnd.google-apps.folder' || p.appProperties?.sgpcPasta !== unidade) {
    console.error('[anexos] pasta da unidade não confere', unidade);
    throw new Recusa(503, 'anexos não configurados');
  }
  pastas.set(unidade, id);
  return id;
}
/** Só para os testes. */
export const esquecerPastas = () => pastas.clear();

// ── turma e acesso ───────────────────────────────────────────────────────────

/** A unidade da turma, lida do Firestore: a autoridade é ela, não o pedido. */
async function unidadeDaTurma(turma: string): Promise<Unidade | null> {
  const acesso = await tokenDeAcesso();
  const r = await fetch(`${BASE}/treinamentos/${encodeURIComponent(turma)}`, { headers: { Authorization: `Bearer ${acesso}` } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`treinamentos ${r.status}`);
  const e = campoTexto(await r.json(), 'escopo');
  if (e !== 'colegio' && e !== 'universidade') throw new Recusa(409, 'turma sem unidade');
  return e;
}

async function acessoATurma(req: any, turma: unknown): Promise<{ turma: string; unidade: Unidade }> {
  const quem = await editorQuePede(req, 'anexos');
  if ('status' in quem) throw new Recusa(quem.status, quem.erro);
  if (typeof turma !== 'string' || !ID_TURMA.test(turma)) throw new Recusa(400, 'turma inválida');
  const unidade = await unidadeDaTurma(turma);
  if (!unidade) throw new Recusa(404, 'turma não encontrada');
  if (quem.unidade && quem.unidade !== unidade) throw new Recusa(403, 'turma de outra unidade');
  return { turma, unidade };
}

/** O arquivo é desta turma, pelo que a conta gravou nele — nunca pelo parâmetro. */
async function anexoDaTurma(token: string, turma: string, arquivo: unknown, soConfirmado = true): Promise<Arquivo> {
  if (typeof arquivo !== 'string' || !ID_DRIVE.test(arquivo)) throw new Recusa(400, 'arquivo inválido');
  const a = await metadados(token, arquivo);
  if (!a || a.trashed || a.appProperties?.treinamentoId !== turma || !TIPOS[a.mimeType]
    || (soConfirmado && a.appProperties?.confirmado !== 'sim')) throw new Recusa(404, 'anexo não encontrado');
  return a;
}

// ── ações ────────────────────────────────────────────────────────────────────

async function iniciar(req: any, res: any) {
  const { treinamentoId, nome, tipo, tamanho } = req.body || {};
  const { turma, unidade } = await acessoATurma(req, treinamentoId);
  const t = typeof tipo === 'string' ? TIPOS[tipo] : undefined;
  if (!t) throw new Recusa(400, 'tipo de arquivo não aceito (JPG, PNG, WebP ou PDF)');
  if (!Number.isInteger(tamanho) || tamanho <= 0 || tamanho > t.teto) throw new Recusa(400, `arquivo acima de ${t.teto / MB} MB`);
  const origem = process.env.APP_ORIGEM?.trim();
  if (!origem || !/^https:\/\/[^/]+$/.test(origem)) throw new Recusa(503, 'anexos não configurados');

  const token = await tokenDoDrive(req);
  const pasta = await pastaDa(token, unidade);
  if (confirmados(await daTurma(token, turma)).length >= MAX_ANEXOS) throw new Recusa(409, `a turma já tem ${MAX_ANEXOS} anexos`);

  const r = await drive(token, `${UPLOAD}?uploadType=resumable&supportsAllDrives=true&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': tipo, 'X-Upload-Content-Length': String(tamanho), Origin: origem },
    body: JSON.stringify({
      name: `${turma}-${crypto.randomUUID()}.${t.ext}`, parents: [pasta], mimeType: tipo,
      appProperties: { treinamentoId: turma, escopo: unidade, nome: nomeLimpo(nome), tipo, confirmado: 'nao' },
    }),
  });
  const sessao = r.headers.get('location');
  if (!sessao?.startsWith('https://www.googleapis.com/upload/drive/')) throw new Error('drive sem sessão');
  return res.status(200).json({ sessao });
}

async function confirmar(req: any, res: any) {
  const { treinamentoId, arquivo } = req.body || {};
  const { turma, unidade } = await acessoATurma(req, treinamentoId);
  const token = await tokenDoDrive(req);
  const pasta = await pastaDa(token, unidade);
  const a = await anexoDaTurma(token, turma, arquivo, false);
  if (a.appProperties?.confirmado === 'sim') return res.status(200).json({ ok: true });
  if (a.appProperties?.escopo !== unidade || !a.parents?.includes(pasta)) throw new Recusa(403, 'anexo de outra unidade');

  const t = TIPOS[a.mimeType];
  const recusar = async (status: number, msg: string) => { await paraLixeira(token, a.id); throw new Recusa(status, msg); };
  if (a.appProperties?.tipo !== a.mimeType) await recusar(422, 'tipo do arquivo não confere');
  const tamanho = Number(a.size);
  if (!(tamanho > 0) || tamanho > t.teto) await recusar(422, `arquivo acima de ${t.teto / MB} MB`);
  const inicio = await drive(token, `${DRIVE}/${encodeURIComponent(a.id)}?alt=media&supportsAllDrives=true`, { headers: { Range: 'bytes=0-15' } });
  if (!t.assinatura(new Uint8Array(await inicio.arrayBuffer()))) await recusar(422, 'o conteúdo não é do tipo declarado');

  // Teto pela ordem de criação, conferido DEPOIS de marcar: em confirmações
  // simultâneas cada uma já vê as outras marcadas, e só as 10 primeiras ficam.
  // (Conferir antes deixava passar as três de uma corrida — teste "teto de 10".)
  await drive(token, `${DRIVE}/${encodeURIComponent(a.id)}?supportsAllDrives=true`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appProperties: { confirmado: 'sim' } }),
  });
  if (confirmados(await daTurma(token, turma)).slice(MAX_ANEXOS).some(x => x.id === a.id)) await recusar(409, `a turma já tem ${MAX_ANEXOS} anexos`);
  return res.status(200).json({ ok: true });
}

async function listarDaTurma(req: any, res: any) {
  const { turma } = await acessoATurma(req, req.query?.treinamento);
  const token = await tokenDoDrive(req);
  const anexos = confirmados(await daTurma(token, turma)).slice(0, MAX_ANEXOS).filter(a => TIPOS[a.mimeType]).map(a => ({
    id: a.id, nome: a.appProperties?.nome || 'arquivo', tipo: a.mimeType, tamanho: Number(a.size) || 0, criadoEm: a.createdTime,
  }));
  return res.status(200).json({ anexos });
}

async function baixar(req: any, res: any) {
  const { turma } = await acessoATurma(req, req.query?.treinamento);
  const token = await tokenDoDrive(req);
  const a = await anexoDaTurma(token, turma, req.query?.arquivo);
  const tamanho = Number(a.size) || 0, partes = Math.max(1, Math.ceil(tamanho / PEDACO));
  const parte = Number(req.query?.parte ?? 0);
  if (!Number.isInteger(parte) || parte < 0 || parte >= partes) throw new Recusa(400, 'parte inválida');
  const fim = Math.min(tamanho, (parte + 1) * PEDACO) - 1;
  const r = await drive(token, `${DRIVE}/${encodeURIComponent(a.id)}?alt=media&supportsAllDrives=true`, { headers: { Range: `bytes=${parte * PEDACO}-${fim}` } });
  const corpo = Buffer.from(await r.arrayBuffer());
  // Tipo da lista fixa (nunca o do Drive), sem farejar, sem rodar nada, sem cache em lugar nenhum.
  res.setHeader('Content-Type', a.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
  res.setHeader('Content-Disposition', disposicao(a.mimeType === 'application/pdf' ? 'attachment' : 'inline', a.appProperties?.nome || 'arquivo'));
  res.setHeader('X-Partes', String(partes));
  return res.status(200).end(corpo);
}

async function apagar(req: any, res: any) {
  const { turma } = await acessoATurma(req, req.query?.treinamento);
  const token = await tokenDoDrive(req);
  // `todos`: antes de apagar a turma (nada fica órfão no Drive à vista das coordenadoras).
  const alvos = req.query?.todos === '1' ? await daTurma(token, turma) : [await anexoDaTurma(token, turma, req.query?.arquivo, false)];
  for (const a of alvos) await paraLixeira(token, a.id);
  return res.status(200).json({ apagados: alvos.length });
}

/** Cron diário: sessão nunca confirmada, turma apagada, turma que trocou de unidade. */
async function varrer(req: any, res: any) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return res.status(503).json({ erro: 'varredura não configurada' });
  const h = (s: string) => crypto.createHash('sha256').update(s).digest();
  if (!crypto.timingSafeEqual(h(String(req.headers?.authorization || '')), h(`Bearer ${segredo}`))) return res.status(401).json({ erro: 'não autorizado' });

  const token = await tokenDoDrive(req);
  const todos = await listar(token, "appProperties has { key='confirmado' and value='sim' } and trashed=false");
  const pendentes = await listar(token, "appProperties has { key='confirmado' and value='nao' } and trashed=false");
  let lixeira = 0, movidos = 0;
  for (const a of pendentes) if (Date.now() - Date.parse(a.createdTime) > DIA_MS) { await paraLixeira(token, a.id); lixeira++; }
  // Teto de 10: a busca do Drive pode demorar a refletir confirmações
  // simultâneas e deixar passar um 11º. O que estiver além do 10º, por ordem de
  // criação, vai para a lixeira aqui.
  const porTurma = new Map<string, Arquivo[]>();
  for (const a of todos) porTurma.set(a.appProperties?.treinamentoId || '', [...(porTurma.get(a.appProperties?.treinamentoId || '') || []), a]);
  const excedentes = new Set([...porTurma.values()].flatMap(l => confirmados(l).slice(MAX_ANEXOS).map(a => a.id)));
  for (const id of excedentes) { await paraLixeira(token, id); lixeira++; }

  const unidades = new Map<string, Unidade | null | undefined>();
  for (const a of todos) {
    if (excedentes.has(a.id)) continue;
    const turma = a.appProperties?.treinamentoId || '';
    if (!ID_TURMA.test(turma)) continue;
    // Turma sem unidade (409) fica como está: só turma APAGADA (null) leva o anexo para a lixeira.
    if (!unidades.has(turma)) unidades.set(turma, await unidadeDaTurma(turma).catch(e => (e instanceof Recusa ? undefined : Promise.reject(e))));
    const unidade = unidades.get(turma);
    if (unidade === undefined) continue;
    if (unidade === null) { await paraLixeira(token, a.id); lixeira++; continue; }
    if (a.appProperties?.escopo !== unidade) {
      const de = await pastaDa(token, a.appProperties?.escopo === 'universidade' ? 'universidade' : 'colegio');
      const para = await pastaDa(token, unidade);
      await drive(token, `${DRIVE}/${encodeURIComponent(a.id)}?supportsAllDrives=true&addParents=${para}&removeParents=${de}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appProperties: { escopo: unidade } }),
      });
      movidos++;
    }
  }
  return res.status(200).json({ lixeira, movidos });
}

const ACOES: Record<string, [string, (req: any, res: any) => Promise<unknown>]> = {
  iniciar: ['POST', iniciar], confirmar: ['POST', confirmar], listar: ['GET', listarDaTurma],
  baixar: ['GET', baixar], apagar: ['DELETE', apagar], varrer: ['GET', varrer],
};

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'private, no-store');
  const acao = ACOES[String(req.query?.acao || '')];
  if (!acao || req.method !== acao[0]) return res.status(405).json({ erro: 'método não permitido' });
  try {
    return await acao[1](req, res);
  } catch (e: any) {
    if (e instanceof Recusa) return res.status(e.status).json({ erro: e.message });
    // Só a ação, o tipo do erro e o status das NOSSAS mensagens ("drive 403"): as do Drive repetem metadados.
    const status = /^(drive|sts|iamcredentials|treinamentos) \d{3}$/.test(e?.message) ? e.message : '';
    console.error('[anexos] falhou', String(req.query?.acao), e?.name || 'erro', status);
    return res.status(502).json({ erro: 'não deu para falar com o Drive' });
  }
}
