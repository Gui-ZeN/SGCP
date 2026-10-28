/**
 * Quadro da Infra (só ASG) lido do Chromos, para marcar a presença numa turma
 * de treinamento (28/10/2026).
 *
 * A ponte, como a do absenteísmo: confere QUEM pede no SGPC e repassa com o
 * segredo, que nunca vai ao navegador. Mesmo segredo e mesmo servidor do
 * absenteísmo (a fronteira de segredo é por sistema; ver a rota
 * `quadro-externo` do Chromos).
 *
 * Travas (revisão de segurança, 28/10/2026):
 *  1. Token de sessão do Firebase do SGPC verificado (`verificarIdToken`).
 *  2. Só EDITOR: papel exatamente Administrador, Coordenador ou Analista, como
 *     `isEditor` das Rules. Visualizador e papel desconhecido: 403 — o
 *     absenteísmo deixa qualquer cadastrado; aqui são nomes.
 *  3. A unidade decidida COMO AS RULES (`minhaUnidade`): o campo `unidade`, e
 *     `colegio` só quando ele não existe. Pela sede (`instituicaoDe`) um
 *     Analista sem `unidade` com sede na Universidade veria nomes que as
 *     Rules não o deixam gravar. Valor fora de colegio/universidade: 403.
 *  4. A resposta do Chromos é relida campo a campo: só matrícula, nome, sede e
 *     a unidade; instituição desconhecida fica fora (nunca vira Colégio).
 *  5. Sem cache, e com prazo: o Chromos parado não segura a função.
 */
import { verificarIdToken } from './absenteismo.js';
import { BASE, PROJETO, campoTexto, tokenDeAcesso } from './selecoes-do-dia.js';

type Unidade = 'colegio' | 'universidade';
const EDITORES = ['Administrador', 'Coordenador', 'Analista'];
const PRAZO_MS = 8000;

export interface PessoaDoQuadro { matricula: string; nome: string; sede: string; unidade: Unidade }

/**
 * A rota do quadro no MESMO servidor do absenteísmo, pela origem — a variável
 * aponta para `/api/absenteismo-externo` e pode trazer query. Só https: o
 * segredo não sai para um endereço mal configurado.
 */
export function urlDoQuadro(urlDoAbsenteismo?: string): URL | null {
  try {
    const u = new URL(urlDoAbsenteismo || '');
    return u.protocol === 'https:' ? new URL('/api/quadro-externo', u.origin) : null;
  } catch {
    return null;
  }
}

/** O que o SGPC aceita do Chromos — tipo a tipo; o resto é descartado. `unidade` null = as duas. */
export function lerPessoas(corpo: unknown, unidade: Unidade | null): PessoaDoQuadro[] {
  const lista = (corpo as { pessoas?: unknown } | null)?.pessoas;
  if (!Array.isArray(lista)) throw new Error('resposta sem a lista de pessoas');
  const saida: PessoaDoQuadro[] = [];
  for (const p of lista) {
    if (!p || typeof p !== 'object') continue;
    const { matricula, nome, sede, instituicao } = p as Record<string, unknown>;
    if (typeof matricula !== 'string' || typeof nome !== 'string' || typeof sede !== 'string' || !nome.trim()) continue;
    const dela: Unidade | null = instituicao === 'Christus' ? 'colegio' : instituicao === 'Unichristus' ? 'universidade' : null;
    if (!dela || (unidade && dela !== unidade)) continue;
    saida.push({ matricula, nome: nome.trim(), sede, unidade: dela });
  }
  return saida.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ erro: 'método não permitido' });

  const alvo = urlDoQuadro(process.env.CROMOS_ABSENTEISMO_URL);
  const segredo = process.env.CROMOS_ABSENTEISMO_TOKEN;
  if (!alvo || !segredo) return res.status(503).json({ erro: 'integração com o Chromos não configurada' });

  const [tipo, token] = String(req.headers?.authorization || '').split(' ');
  if (tipo?.toLowerCase() !== 'bearer' || !token) return res.status(401).json({ erro: 'sem credencial' });

  let email: string;
  try {
    email = await verificarIdToken(token, PROJETO);
  } catch (e: any) {
    console.error('[quadro-infra] token recusado', e?.message);
    return res.status(401).json({ erro: 'credencial recusada' });
  }

  let unidade: Unidade | null;
  try {
    const acesso = await tokenDeAcesso();
    const r = await fetch(`${BASE}/usuarios/${encodeURIComponent(email)}`, { headers: { Authorization: `Bearer ${acesso}` } });
    if (r.status === 404) return res.status(403).json({ erro: 'usuário sem cadastro no SGPC' });
    if (!r.ok) throw new Error(`usuarios: ${r.status}`);
    const doc = await r.json();
    const papel = campoTexto(doc, 'role');
    if (!EDITORES.includes(papel)) return res.status(403).json({ erro: 'só quem edita os treinamentos vê o quadro' });
    if (papel === 'Administrador') unidade = null;
    else {
      const u = doc?.fields?.unidade === undefined ? 'colegio' : campoTexto(doc, 'unidade');
      if (u !== 'colegio' && u !== 'universidade') return res.status(403).json({ erro: 'unidade do cadastro não reconhecida' });
      unidade = u;
    }
  } catch (e: any) {
    console.error('[quadro-infra] não deu para ler o cadastro', e?.message);
    return res.status(502).json({ erro: 'não deu para conferir o cadastro' });
  }

  try {
    const r = await fetch(alvo, { headers: { Authorization: `Bearer ${segredo}` }, signal: AbortSignal.timeout(PRAZO_MS) });
    if (!r.ok) {
      console.error('[quadro-infra] o Chromos respondeu', r.status);
      return res.status(502).json({ erro: 'o Chromos não respondeu' });
    }
    return res.status(200).json({ pessoas: lerPessoas(await r.json(), unidade) });
  } catch (e: any) {
    // Só o tipo do erro: a mensagem de um JSON quebrado cita o corpo (com nomes).
    console.error('[quadro-infra] o Chromos não respondeu', e?.name || 'erro');
    return res.status(502).json({ erro: 'o Chromos não respondeu' });
  }
}
