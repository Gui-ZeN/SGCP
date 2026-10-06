/**
 * Vagas criadas por outro sistema (06/10/2026) — hoje só o Chromos: substituição
 * de quem abandonou o emprego (15 dias corridos de falta injustificada).
 *
 * POST /api/vagas-externas · Authorization: Bearer <SGPC_VAGAS_TOKEN>
 *
 * Travas:
 *  1. Segredo comparado por hash, em tempo constante. Sem a variável no
 *     ambiente, 503 para todos — a rota não abre por esquecimento.
 *  2. IDEMPOTENTE por `origem.caso`: o id do documento SAI do caso e a gravação
 *     exige "não existe". Dois envios do mesmo caso — mesmo simultâneos — dão
 *     UMA vaga; o segundo recebe a que já existe (200).
 *  3. Cargo, setor e sede validados contra os CADASTROS do SGPC. A sede é
 *     aceita por nome ou sigla e gravada pelo NOME, como o formulário grava.
 *  4. A vaga nasce como a do formulário de Nova Vaga: ABERTA, em "Triagem de
 *     currículos", responsável RH. Motivo "Substituição por desligamento"
 *     (decisão do Guilherme); o abandono fica dito na observação.
 *  5. Log como `sistema`: não vira relato de ninguém no e-mail das 18h.
 */
import crypto from 'node:crypto';
import { BASE, campoTexto, tokenDeAcesso } from './selecoes-do-dia.js';

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const CASO = /^[A-Za-z0-9_.-]{1,100}$/;
export const MOTIVO = 'Substituição por desligamento';

export function segredoConfere(recebido: string, esperado: string): boolean {
  const h = (s: string) => crypto.createHash('sha256').update(s).digest();
  return !!recebido && !!esperado && crypto.timingSafeEqual(h(recebido), h(esperado));
}

const chave = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export interface Catalogos {
  cargos: string[];
  setores: string[];
  sedes: { nome: string; sigla?: string }[];
}

export interface PedidoValido {
  docId: string;
  caso: string;
  campos: Record<string, string | number>;
}

/** O pedido do outro sistema → a vaga do SGPC, ou a frase do que está errado. */
export function validarPedido(corpo: any, cat: Catalogos, agora: Date): PedidoValido | { erro: string } {
  if (!corpo || typeof corpo !== 'object') return { erro: 'O corpo precisa ser um JSON.' };
  if (corpo.versao !== 1) return { erro: 'Versão do pedido não suportada (esperado "versao": 1).' };
  if (corpo.origem?.sistema !== 'Chromos') return { erro: 'Sistema de origem não autorizado (esperado "Chromos").' };
  const caso = texto(corpo.origem?.caso, 200);
  if (!CASO.test(caso)) return { erro: 'origem.caso é obrigatório: até 100 caracteres, só letras, números, ponto, hífen e sublinhado.' };

  const cargo = cat.cargos.find(c => chave(c) === chave(corpo.cargo));
  if (!cargo) return { erro: `Cargo "${texto(corpo.cargo, 80)}" não está no cadastro de cargos do SGPC.` };
  const setor = cat.setores.find(s => chave(s) === chave(corpo.setor));
  if (!setor) return { erro: `Setor "${texto(corpo.setor, 80)}" não está no cadastro de setores do SGPC.` };
  const sede = cat.sedes.find(s => chave(s.nome) === chave(corpo.sede) || (!!s.sigla && chave(s.sigla) === chave(corpo.sede)));
  if (!sede) return { erro: `Sede "${texto(corpo.sede, 80)}" não está no cadastro de sedes do SGPC (use o nome ou a sigla).` };

  const solicitante = texto(corpo.solicitante?.nome, 120);
  if (!solicitante) return { erro: 'solicitante.nome é obrigatório.' };
  const substituido = texto(corpo.substituido?.nome, 150);
  if (!substituido) return { erro: 'substituido.nome é obrigatório.' };
  const matricula = texto(corpo.substituido?.matricula, 30);
  const email = texto(corpo.solicitante?.email, 150);
  const motivoDeLa = texto(corpo.motivo, 150);
  const descricao = texto(corpo.descricao, 4000);

  // Data de Fortaleza (UTC-3, sem horário de verão): o servidor roda em UTC.
  const f = new Date(agora.getTime() - 3 * 3600 * 1000);
  const dd = String(f.getUTCDate()).padStart(2, '0'), mm = String(f.getUTCMonth() + 1).padStart(2, '0'), ano = f.getUTCFullYear();

  const observacoes = [
    `Aberta automaticamente pelo Chromos (caso ${caso})${motivoDeLa ? ` — ${motivoDeLa}` : ' — abandono de emprego'}.`,
    `Solicitado por ${solicitante}${email ? ` (${email})` : ''}.`,
    descricao ? `Atividades da pessoa substituída: ${descricao}` : '',
  ].filter(Boolean).join('\n');

  return {
    docId: `chromos_${caso}`,
    caso,
    campos: {
      vaga: cargo,
      sede: sede.nome,
      setor,
      status: 'ABERTA',
      sexo: 'INDIFERENTE',
      solicitante,
      solicitacao: `${dd}/${mm}/${ano}`,
      mesSolicitacao: MESES_ABREV[f.getUTCMonth()],
      ano,
      motivo: MOTIVO,
      categoriaMotivo: 'Substituição',
      categoria: 'Seleções Gerais',
      funcionarioSubstituido: matricula ? `${substituido} (matrícula ${matricula})` : substituido,
      responsavel: 'RH',
      etapa: 'Triagem de currículos',
      etapaDesde: `${ano}-${mm}-${dd}`,
      observacoes,
      origem: 'chromos',
      origemCaso: caso,
    },
  };
}

const paraFirestore = (campos: Record<string, string | number>) => ({
  fields: Object.fromEntries(Object.entries(campos).map(([k, v]) =>
    [k, typeof v === 'number' ? { integerValue: String(v) } : { stringValue: v }])),
});
const codigoDe = (doc: any) => Number(doc?.fields?.codigo?.integerValue ?? doc?.fields?.codigo?.doubleValue ?? 0);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST.' });
  const esperado = process.env.SGPC_VAGAS_TOKEN || '';
  if (!esperado) return res.status(503).json({ erro: 'Integração de vagas externas não configurada.' });
  const [tipo, token] = String(req.headers?.authorization || '').split(' ');
  if (tipo?.toLowerCase() !== 'bearer' || !segredoConfere(token || '', esperado)) {
    return res.status(401).json({ erro: 'Credencial recusada.' });
  }

  let corpo = req.body;
  if (typeof corpo === 'string') { try { corpo = JSON.parse(corpo); } catch { corpo = null; } }

  try {
    const acesso = await tokenDeAcesso();
    const H = { Authorization: `Bearer ${acesso}`, 'Content-Type': 'application/json' };
    const listar = async (col: string) => {
      const r = await fetch(`${BASE}/${col}?pageSize=300`, { headers: H });
      if (!r.ok) throw new Error(`${col}: ${r.status}`);
      return ((await r.json()).documents || []) as any[];
    };
    const [cargos, setores, sedes] = await Promise.all([listar('cargos'), listar('setores'), listar('sedes')]);
    const pedido = validarPedido(corpo, {
      cargos: cargos.map(d => campoTexto(d, 'nome')).filter(Boolean),
      setores: setores.map(d => campoTexto(d, 'nome')).filter(Boolean),
      sedes: sedes.map(d => ({ nome: campoTexto(d, 'nome'), sigla: campoTexto(d, 'sigla') })).filter(s => s.nome),
    }, new Date());
    if ('erro' in pedido) return res.status(400).json({ erro: pedido.erro });

    const url = `${BASE}/vagas/${pedido.docId}`;
    const jaExiste = async () => {
      const r = await fetch(url, { headers: H });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`leitura da vaga: ${r.status}`);
      return r.json();
    };

    const existente = await jaExiste();
    if (existente) return res.status(200).json({ id: pedido.docId, codigo: String(codigoDe(existente)) });

    // O código segue a regra da tela (maior + 1): o maior vem de uma consulta
    // ordenada, não das 1.160 vagas baixadas.
    const rq = await fetch(`${BASE}:runQuery`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'vagas' }], orderBy: [{ field: { fieldPath: 'codigo' }, direction: 'DESCENDING' }], limit: 1 } }),
    });
    if (!rq.ok) throw new Error(`maior código: ${rq.status}`);
    const topo = ((await rq.json()) as any[]).find(l => l.document)?.document;
    const codigo = (topo ? codigoDe(topo) : 1000) + 1;

    const criar = await fetch(`${url}?currentDocument.exists=false`, {
      method: 'PATCH', headers: H, body: JSON.stringify(paraFirestore({ ...pedido.campos, codigo })),
    });
    if (!criar.ok) {
      // Outro envio do mesmo caso chegou primeiro: devolve a vaga dele.
      const outra = await jaExiste();
      if (outra) return res.status(200).json({ id: pedido.docId, codigo: String(codigoDe(outra)) });
      throw new Error(`criação: ${criar.status} ${(await criar.text()).slice(0, 120)}`);
    }

    const log = {
      timestamp: new Date().toISOString(), usuario: 'sistema', acao: 'CRIOU', modulo: 'Vagas', regiao: '',
      detalhes: `Vaga #${codigo} (${pedido.campos.vaga}, ${pedido.campos.sede}) aberta pelo Chromos: substituição por abandono de emprego (caso ${pedido.caso}).`,
    };
    await fetch(`${BASE}/logs`, { method: 'POST', headers: H, body: JSON.stringify(paraFirestore(log)) })
      .catch(e => console.error('[vagas-externas] log não gravado', e?.message));

    return res.status(201).json({ id: pedido.docId, codigo: String(codigo) });
  } catch (e: any) {
    console.error('[vagas-externas]', e?.message || e);
    return res.status(502).json({ erro: 'O SGPC não conseguiu gravar a vaga agora. Tente de novo.' });
  }
}
