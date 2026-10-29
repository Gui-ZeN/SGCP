/**
 * Anexos das turmas (fotos e PDFs) no Drive compartilhado do RH, pela rota
 * `/api/anexos` (29/10/2026). O arquivo vai do navegador direto para o Drive
 * (sessão aberta pelo servidor); a foto é reduzida antes, aqui. Ver o desenho
 * e as travas em api/anexos.ts.
 */
import { auth, isFirebaseEnabled } from '../lib/firebase';

export interface Anexo { id: string; nome: string; tipo: string; tamanho: number; criadoEm: string }

export const MAX_ANEXOS = 10;
export const TETO_PDF_MB = 10;
/** Lado maior da foto depois de reduzida: cabe no PDF do relatório e economiza espaço. */
const LADO_MAX = 1600;

/** Erro com frase para o RH (nunca a mensagem técnica). `naoLigado`: a integração ainda não foi configurada. */
export class ErroDeAnexo extends Error { constructor(msg: string, public naoLigado = false, public status = 0) { super(msg); } }

async function chamar(caminho: string, init: RequestInit = {}): Promise<Response> {
  const token = await auth?.currentUser?.getIdToken();
  const r = await fetch(caminho, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
  if (r.ok) return r;
  if (r.status === 503) throw new ErroDeAnexo('Os anexos ainda não estão ligados.', true);
  if (r.status === 401) throw new ErroDeAnexo('Sua sessão expirou: saia e entre de novo.');
  const corpo = await r.json().catch(() => null) as { erro?: string } | null;
  // As recusas da rota já vêm em frase para o RH (tipo, tamanho, teto); o resto vira genérico.
  if ([400, 403, 404, 409, 422].includes(r.status) && corpo?.erro) throw new ErroDeAnexo(corpo.erro.charAt(0).toUpperCase() + corpo.erro.slice(1) + '.', false, r.status);
  throw new ErroDeAnexo('Não deu para falar com o Drive. Tente de novo em instantes.');
}
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const rota = (q: Record<string, string>) => `/api/anexos?${new URLSearchParams(q)}`;

export async function listarAnexos(turmaId: string): Promise<Anexo[]> {
  if (!isFirebaseEnabled) return [];
  const r = await chamar(rota({ acao: 'listar', treinamento: turmaId }));
  return ((await r.json()) as { anexos: Anexo[] }).anexos;
}

/** Foto reduzida para JPEG (também converte HEIC onde o navegador sabe abrir). PDF passa como está. */
export async function prepararArquivo(f: File): Promise<File> {
  if (f.type === 'application/pdf') {
    if (f.size > TETO_PDF_MB * 1024 * 1024) throw new ErroDeAnexo(`PDF acima de ${TETO_PDF_MB} MB.`);
    return f;
  }
  if (!f.type.startsWith('image/')) throw new ErroDeAnexo('Só fotos e PDF.');
  let img: ImageBitmap;
  try { img = await createImageBitmap(f); } catch { throw new ErroDeAnexo('Este formato de foto não abre no navegador: tire um print ou salve como JPG.'); }
  const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); // PNG transparente não fica preto no JPEG
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>(ok => c.toBlob(ok, 'image/jpeg', 0.85));
  if (!blob) throw new ErroDeAnexo('Não deu para preparar a foto.');
  return new File([blob], f.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

export async function enviarAnexo(turmaId: string, original: File): Promise<void> {
  const f = await prepararArquivo(original);
  const json = { 'Content-Type': 'application/json' };
  const i = await chamar(rota({ acao: 'iniciar' }), { method: 'POST', headers: json,
    body: JSON.stringify({ treinamentoId: turmaId, nome: original.name, tipo: f.type, tamanho: f.size }) });
  const { sessao } = await i.json() as { sessao: string };
  const envio = await fetch(sessao, { method: 'PUT', headers: { 'Content-Type': f.type }, body: f });
  if (!envio.ok) throw new ErroDeAnexo('O envio para o Drive falhou. Tente de novo.');
  const { id } = await envio.json() as { id: string };
  await chamar(rota({ acao: 'confirmar' }), { method: 'POST', headers: json, body: JSON.stringify({ treinamentoId: turmaId, arquivo: id }) });
}

/** O arquivo inteiro: o PDF grande vem em pedaços (a Vercel não devolve mais de ~4,5 MB por vez). */
export async function baixarAnexo(turmaId: string, a: Pick<Anexo, 'id' | 'tipo'>): Promise<Blob> {
  const partes: ArrayBuffer[] = [];
  let total = 1;
  for (let p = 0; p < total; p++) {
    const r = await chamar(rota({ acao: 'baixar', treinamento: turmaId, arquivo: a.id, parte: String(p) }));
    total = Number(r.headers.get('X-Partes')) || 1;
    partes.push(await r.arrayBuffer());
  }
  // Tipo da lista fixa, não o da resposta: um blob: herda a origem do app.
  return new Blob(partes, { type: TIPOS.includes(a.tipo) ? a.tipo : 'application/octet-stream' });
}

export async function apagarAnexo(turmaId: string, arquivo: string): Promise<void> {
  await chamar(rota({ acao: 'apagar', treinamento: turmaId, arquivo }), { method: 'DELETE' });
}

/**
 * Antes de apagar a turma: os anexos vão para a lixeira do Drive (as
 * coordenadoras não ficam com fotos de turma que não existe). Se não deu,
 * a turma NÃO é apagada — quem chama deixa o erro subir.
 */
export async function apagarAnexosDaTurma(turmaId: string): Promise<void> {
  if (!isFirebaseEnabled) return;
  try {
    await chamar(rota({ acao: 'apagar', treinamento: turmaId, todos: '1' }), { method: 'DELETE' });
  } catch (e) {
    // Integração desligada, ou turma sem unidade gravada (o envio exige a unidade):
    // não há anexo nenhum para sobrar.
    if (e instanceof ErroDeAnexo && (e.naoLigado || e.status === 409)) return;
    throw e;
  }
}
