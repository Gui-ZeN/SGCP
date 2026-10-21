/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Candidatos dos dias de seleção. Só liga para quem a regra deixa ler (RH sem
 * Visualizador): para os demais o listener seria negado e ficaria só erro.
 *
 * Leitura por partes (19/10/2026) — ver utils/janelaCandidatos.ts. Ao vivo,
 * os últimos 60 dias; o resto vem por pedido da tela e fica na sessão:
 *  - `garantirSelecoes`: os candidatos de seleções antigas (a aberta, as das
 *    vagas em andamento) — e TODA gravação que recalcula uma seleção parte
 *    da lista completa dela (`daSelecao`), nunca de uma lista pela metade;
 *  - `garantirAno`: a aba Candidatos com o ano escolhido;
 *  - `busca`: o Banco de candidatos, por nome, telefone e situação.
 * O que vem por pedido é leitura de uma vez (getDocs), não escuta: a escuta
 * de uma faixa grande relia tudo a cada reconexão, que é o que se quer evitar.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Candidato } from '../types';
import { useFirestoreCollection, colecaoDoLeitor } from './useFirestoreCollection';
import { db, isFirebaseEnabled, getDocs, where, orderBy, limit } from '../lib/firebase';
import { corteDaJanela, camposDeBusca, selecoesQueFaltam, faixaDoAno, emLotes, mesclar, porNome } from '../utils/janelaCandidatos';
import { normalizarNome } from '../utils/catalogo';
import { normalizarTelefone } from '../utils/bancoCandidatos';


export interface BuscaCandidatos {
  porNomes: (nomesNorm: string[]) => Promise<Candidato[]>;
  porTelefones: (telefones: string[]) => Promise<Candidato[]>;
  /** Nomes que COMEÇAM com `q` (normalizado), até `max`. */
  porPrefixo: (q: string, max: number) => Promise<Candidato[]>;
  porContratado: (valor: 'banco' | 'sim') => Promise<Candidato[]>;
}

/** `escopo`: unidade de quem lê (null = Administrador). Ver useFirestoreCollection. */
export function useCandidatos(currentUser: any, enabled = true, escopo: string | null = null) {
  // Fixo na sessão (como o corte dos logs): a janela não "anda" sozinha.
  const corte = useMemo(() => corteDaJanela(), []);
  const ligado = enabled && !!currentUser;
  // `upsert` com id gerado aqui, e não `create`: o id entra no log na hora de
  // registrar, e o relato conta por candidato (registrar e já lançar o
  // resultado da mesma pessoa é um candidato, não dois).
  const { items: janela, loading, usingFirebase, upsert, remove } = useFirestoreCollection<Candidato>({
    collectionName: 'candidatos',
    localKey: 'sgcp_candidatos_fallback',
    newLocalId: () => `local_cand_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    // Ordem de chegada estável: por nome, senão a lista dança a cada gravação.
    sort: porNome,
    enabled: ligado,
    escopo,
    semCopiaLocal: true,
    janela: { campo: 'dataISO', desde: corte },
  });

  const [extras, setExtras] = useState<Map<string, Candidato>>(() => new Map());
  const extrasRef = useRef(extras);
  const janelaRef = useRef(janela);
  janelaRef.current = janela;
  // Escuta de pé = ela manda nos 60 dias (ver mesclar); caída, vale a cópia lida.
  const corteValido = useRef<string | undefined>(undefined);
  corteValido.current = usingFirebase && !loading ? corte : undefined;
  // A leitura de cada seleção, EM CURSO ou feita: quem pede a mesma seleção
  // no meio espera a mesma leitura (salvar logo depois de abrir não pode
  // recalcular com a lista pela metade).
  const selecoesPedidas = useRef(new Map<string, Promise<void>>());
  const anosPedidos = useRef(new Set<string>());
  // Pedidos feitos com a leitura ainda desligada (a tela antiga aberta pelo
  // Início: o filho pede no 1º desenho, a leitura liga no 2º). Ficam aqui e
  // são feitos quando ela liga — senão a lista abria vazia e quem relançasse
  // os nomes dobrava os números do dia (auditoria de 19/10/2026).
  // Por conta: a fila de uma pessoa não é feita com a unidade da próxima.
  const uid = String(currentUser?.uid || '');
  const aguardando = useRef({ uid, selecoes: new Map<string, { id: string; data?: string }>(), anos: new Set<number | 'tudo'>() });
  const esperar = (selecoes: { id: string; data?: string }[], anos: (number | 'tudo')[]) => {
    if (aguardando.current.uid !== uid) aguardando.current = { uid, selecoes: new Map(), anos: new Set() };
    selecoes.forEach(s => aguardando.current.selecoes.set(s.id, s));
    anos.forEach(a => aguardando.current.anos.add(a));
  };
  // De quem e de que unidade é o que veio por pedido. Mudou (trocou a unidade
  // ou a conta), zera — e a geração descarta a leitura que ainda vinha. Quem
  // confere é QUEM PEDE, antes de pedir: a tela pede no mesmo desenho em que a
  // unidade troca (o efeito do filho roda antes do deste hook), e zerar depois,
  // no efeito, jogava fora o pedido recém-feito (auditoria de 19/10/2026).
  // ⚠️ Ligar a leitura NÃO zera: ligar acontece no mesmo desenho em que a tela
  // já pediu a seleção dela.
  const geracao = useRef(0);
  const donoDosDados = useRef(`${uid}|${escopo}`);
  const zerar = () => {
    geracao.current++;
    extrasRef.current = new Map(); setExtras(extrasRef.current);
    selecoesPedidas.current = new Map(); anosPedidos.current = new Set();
  };
  // O AGORA (atualizado a cada desenho): uma chamada antiga ainda em
  // andamento (`for … await garantirAno`) não pode trazer de volta a unidade
  // de antes nem ler com ela (segurança/auditoria de 19/10/2026).
  const agora = useRef({ uid, escopo, ligado });
  agora.current = { uid, escopo, ligado };
  const conferirDono = () => {
    const atual = `${agora.current.uid}|${agora.current.escopo}`;
    if (donoDosDados.current !== atual) { donoDosDados.current = atual; zerar(); }
  };
  const anterior = useRef(ligado);
  useEffect(() => {
    const estava = anterior.current;
    anterior.current = ligado;
    if (estava && !ligado) zerar();       // saiu
    conferirDono();                       // trocou de unidade/conta
    if (ligado && aguardando.current.uid === uid) {
      const { selecoes, anos } = aguardando.current;
      aguardando.current = { uid, selecoes: new Map(), anos: new Set() };
      if (selecoes.size) garantirSelecoes([...selecoes.values()]).catch(e => console.warn('Candidatos das seleções:', e));
      for (const ano of anos) garantirAno(ano).catch(e => console.warn('Candidatos do ano:', e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ligado, escopo, uid]);

  const remoto = isFirebaseEnabled && !!db && ligado;
  /** Lê do banco; volta vazio se, no caminho, a unidade/usuário mudou. */
  const ler = async (...filtros: any[]): Promise<Candidato[]> => {
    const g = geracao.current;
    // ⚠️ Recusa, não "vazio": devolver [] marcava a seleção como lida e sem
    // ninguém, e o recálculo seguinte zerava o dia (auditoria de 19/10/2026).
    if (!agora.current.ligado) throw new Error('A leitura dos candidatos foi desligada. Tente de novo em instantes.');
    const snap = await getDocs(colecaoDoLeitor('candidatos', agora.current.escopo, ...filtros));
    if (g !== geracao.current) return [];
    const lista: Candidato[] = [];
    snap.forEach((d: any) => { lista.push({ ...d.data(), id: d.id } as Candidato); });
    return lista;
  };
  const juntar = (lista: Candidato[]) => {
    if (!lista.length) return;
    const m = new Map(extrasRef.current);
    for (const c of lista) m.set(c.id, c);
    extrasRef.current = m;
    setExtras(m);
  };

  /**
   * Os candidatos das seleções de antes da janela. `todas`: também as de
   * dentro dela — para gravar, a lista vem do banco pelo id da seleção, e não
   * só da escuta (que não traz quem ficou sem `dataISO`, e fica vazia se a
   * escuta falhar: revisão de segurança de 19/10/2026).
   */
  const garantirSelecoes = async (selecoes: { id: string; data?: string }[], { todas = false } = {}) => {
    if (!remoto) { if (isFirebaseEnabled) esperar(selecoes, []); return; }
    conferirDono();
    const pedidas = selecoesPedidas.current;
    const novas = todas
      ? [...new Set(selecoes.map(s => s.id))].filter(id => id && !pedidas.has(id))
      : selecoesQueFaltam(selecoes, new Set(pedidas.keys()), corte);
    for (const lote of emLotes(novas)) {
      const leitura = ler(where('selecaoId', 'in', lote)).then(juntar);
      // Falhou: sai do mapa, para a próxima vez tentar de novo.
      leitura.catch(() => { for (const id of lote) if (pedidas.get(id) === leitura) pedidas.delete(id); });
      for (const id of lote) pedidas.set(id, leitura);
    }
    await Promise.all(selecoes.map(s => pedidas.get(s.id)).filter(Boolean));
  };

  /** Os candidatos de antes da janela de um ano (ou de todos: 'tudo'). */
  const garantirAno = async (ano: number | 'tudo') => {
    if (!remoto) { if (isFirebaseEnabled) esperar([], [ano]); return; }
    conferirDono();
    if (anosPedidos.current.has('tudo') || anosPedidos.current.has(String(ano))) return;
    const faixa = ano === 'tudo' ? { de: '', ate: corte } : faixaDoAno(ano, corte);
    anosPedidos.current.add(String(ano));
    if (!faixa) return;
    try {
      // `de` vazio = do começo, inclusive quem ficou sem data legível ('').
      juntar(await ler(...(faixa.de ? [where('dataISO', '>=', faixa.de)] : []), where('dataISO', '<', faixa.ate)));
    } catch (e) {
      anosPedidos.current.delete(String(ano));
      throw e;
    }
  };

  const candidatos = useMemo(() => mesclar(janela, extras, corteValido.current), [janela, extras, corteValido.current]);
  /** Os candidatos da seleção, COMPLETOS — base de todo recálculo dos números do dia. */
  const daSelecao = async (selecao: { id: string; data?: string }) => {
    // Sem leitura ligada a lista viria vazia — e o recálculo zeraria o dia.
    if (isFirebaseEnabled && !ligado) throw new Error('Os candidatos ainda não foram carregados. Tente de novo em instantes.');
    await garantirSelecoes([selecao], { todas: true });
    return mesclar(janelaRef.current, extrasRef.current, corteValido.current).filter(c => c.selecaoId === selecao.id);
  };

  // Toda gravação leva os campos de busca do que grava (nome → nomeNorm,
  // data → dataISO). O que veio por pedido não tem escuta: a cópia na tela
  // é atualizada aqui, senão a lista mostraria o valor de antes.
  const gravarCandidato = async (id: string, campos: Partial<Candidato>) => {
    const comBusca = { ...campos, ...camposDeBusca(campos) };
    await upsert(id, comBusca);
    // Também o NOVO de data antiga (seleção de 3 meses atrás lançada hoje):
    // a escuta não o traz, e ele sumiria da tela até recarregar.
    const antes = extrasRef.current.get(id);
    const foraDaJanela = !!comBusca.dataISO && comBusca.dataISO < corte && !janelaRef.current.some(c => c.id === id);
    if (antes || foraDaJanela) juntar([{ ...(antes || {}), ...comBusca, id } as Candidato]);
  };
  const removerCandidato = async (id: string) => {
    await remove(id);
    if (extrasRef.current.has(id)) {
      const m = new Map(extrasRef.current);
      m.delete(id);
      extrasRef.current = m;
      setExtras(m);
    }
  };

  // Busca do Banco. No modo demo a lista local É o banco inteiro.
  const local = () => mesclar(janelaRef.current, extrasRef.current);
  const busca: BuscaCandidatos = {
    porNomes: async nomes => {
      if (!remoto) { const s = new Set(nomes); return local().filter(c => s.has(normalizarNome(c.nome))); }
      const saida: Candidato[] = [];
      for (const lote of emLotes(nomes)) saida.push(...await ler(where('nomeNorm', 'in', lote)));
      return saida;
    },
    porTelefones: async tels => {
      if (!remoto) { const s = new Set(tels); return local().filter(c => s.has(normalizarTelefone(c.telefone))); }
      const saida: Candidato[] = [];
      for (const lote of emLotes(tels)) saida.push(...await ler(where('telefone', 'in', lote)));
      return saida;
    },
    porPrefixo: async (q, max) => {
      if (!remoto) return local().filter(c => normalizarNome(c.nome).startsWith(q)).slice(0, max);
      return ler(where('nomeNorm', '>=', q), where('nomeNorm', '<', q + ''), orderBy('nomeNorm'), limit(max));
    },
    porContratado: async valor => {
      if (!remoto) return local().filter(c => c.contratado === valor);
      return ler(where('contratado', '==', valor));
    },
  };

  /** O registro como está agora (sem esperar a tela redesenhar). */
  const candidatoAtual = (id: string) => janelaRef.current.find(c => c.id === id) ?? extrasRef.current.get(id);

  return { candidatos, gravarCandidato, removerCandidato, garantirSelecoes, garantirAno, daSelecao, candidatoAtual, busca, corte };
}
