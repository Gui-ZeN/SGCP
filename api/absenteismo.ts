/**
 * Absenteísmo da Infraestrutura, lido do Chromos (06/10/2026).
 *
 * O Chromos calcula a taxa com a fórmula dele (`/api/absenteismo-externo`) e
 * devolve só números agregados. Esta função é a ponte: confere QUEM está
 * pedindo no SGPC e repassa o pedido com o segredo, que nunca vai ao navegador.
 *
 * Travas:
 *  1. Token de sessão do Firebase do SGPC verificado aqui (assinatura,
 *     projeto, emissor, validade, e-mail confirmado) — sem Admin SDK, o mesmo
 *     porteiro que o Chromos usa para ler o SGPC.
 *  2. O e-mail precisa estar em `usuarios`, como no resto do sistema.
 *  3. Colégio e Universidade separados: a INSTITUIÇÃO vai no pedido, decidida
 *     aqui pelo cadastro — nunca pelo navegador. Administrador vê as duas.
 */
import crypto from 'node:crypto';
import { BASE, PROJETO, campoTexto, emailsDaUniversidade, tokenDeAcesso } from './selecoes-do-dia.js';

const CERTIFICADOS = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function verificarIdToken(token: string, projeto: string, buscar: typeof fetch = fetch): Promise<string> {
  const partes = token.split('.');
  if (partes.length !== 3) throw new Error('token malformado');
  const [cab, corpoB64, assinatura] = partes;
  const ler = (s: string) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
  const cabeca = ler(cab) as { alg?: string; kid?: string };
  // `alg: none` é o ataque clássico: sem esta linha passaria sem assinatura.
  if (cabeca.alg !== 'RS256' || !cabeca.kid) throw new Error('assinatura não é RS256');

  const r = await buscar(CERTIFICADOS);
  if (!r.ok) throw new Error('chaves públicas indisponíveis');
  const certificado = ((await r.json()) as Record<string, string>)[cabeca.kid];
  if (!certificado) throw new Error('chave desconhecida');
  // A ASSINATURA antes de ler qualquer reivindicação.
  if (!crypto.createVerify('RSA-SHA256').update(`${cab}.${corpoB64}`).verify(certificado, assinatura, 'base64url')) {
    throw new Error('assinatura inválida');
  }

  const c = ler(corpoB64) as { aud?: string; iss?: string; exp?: number; sub?: string; email?: string; email_verified?: boolean };
  if (c.aud !== projeto || c.iss !== `https://securetoken.google.com/${projeto}`) throw new Error('token de outro projeto');
  if (!c.exp || c.exp * 1000 <= Date.now() || !c.sub) throw new Error('token vencido');
  if (!c.email || c.email_verified !== true) throw new Error('e-mail não confirmado');
  return c.email.trim().toLowerCase();
}

/** A instituição do Chromos para quem pede: Administrador vê a rede inteira. */
export function instituicaoDe(usuario: { role: string; unidade?: string; sede?: string; email: string }, daUniversidade: Set<string>): 'Christus' | 'Unichristus' | undefined {
  if (usuario.role === 'Administrador') return undefined;
  return daUniversidade.has(usuario.email) ? 'Unichristus' : 'Christus';
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'método não permitido' });

  const url = process.env.CROMOS_ABSENTEISMO_URL;
  const segredo = process.env.CROMOS_ABSENTEISMO_TOKEN;
  // "Não ligado" e "falhou" respondem diferente: a tela diz qual dos dois.
  if (!url || !segredo) return res.status(503).json({ erro: 'integração com o Chromos não configurada' });

  const [tipo, token] = String(req.headers?.authorization || '').split(' ');
  if (tipo?.toLowerCase() !== 'bearer' || !token) return res.status(401).json({ erro: 'sem credencial' });

  const de = String(req.query?.de || ''), ate = String(req.query?.ate || '');
  if (!MES.test(de) || !MES.test(ate) || de > ate) return res.status(400).json({ erro: 'período inválido' });

  let email: string;
  try {
    email = await verificarIdToken(token, PROJETO);
  } catch (e: any) {
    console.error('[absenteismo] token recusado', e?.message);
    return res.status(401).json({ erro: 'credencial recusada' });
  }

  let instituicao: 'Christus' | 'Unichristus' | undefined;
  try {
    const acesso = await tokenDeAcesso();
    const ler = async (caminho: string) => {
      const r = await fetch(`${BASE}/${caminho}`, { headers: { Authorization: `Bearer ${acesso}` } });
      return r;
    };
    const rUsuario = await ler(`usuarios/${encodeURIComponent(email)}`);
    if (rUsuario.status === 404) return res.status(403).json({ erro: 'usuário sem cadastro no SGPC' });
    if (!rUsuario.ok) throw new Error(`usuarios: ${rUsuario.status}`);
    const doc = await rUsuario.json();
    const usuario = { email, role: campoTexto(doc, 'role'), unidade: campoTexto(doc, 'unidade'), sede: campoTexto(doc, 'sede') };
    const rSedes = await ler('sedes?pageSize=300');
    const sedes = ((await rSedes.json()).documents || []).map((d: any) => ({ nome: campoTexto(d, 'nome'), sigla: campoTexto(d, 'sigla'), regiao: campoTexto(d, 'regiao') }));
    instituicao = instituicaoDe(usuario, emailsDaUniversidade([usuario], sedes));
  } catch (e: any) {
    console.error('[absenteismo] não deu para ler o cadastro', e?.message);
    return res.status(502).json({ erro: 'não deu para conferir o cadastro' });
  }

  try {
    const alvo = new URL(url);
    alvo.searchParams.set('de', de);
    alvo.searchParams.set('ate', ate);
    if (instituicao) alvo.searchParams.set('instituicao', instituicao);
    const r = await fetch(alvo, { headers: { Authorization: `Bearer ${segredo}` } });
    if (!r.ok) {
      console.error('[absenteismo] o Chromos respondeu', r.status);
      return res.status(502).json({ erro: 'o Chromos não respondeu' });
    }
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).json(await r.json());
  } catch (e: any) {
    console.error('[absenteismo] o Chromos não respondeu', e?.message);
    return res.status(502).json({ erro: 'o Chromos não respondeu' });
  }
}
