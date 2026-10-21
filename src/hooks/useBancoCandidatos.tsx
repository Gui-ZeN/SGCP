/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Banco de candidatos (16/10/2026) — o histórico de cada pessoa e o "Nunca
 * mais chamar", para TODA tela que mostra ou recebe nomes.
 *
 * Desde 19/10/2026 o histórico NÃO vem da coleção inteira (12 mil leituras a
 * cada reconexão): cada nome que aparece na tela é pedido ao banco, em lote, e
 * guardado na sessão. Ver hooks/useCandidatos.ts.
 *
 * Vai por contexto, e não por prop: o aviso aparece na lista de nomes (quatro
 * telas de entrada) e nas três listas do dia; passar prop por cada camada era
 * mexer em meia dúzia de componentes para ler a mesma coisa. Fora do provedor
 * (modo de teste de um componente isolado), não há aviso — e nada quebra.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Candidato, Selecao } from '../types';
import { useFirestoreCollection } from './useFirestoreCollection';
import type { BuscaCandidatos } from './useCandidatos';
import { isFirebaseEnabled, serverTimestamp } from '../lib/firebase';
import { normalizarNome } from '../utils/catalogo';
import { prefixoCoberto } from '../utils/janelaCandidatos';
import {
  agruparPessoas, indicePorPessoa, marcaDe, avisoDe, separarTelefone, normalizarTelefone, sugestoesDeNome,
  type Pessoa, type MarcaNaoChamar, type Aviso,
} from '../utils/bancoCandidatos';
import type { Escopo } from '../utils/unidade';

export interface BancoCandidatos {
  pessoas: Pessoa[];
  marcas: MarcaNaoChamar[];
  /** A pessoa de um nome (ou de uma linha "Nome – telefone"). */
  pessoaDe: (linha: string, telefone?: string) => Pessoa | undefined;
  /** O selo para um nome; `excluir` = a convocação que está na tela. */
  avisoPara: (linha: string, telefone?: string, excluir?: string) => Aviso | null;
  /** A marca ativa de "Não chamar" para o nome/telefone. */
  marcaPara: (nome: string, telefone?: string) => ReturnType<typeof marcaDe>;
  /** Ausente para quem não grava (Visualizador). */
  marcar?: (p: { nome: string; telefone?: string; motivo: string; escopo: Escopo }) => Promise<void>;
  /** Só Coordenador e Administrador recebem. */
  desfazer?: (id: string, motivo: string) => Promise<void>;
  /** Unidade de quem está logado (null = Administrador, que grava nas duas). */
  unidadeDoLeitor: Escopo | null;
  /** A ficha aberta (uma por vez, para o app inteiro) — ver FichaDaPessoa. */
  ficha: { nome: string; telefone: string; pessoa?: Pessoa; marcar?: boolean } | null;
  /** `marcar`: já abre no formulário de "Nunca mais chamar" (botão da linha). */
  abrirFicha: (linha: string, telefone?: string, opcoes?: { marcar?: boolean }) => void;
  fecharFicha: () => void;
  /** Sugestões para o nome que está sendo digitado (busca no banco por trás). */
  sugestoes: (texto: string) => Pessoa[];
  /** Busca do Banco de candidatos: nomes que começam com o texto. false = veio cortada no máximo. */
  procurar: (texto: string) => Promise<boolean>;
  /** A busca deste texto falhou e ainda não foi refeita (volta sozinha em 30 s). */
  buscaFalhou: (texto: string) => boolean;
  /** Muda quando um pedido que falhou é liberado para tentar de novo (a cada 30 s). */
  tentativa: number;
  /** Traz quem está "No banco" ('banco') ou foi contratado ('sim'). */
  carregarSituacao: (valor: 'banco' | 'sim') => Promise<void>;
  /** Há leitura em andamento (a tela pode dizer "procurando…"). */
  procurando: boolean;
  /** A leitura do histórico DESTE nome/telefone falhou — não dizer "nunca convocada". */
  falhouPara: (linha: string, telefone?: string) => boolean;
}

const Contexto = createContext<BancoCandidatos | null>(null);
export const useBanco = () => useContext(Contexto);

export function useNaoChamar(currentUser: any, escopo: Escopo | null, enabled: boolean) {
  const { items, create, update } = useFirestoreCollection<MarcaNaoChamar>({
    collectionName: 'naoChamar',
    localKey: 'sgcp_nao_chamar_fallback',
    newLocalId: () => `local_nc_${Date.now()}`,
    enabled: enabled && !!currentUser,
    escopo,
    semCopiaLocal: true,
  });
  const email = String(currentUser?.email || '').trim().toLowerCase();
  // Autor e hora conferidos pela regra: o e-mail do token e a hora do servidor.
  const agora = () => (isFirebaseEnabled ? serverTimestamp() : new Date().toISOString());
  const marcar = async ({ nome, telefone, motivo, escopo: e }: { nome: string; telefone?: string; motivo: string; escopo: Escopo }) => {
    const tel = normalizarTelefone(telefone);
    await create({ escopo: e, nome: nome.trim(), nomeNorm: normalizarNome(nome), ...(tel ? { telefone: tel } : {}), motivo: motivo.trim(), por: email, em: agora() } as any);
  };
  const desfazer = (id: string, motivo: string) => update(id, { desfeito: { por: email, em: agora(), motivo: motivo.trim() } } as any);
  return { marcas: items, marcar, desfazer };
}

/** Quantas convocações a busca por começo de nome traz de cada vez. */
const MAX_SUGESTOES = 50;
const MAX_BUSCA = 300;
const novosPedidos = () => ({ nomes: new Set<string>(), tels: new Set<string>(), prefixos: new Set<string>(), completos: new Set<string>(), cortados: new Set<string>(), falhos: new Set<string>(), situacoes: new Set<string>() });
/** Leitura que falhou só é tentada de novo depois disto (sem laço de render ↔ pedido). */
const ESPERA_APOS_FALHA = 30_000;

export function ProvedorBanco({ candidatos, selecoes, marcas, busca, corte, marcar, desfazer, unidadeDoLeitor, dono = '', children }: {
  /** Os candidatos já na tela (janela ao vivo + o que veio por pedido). */
  candidatos: Candidato[];
  selecoes: Selecao[];
  marcas: MarcaNaoChamar[];
  /** Busca no banco por nome/telefone/situação (ausente: sem acesso aos candidatos). */
  busca?: BuscaCandidatos;
  /** Início da janela ao vivo (AAAA-MM-DD): dali em diante só vale a escuta. */
  corte: string;
  marcar?: BancoCandidatos['marcar'];
  desfazer?: BancoCandidatos['desfazer'];
  unidadeDoLeitor: Escopo | null;
  /** Quem está logado (uid): outra conta na mesma aba começa do zero. */
  dono?: string;
  children: ReactNode;
}) {
  const [aberta, setAberta] = useState<{ nome: string; telefone: string; marcar?: boolean } | null>(null);
  // Leitura por nome (19/10/2026): o histórico de quem aparece na tela vem do
  // banco, nome a nome, e fica guardado na sessão. Os pedidos de um mesmo
  // render vão juntos (a lista do dia tem 20 nomes: uma consulta, não 20).
  const [conhecidos, setConhecidos] = useState<Map<string, Candidato>>(() => new Map());
  const conhecidosRef = useRef(conhecidos);
  const buscaRef = useRef(busca);
  buscaRef.current = busca;
  const pedidos = useRef(novosPedidos());
  const fila = useRef({ nomes: new Set<string>(), tels: new Set<string>(), agendado: false });
  const [pendentes, setPendentes] = useState(0);
  // O que NÃO deu para ler, por nome ('n:'), telefone ('t:'), começo de nome
  // ('p:') e situação ('s:'). Por chave, e não um "falhou" da tela toda: uma
  // leitura boa de outro nome não pode apagar o aviso de quem falhou — ela
  // voltaria a aparecer como "nunca convocada" (auditoria de 19/10/2026).
  const [falhas, setFalhas] = useState<Set<string>>(() => new Set());
  const marcarFalha = (chaves: string[], falhou: boolean) => {
    if (!chaves.length) return;
    setFalhas(atual => {
      if (chaves.every(k => atual.has(k) === falhou)) return atual;
      const s = new Set(atual);
      chaves.forEach(k => (falhou ? s.add(k) : s.delete(k)));
      return s;
    });
  };
  // Muda quando um pedido que falhou é liberado: redesenha, e o selo pede de novo.
  // ⚠️ Entra nas dependências do valor do contexto: sem isso o provedor
  // redesenhava sozinho, o contexto continuava o mesmo objeto e nenhum selo
  // pedia de novo (auditoria de 19/10/2026, provado com o React de verdade).
  const [tentativa, setTentarDeNovo] = useState(0);
  // Outra unidade, ou perdeu o acesso: o que foi lido era da leitura anterior.
  const temBusca = !!busca;
  // A geração descarta a leitura que ainda estava a caminho na troca.
  const geracao = useRef(0);
  // Só na TROCA, não ao montar: ao montar, os selos já pediram nomes no
  // primeiro desenho, e esquecer esses pedidos os faria ir ao banco 2 vezes.
  const chave = `${dono}|${temBusca}|${unidadeDoLeitor}`;
  const chaveAnterior = useRef(chave);
  useEffect(() => {
    if (chaveAnterior.current === chave) return;
    chaveAnterior.current = chave;
    geracao.current++;
    conhecidosRef.current = new Map(); setConhecidos(conhecidosRef.current);
    pedidos.current = novosPedidos();
    setFalhas(new Set());
  }, [chave]);

  const juntar = (lista: Candidato[]) => {
    if (!lista.length) return;
    const m = new Map(conhecidosRef.current);
    for (const c of lista) m.set(c.id, c);
    conhecidosRef.current = m;
    setConhecidos(m);
  };
  /**
   * Uma leitura, contando as em andamento (a tela diz "procurando…") e
   * anotando a falha ou o acerto nas `chaves` que ela cobre.
   */
  const lendo = async (chaves: string[], ler: () => Promise<Candidato[]>) => {
    setPendentes(n => n + 1);
    const g = geracao.current;
    try {
      const lista = await ler();
      if (g !== geracao.current) return [];
      juntar(lista); marcarFalha(chaves, false);
      return lista;
    } catch (e) {
      if (g !== geracao.current) return [];
      marcarFalha(chaves, true);
      throw e;
    } finally { setPendentes(n => n - 1); }
  };
  /**
   * ⚠️ O pedido que falhou NÃO volta na hora (auditoria de 19/10/2026): o
   * render seguinte pediria de novo, falharia de novo — uma consulta por ida e
   * volta de rede, sem fim, enquanto o banco recusasse. Volta em 30 s.
   */
  const liberarDepois = (conjunto: Set<string>, chaves: string[]) => {
    const g = geracao.current;
    setTimeout(() => {
      if (g !== geracao.current) return;
      chaves.forEach(k => conjunto.delete(k));
      setTentarDeNovo(n => n + 1);
    }, ESPERA_APOS_FALHA);
  };
  const esvaziarFila = async () => {
    fila.current.agendado = false;
    const nomes = [...fila.current.nomes], tels = [...fila.current.tels];
    fila.current.nomes.clear(); fila.current.tels.clear();
    const b = buscaRef.current;
    if (!b || (!nomes.length && !tels.length)) return;
    // A pessoa é o TELEFONE: o mesmo número com o nome escrito de outro
    // jeito é a mesma pessoa — o nome puxa os telefones dele. E o nome com
    // que veio por telefone também: "Maria Silva – 85…" e "Maria da Silva"
    // sem telefone podem ser a mesma pessoa no agrupamento.
    // ⚠️ Só um passo de cada lado (nome → telefone → nome): um telefone usado
    // por muita gente (o do próprio RH) não vira uma cadeia pelo banco inteiro.
    if (nomes.length) {
      try {
        for (const c of await lendo(nomes.map(n => 'n:' + n), () => b.porNomes(nomes))) pedir('', normalizarTelefone(c.telefone));
      } catch (e) { liberarDepois(pedidos.current.nomes, nomes); console.warn('Banco de candidatos:', e); }
    }
    let soNomes: string[] = [];
    if (tels.length) {
      try {
        const vieram = await lendo(tels.map(t => 't:' + t), () => b.porTelefones(tels));
        soNomes = [...new Set(vieram.map(c => normalizarNome(c.nome)))].filter(n => n && !pedidos.current.nomes.has(n));
      } catch (e) { liberarDepois(pedidos.current.tels, tels); console.warn('Banco de candidatos:', e); }
    }
    // O fim da cadeia: os nomes que vieram pelo telefone, sem seguir os telefones deles.
    if (soNomes.length) {
      soNomes.forEach(n => pedidos.current.nomes.add(n));
      try { await lendo(soNomes.map(n => 'n:' + n), () => b.porNomes(soNomes)); }
      catch (e) { liberarDepois(pedidos.current.nomes, soNomes); console.warn('Banco de candidatos:', e); }
    }
  };
  /** Pede ao banco o histórico de um nome/telefone (uma vez por sessão). */
  const pedir = (nome: string, telefone?: string) => {
    if (!buscaRef.current) return;
    const n = normalizarNome(nome), t = normalizarTelefone(telefone);
    if (n && !pedidos.current.nomes.has(n)) { pedidos.current.nomes.add(n); fila.current.nomes.add(n); }
    if (t && !pedidos.current.tels.has(t)) { pedidos.current.tels.add(t); fila.current.tels.add(t); }
    if ((fila.current.nomes.size || fila.current.tels.size) && !fila.current.agendado) {
      fila.current.agendado = true;
      setTimeout(esvaziarFila, 0);
    }
  };

  /**
   * Nomes que começam com `q`; completo (cobre os prefixos mais longos) se
   * veio menos que o máximo. Devolve false quando a busca bateu no máximo
   * (a tela pede para refinar). Falha: relança — a tela diz que não buscou.
   */
  const porPrefixo = async (q: string, max: number): Promise<boolean> => {
    const b = buscaRef.current;
    if (!b || q.length < 3 || prefixoCoberto(q, pedidos.current.completos)) return true;
    // Pelo texto E pelo máximo: as sugestões (50) e a busca do Banco (300)
    // não se confundem — "mar" cortado em 50 não vale pela busca de 300.
    const k = `${max}:${q}`;
    if (pedidos.current.prefixos.has(k)) {
      // ⚠️ Já pedido e FALHOU: dizer "completa" aqui fazia a tela mostrar
      // "Ninguém" para quem está no banco (auditoria de 19/10/2026).
      if (pedidos.current.falhos.has(k)) throw new Error('A busca falhou há pouco; tenta de novo sozinha em instantes.');
      return !pedidos.current.cortados.has(k);
    }
    pedidos.current.prefixos.add(k);
    try {
      const lista = await lendo(['p:' + q], () => b.porPrefixo(q, max));
      pedidos.current.falhos.delete(k);
      if (lista.length < max) pedidos.current.completos.add(q);
      else pedidos.current.cortados.add(k);
      return lista.length < max;
    } catch (e) {
      pedidos.current.falhos.add(k);
      liberarDepois(pedidos.current.prefixos, [k]);
      liberarDepois(pedidos.current.falhos, [k]);
      throw e;
    }
  };
  // Sugestões enquanto digita: só vai ao banco quando a pessoa para (250 ms).
  const timerSugestao = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sugerirDepois = (q: string) => {
    clearTimeout(timerSugestao.current);
    timerSugestao.current = setTimeout(() => { porPrefixo(q, MAX_SUGESTOES).catch(e => console.warn('Banco de candidatos:', e)); }, 250);
  };
  useEffect(() => () => clearTimeout(timerSugestao.current), []);

  // Agrupar é a parte cara: só refaz quando os dados mudam. Da janela ao vivo
  // em diante vale SÓ a escuta (o que foi apagado ou mudou ali não fica preso
  // numa cópia lida antes); antes dela, vale a cópia lida por nome.
  const { pessoas, achar } = useMemo(() => {
    const ids = new Set(candidatos.map(c => c.id));
    const lidos = [...conhecidos.values()].filter(c => !ids.has(c.id) && !(c.dataISO && c.dataISO >= corte));
    const pessoas = agruparPessoas(lidos.length ? [...candidatos, ...lidos] : candidatos, selecoes);
    return { pessoas, achar: indicePorPessoa(pessoas) };
  }, [candidatos, conhecidos, selecoes, corte]);

  // A ficha aberta pede o histórico completo da pessoa.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (aberta) pedir(aberta.nome, aberta.telefone); }, [aberta]);

  const valor = useMemo<BancoCandidatos>(() => {
    const pessoaDe = (linha: string, telefone?: string) => {
      const s = separarTelefone(linha);
      pedir(s.nome, telefone || s.telefone);
      return achar(s.nome, telefone || s.telefone);
    };
    const marcaPara = (nome: string, telefone?: string) => {
      const s = separarTelefone(nome);
      return marcaDe(marcas, s.nome, telefone || s.telefone);
    };
    return {
      pessoas, marcas, pessoaDe, marcaPara, marcar, desfazer, unidadeDoLeitor,
      procurando: pendentes > 0,
      falhouPara: (linha, telefone) => {
        const x = separarTelefone(linha);
        const n = normalizarNome(x.nome), t = normalizarTelefone(telefone || x.telefone);
        // O telefone da PESSOA também: o nome leu, mas o número dela não — o
        // "Chamado Nx" sairia sem as vezes em que o nome foi escrito diferente.
        const tp = t || achar(x.nome)?.telefone || '';
        return (!!n && falhas.has('n:' + n)) || (!!tp && falhas.has('t:' + tp));
      },
      ficha: aberta ? { ...aberta, pessoa: achar(aberta.nome, aberta.telefone) } : null,
      abrirFicha: (linha, telefone, opcoes) => { const x = separarTelefone(linha); setAberta({ nome: x.nome, telefone: normalizarTelefone(telefone || x.telefone), marcar: !!opcoes?.marcar }); },
      fecharFicha: () => setAberta(null),
      avisoPara: (linha, telefone, excluir) => {
        const s = separarTelefone(linha);
        if (!s.nome) return null;
        pedir(s.nome, telefone || s.telefone);
        return avisoDe(achar(s.nome, telefone || s.telefone), marcaDe(marcas, s.nome, telefone || s.telefone), excluir);
      },
      sugestoes: texto => {
        const q = normalizarNome(separarTelefone(texto).nome);
        if (q.length >= 3) sugerirDepois(q);
        const lista = sugestoesDeNome(pessoas, texto);
        // O "Chamado Nx" de cada sugestão precisa do histórico inteiro dela.
        for (const p of lista) pedir(p.nome, p.telefone);
        return lista;
      },
      procurar: texto => porPrefixo(normalizarNome(texto), MAX_BUSCA),
      tentativa,
      buscaFalhou: texto => pedidos.current.falhos.has(`${MAX_BUSCA}:${normalizarNome(texto)}`),
      carregarSituacao: async situacao => {
        const b = buscaRef.current;
        if (!b || pedidos.current.situacoes.has(situacao)) return;
        pedidos.current.situacoes.add(situacao);
        try { await lendo(['s:' + situacao], () => b.porContratado(situacao)); }
        catch (e) { pedidos.current.situacoes.delete(situacao); throw e; }
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoas, achar, marcas, marcar, desfazer, unidadeDoLeitor, aberta, pendentes, falhas, tentativa]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

