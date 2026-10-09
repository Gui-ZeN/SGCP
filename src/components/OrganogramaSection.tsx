import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Funcionario } from '../types';
import type { Sede, Cargo, Setor } from '../hooks/useMetadata';
import type { NoOrganogramaDoc } from '../hooks/useOrganograma';
import { montarArvore, profundidade, descendentes, iniciais, admissaoDoQuadro, type ArvoreNo } from '../utils/organograma';
import {
  Network, Plus, Pencil, Trash2, Printer, ChevronDown, ChevronRight, UserPlus, AlertTriangle,
} from 'lucide-react';
import { Modal } from './ui/Modal';
import { FiltroMultiplo } from './ui/FiltroMultiplo';

/**
 * Organograma — montado à mão, de cima para baixo.
 *
 * O RH cria a caixa do topo e vai pendurando subordinados em quem quiser. A
 * hierarquia é DECLARADA, nunca deduzida: a versão anterior inferia do nível do
 * cargo e produzia um desenho que parecia pronto e estava errado.
 *
 * O quadro de funcionários entra em um lugar só: ao escolher o cargo, a tela
 * sugere os nomes de quem ocupa aquele cargo. O campo segue livre para digitar
 * — posição vaga, cargo sem dono e gente de fora do quadro precisam caber.
 */
interface OrganogramaSectionProps {
  nos: NoOrganogramaDoc[];
  /** Só para sugerir nomes a partir do cargo. */
  funcionarios: Funcionario[];
  cargos: Cargo[];
  sedes: Sede[];
  setores: Setor[];
  adicionarNo?: (dados: Omit<NoOrganogramaDoc, 'id'>) => Promise<void>;
  atualizarNo?: (id: string, campos: Partial<NoOrganogramaDoc>) => Promise<void>;
  removerNo?: (id: string) => Promise<void>;
  confirmAction?: (titulo: string, mensagem: string, onConfirm: () => void | Promise<void>) => void;
}

const chave = (t?: string) =>
  String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const OrganogramaSection: React.FC<OrganogramaSectionProps> = ({
  nos, funcionarios, cargos, sedes, setores,
  adicionarNo, atualizarNo, removerNo, confirmAction,
}) => {
  const [editando, setEditando] = useState<NoOrganogramaDoc | null>(null);
  const [novoSob, setNovoSob] = useState<NoOrganogramaDoc | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const [form, setForm] = useState({ nome: '', cargo: '', sede: '', setor: '', turno: '', respondeA: '' });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const [mostrarTodos, setMostrarTodos] = useState<Set<string>>(new Set());
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [arrastandoSobre, setArrastandoSobre] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');

  const podeEditar = !!adicionarNo;
  const LIMITE_VISIVEL = 8;


  /**
   * Um organograma POR SETOR. "Tudo junto" desenhava Infra e Pedagógico na
   * mesma árvore, e eles não se encontram em lugar nenhum do dia a dia.
   *
   * A lista de setores vem do catálogo MAIS o que já existe nos nós — setor
   * digitado à mão não pode sumir do seletor e levar as caixas junto.
   */
  const setoresDoDesenho = useMemo(() => {
    const doCatalogo = setores.map(s => s.nome).filter(Boolean);
    const dosNos = nos.map(n => (n.setor || '').trim()).filter(Boolean);
    return [...new Set([...doCatalogo, ...dosNos])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [setores, nos]);

  const semSetor = useMemo(() => nos.filter(n => !(n.setor || '').trim()).length, [nos]);
  // Múltipla escolha (regra de 08/10/2026); nada marcado = todos os setores.
  // '__sem__' é a caixa sem setor lançado.
  const [setoresSel, setSetoresSel] = useState<string[]>([]);
  const todosOsSetores = setoresSel.length === 0;
  /** Um setor só marcado (e não o "sem setor"): é nele que a caixa nova nasce. */
  const setorUnico = setoresSel.length === 1 && setoresSel[0] !== '__sem__' ? setoresSel[0] : '';

  const doRecorte = useMemo(() => {
    if (todosOsSetores) return nos;
    const chaves = setoresSel.filter(x => x !== '__sem__').map(chave);
    const comSem = setoresSel.includes('__sem__');
    return nos.filter(n => (n.setor || '').trim() ? chaves.includes(chave(n.setor)) : comSem);
  }, [nos, setoresSel, todosOsSetores]);

  const idsExistentes = useMemo(() => new Set(nos.map(n => n.id)), [nos]);

  const { raizes, orfaos, total } = useMemo(
    () => montarArvore(doRecorte, idsExistentes),
    [doRecorte, idsExistentes]
  );

  /** Quantas caixas cada setor tem — o seletor diz o tamanho antes de abrir. */
  const contagemPorSetor = useMemo(() => {
    const mapa = new Map<string, number>();
    nos.forEach(n => {
      const s = (n.setor || '').trim();
      if (s) mapa.set(s, (mapa.get(s) || 0) + 1);
    });
    return mapa;
  }, [nos]);

  const comDesenho = useMemo(
    () => setoresDoDesenho.filter(nome => (contagemPorSetor.get(nome) || 0) > 0),
    [setoresDoDesenho, contagemPorSetor]
  );
  const vaziosDoCatalogo = useMemo(
    () => setoresDoDesenho.filter(nome => !(contagemPorSetor.get(nome) || 0)),
    [setoresDoDesenho, contagemPorSetor]
  );

  const rotuloDoRecorte = todosOsSetores
    ? 'todos os setores'
    : setoresSel.map(x => (x === '__sem__' ? 'sem setor' : x)).join(', ');

  /** Com desenho primeiro (com o tamanho), depois os pendentes e os vazios do catálogo. */
  const opcoesSetor = useMemo(() => [
    ...comDesenho.map(nome => ({ valor: nome, rotulo: `${nome} (${contagemPorSetor.get(nome)})` })),
    ...(semSetor > 0 ? [{ valor: '__sem__', rotulo: `Sem setor (${semSetor})` }] : []),
    ...vaziosDoCatalogo.map(nome => ({ valor: nome, rotulo: `${nome} (vazio)` })),
  ], [comDesenho, contagemPorSetor, semSetor, vaziosDoCatalogo]);

  /**
   * Nomes sugeridos para o cargo escolhido — é todo o papel do quadro aqui.
   * Quem já está no desenho sai da lista: sugerir de novo convida a duplicar.
   */
  const sugestoes = useMemo(() => {
    if (!form.cargo) return [];
    const jaNoDesenho = new Set(nos.map(n => chave(n.nome)));
    return funcionarios
      .filter(f => f.ativo !== false && chave(f.cargo) === chave(form.cargo))
      .filter(f => !jaNoDesenho.has(chave(f.nome)))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [funcionarios, nos, form.cargo]);

  const abrirNovo = (sob: NoOrganogramaDoc | null) => {
    setEditando(null);
    setNovoSob(sob);
    setForm({
      nome: '', cargo: '',
      sede: sob?.sede || '',
      // O subordinado nasce no setor do chefe; sem chefe, no setor que está
      // aberto na tela. Fora isso, a caixa sumiria do recorte ao ser criada.
      setor: sob?.setor || setorUnico,
      // Turno nasce vazio mesmo tendo chefe: o subordinado noturno de um chefe
      // diurno e o caso comum, nao a excecao.
      turno: '',
      respondeA: sob?.id || '',
    });
    setErro('');
    setAbrindo(true);
  };

  const abrirEdicao = (n: NoOrganogramaDoc) => {
    setEditando(n);
    setNovoSob(null);
    setForm({
      nome: n.nome || '', cargo: n.cargo || '', sede: n.sede || '',
      setor: n.setor || '', turno: n.turno || '', respondeA: n.respondeA || '',
    });
    setErro('');
    setAbrindo(true);
  };

  const salvar = async () => {
    if (!form.nome.trim()) return setErro('Informe o nome (ou o que vai na caixa).');
    const corpo = {
      nome: form.nome.trim(),
      cargo: form.cargo.trim() || undefined,
      sede: form.sede.trim() || undefined,
      setor: form.setor.trim() || undefined,
      turno: form.turno.trim() || undefined,
      respondeA: form.respondeA || undefined,
    };
    setSalvando(true);
    try {
      if (editando && atualizarNo) await atualizarNo(editando.id, corpo);
      else if (adicionarNo) await adicionarNo(corpo);
      setAbrindo(false);
    } catch (e: any) {
      setErro(`Não foi possível salvar: ${e?.message || e}`);
    } finally {
      setSalvando(false);
    }
  };

  const remover = (n: NoOrganogramaDoc) => {
    if (!removerNo) return;
    const equipe = descendentes(raizes, n.id).size;
    const mensagem = equipe
      ? `"${n.nome}" tem ${equipe === 1 ? '1 pessoa' : `${equipe} pessoas`} abaixo. Elas sobem para o topo do desenho — não são apagadas.`
      : `Remover "${n.nome}" do organograma?`;
    const acao = () => removerNo(n.id);
    if (confirmAction) confirmAction('Remover do organograma', mensagem, acao);
    else acao();
  };

  const soltarSobre = async (idArrastado: string, idDestino: string) => {
    setArrastando(null);
    setArrastandoSobre(null);
    if (!atualizarNo || !idArrastado || idArrastado === idDestino) return;
    const arrastado = nos.find(n => n.id === idArrastado);
    const destino = nos.find(n => n.id === idDestino);
    if (!arrastado || !destino) return;

    if (descendentes(raizes, idArrastado).has(idDestino)) {
      setAviso(`${destino.nome} está abaixo de ${arrastado.nome} — não dá para inverter os dois de uma vez.`);
      return;
    }
    setAviso('');
    try { await atualizarNo(idArrastado, { respondeA: idDestino }); }
    catch (e: any) { setAviso(`Não foi possível mover: ${e?.message || e}`); }
  };

  const soltarNoTopo = async (idArrastado: string) => {
    setArrastando(null);
    if (!atualizarNo || !idArrastado) return;
    setAviso('');
    try { await atualizarNo(idArrastado, { respondeA: '' }); }
    catch (e: any) { setAviso(`Não foi possível mover: ${e?.message || e}`); }
  };

  /**
   * Cada setor encolhe para caber na folha, em vez de rolar de lado (regra de
   * 08/10/2026: nada rola de lado no notebook). O piso de 60% mantém o nome
   * legível; abaixo disso a folha rola como último recurso. Na impressão o
   * zoom volta a 1 (index.css, @media print).
   */
  const folha = useRef<HTMLDivElement>(null);
  const ESCALA_MINIMA = 0.6;
  useLayoutEffect(() => {
    const el = folha.current;
    if (!el) return;
    const ajustar = () => {
      const largura = el.clientWidth - 40; // o padding da folha (p-5)
      el.querySelectorAll<HTMLElement>('.org-t > li').forEach(li => {
        li.style.zoom = '';
        const natural = li.scrollWidth;
        li.style.zoom = natural > largura ? String(Math.max(ESCALA_MINIMA, largura / natural)) : '';
      });
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(el);
    return () => ro.disconnect();
    // A largura da árvore só muda com o recorte, o recolher e o "mostrar os outros".
  }, [doRecorte, recolhidos, mostrarTodos]);

  const alternarRecolhido = (id: string) =>
    setRecolhidos(s => {
      const novo = new Set(s);
      novo.has(id) ? novo.delete(id) : novo.add(id);
      return novo;
    });

  /** Imprimir expande tudo: o recolhido não existe no DOM, sairia fora do PDF. */
  const imprimir = () => {
    const comEquipe = new Set<string>();
    const varrer = (lista: ArvoreNo[]) => lista.forEach(i => {
      if (i.filhos.length) comEquipe.add(i.no.id);
      varrer(i.filhos);
    });
    varrer(raizes);
    setRecolhidos(new Set());
    setMostrarTodos(comEquipe);
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  };

  const Caixa: React.FC<{ item: ArvoreNo }> = ({ item }) => {
    const { no } = item;
    const recolhido = recolhidos.has(no.id);
    const temFilhos = item.filhos.length > 0;
    const alvo = arrastandoSobre === no.id;
    const saindo = arrastando === no.id;
    const admissao = admissaoDoQuadro(funcionarios, no.nome);
    // Só a equipe de FOLHAS desce em coluna. Empilhar um nível com ramos
    // embaixo jogaria um ramo debaixo do outro e sugeriria hierarquia que não
    // existe — ver o comentário de `.org-t-folhas` no index.css.
    const soFolhas = temFilhos && item.filhos.every(f => f.filhos.length === 0);

    return (
      <li>
        <div
          draggable={podeEditar}
          onDragStart={e => { setArrastando(no.id); e.dataTransfer.setData('text/plain', no.id); e.dataTransfer.effectAllowed = 'move'; }}
          onDragEnd={() => { setArrastando(null); setArrastandoSobre(null); }}
          onDragOver={e => {
            if (!podeEditar || !arrastando || arrastando === no.id) return;
            e.preventDefault();
            e.stopPropagation(); // a área "soltar no topo" é ancestral desta caixa
            setArrastandoSobre(no.id);
          }}
          onDragLeave={() => setArrastandoSobre(a => (a === no.id ? null : a))}
          onDrop={e => {
            e.preventDefault();
            e.stopPropagation(); // senão o drop sobe e desfaz o vínculo recém-criado
            soltarSobre(e.dataTransfer.getData('text/plain') || arrastando || '', no.id);
          }}
          className={`org-cartao org-caixa group relative ${
            podeEditar ? 'cursor-grab active:cursor-grabbing' : ''
          } ${alvo ? 'ring-2 ring-indigo-300 border-indigo-400' : ''} ${saindo ? 'opacity-40' : ''} ${
            // O topo em tinta cheia: num desenho em que tudo pesa igual, o olho
            // não recebe ajuda nenhuma para achar onde a hierarquia começa.
            item.nivel === 1 ? 'org-topo' : ''
          }`}
        >
          {/* O lugar da foto. Hoje as iniciais; no dia em que houver imagem ela
              entra aqui, no mesmo quadrado, sem mexer no resto. */}
          <span className="org-foto" aria-hidden="true">{iniciais(no.nome)}</span>

          <span className="min-w-0">
            <span className="org-nome">{no.nome}</span>
            {no.cargo && <span className="org-cargo">{no.cargo}</span>}
            {/* Turno e admissão só existem quando há o que dizer: linha em
                branco num cartão é pior que linha ausente. */}
            {no.turno && <span className="org-meta">Turno {no.turno}</span>}
            {admissao && <span className="org-meta">Admissão {admissao}</span>}
            {no.sede && (
              <span className={`org-meta ${item.nivel === 1 ? '' : 'text-slate-400'}`}>
                {no.sede}
              </span>
            )}
          </span>

          {/* Contador da equipe: recolhe o ramo. Fica na quina de cima, fora do
              texto — no cartão novo não há mais a coluna lateral de antes. */}
          {temFilhos && (
            <button
              onClick={() => alternarRecolhido(no.id)}
              aria-label={recolhido ? `Expandir equipe de ${no.nome}` : `Recolher equipe de ${no.nome}`}
              aria-expanded={!recolhido}
              title={`${item.filhos.length} ${item.filhos.length === 1 ? 'pessoa responde' : 'pessoas respondem'} a ${no.nome}`}
              className={`absolute -bottom-2 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-bold tabular-nums cursor-pointer no-print ${
                item.nivel === 1
                  ? 'bg-slate-800 border-slate-700 text-white/80'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {recolhido ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {item.filhos.length}
            </button>
          )}

          {podeEditar && (
            /* Em toque não existe hover: sem isto, tablet nunca via os botões. */
            <span className={`org-acoes no-print absolute top-1 right-1 flex items-center gap-0.5 rounded-md ${
              item.nivel === 1 ? 'bg-slate-800/90' : 'bg-white/90'
            }`}>
              <button onClick={() => abrirNovo(no)} aria-label={`Adicionar subordinado a ${no.nome}`}
                title="Adicionar subordinado"
                className={`w-6 h-6 flex items-center justify-center rounded cursor-pointer ${
                  item.nivel === 1 ? 'text-white/70 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'
                }`}>
                <UserPlus className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => abrirEdicao(no)} aria-label={`Editar ${no.nome}`}
                className={`w-6 h-6 flex items-center justify-center rounded cursor-pointer ${
                  item.nivel === 1 ? 'text-white/70 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'
                }`}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => remover(no)} aria-label={`Remover ${no.nome}`}
                className={`w-6 h-6 flex items-center justify-center rounded cursor-pointer ${
                  item.nivel === 1 ? 'text-white/70 hover:bg-rose-500/20' : 'text-slate-500 hover:bg-rose-50 hover:text-rose-600'
                }`}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </span>
          )}
        </div>

        {temFilhos && !recolhido && (
          <ul className={soFolhas ? 'org-t-folhas' : undefined}>
            {item.filhos.slice(0, mostrarTodos.has(no.id) ? undefined : LIMITE_VISIVEL)
              .map(f => <Caixa key={f.no.id} item={f} />)}
            {item.filhos.length > LIMITE_VISIVEL && (
              <li className="org-t-extra">
                <button
                  onClick={() => setMostrarTodos(m => {
                    const novo = new Set(m);
                    novo.has(no.id) ? novo.delete(no.id) : novo.add(no.id);
                    return novo;
                  })}
                  className="my-0.5 px-2 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer no-print"
                >
                  {mostrarTodos.has(no.id) ? 'Mostrar menos' : `Mostrar os outros ${item.filhos.length - LIMITE_VISIVEL}`}
                </button>
              </li>
            )}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="pagina-cab no-print">
        <div className="min-w-0">
          <p className="pagina-trilha">Pessoas</p>
          <h1 className="pagina-titulo">Organograma</h1>
          <p className="inicio-sub">Monte a estrutura de cima para baixo. O cargo sugere nomes do quadro.</p>
        </div>
        <div className="pagina-acoes">
          {opcoesSetor.length > 0 && (
            <FiltroMultiplo rotulo="Setor" selecionados={setoresSel} onChange={setSetoresSel} opcoes={opcoesSetor} />
          )}
          <button type="button" className="btn" onClick={imprimir}><Printer aria-hidden="true" /> Imprimir</button>
          {podeEditar && (
            <button type="button" className="btn btn-primario" onClick={() => abrirNovo(null)}><Plus aria-hidden="true" /> Nova caixa</button>
          )}
        </div>
      </header>

      {aviso && (
        <p role="alert" className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-3.5 py-2.5 text-[11px] font-semibold">
          {aviso}
        </p>
      )}

      {orfaos.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5 flex items-start gap-3 no-print">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-amber-800">
            {orfaos.length === 1
              ? `"${orfaos[0].nome}" respondia a alguém que saiu do desenho e subiu para o topo.`
              : `${orfaos.length} pessoas respondiam a alguém que saiu do desenho e subiram para o topo.`}
          </p>
        </div>
      )}

      <div ref={folha} className="org-folha painel p-5">
        {raizes.length === 0 ? (
          <div className="py-14 text-center">
            <Network className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-600">
              {todosOsSetores
                ? 'O organograma está vazio.'
                : `Nenhuma caixa em ${rotuloDoRecorte}.`}
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              Comece pela caixa do topo — depois use o <strong>+</strong> de cada caixa para pendurar quem responde a ela.
            </p>
          </div>
        ) : (
          <>
            <div className="print-only mb-3">
              <p className="text-sm font-bold">
                Organograma{todosOsSetores ? '' : ` — ${rotuloDoRecorte}`}
              </p>
              <p className="text-[11px]">
                {total} {total === 1 ? 'caixa' : 'caixas'} · {profundidade(raizes)} {profundidade(raizes) === 1 ? 'nível' : 'níveis'} ·
                gerado em {new Date().toLocaleDateString('pt-BR')}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {todosOsSetores ? '' : `${rotuloDoRecorte} · `}
                {total} {total === 1 ? 'caixa' : 'caixas'} · {profundidade(raizes)} {profundidade(raizes) === 1 ? 'nível' : 'níveis'}
              </p>
              {podeEditar && (
                <span className="text-[10px] font-semibold text-slate-500 no-print">
                  Arraste uma caixa sobre outra para mudar de chefe.
                </span>
              )}
            </div>

            {/* Soltar aqui tira o vínculo e devolve a caixa ao topo. */}
            <div
              onDragOver={e => { if (arrastando) e.preventDefault(); }}
              onDrop={e => { e.preventDefault(); soltarNoTopo(e.dataTransfer.getData('text/plain') || arrastando || ''); }}
            >
              {/* Vários topos ficam um EMBAIXO do outro, não lado a lado: são
                  árvores separadas, e alinhá-las na mesma fileira sugeriria
                  irmandade entre pessoas que não se respondem. */}
              <ul className="org-t space-y-8">
                {raizes.map(item => <Caixa key={item.no.id} item={item} />)}
              </ul>
            </div>
          </>
        )}
      </div>

      {abrindo && (
        <Modal
          titulo={editando ? `Editar ${editando.nome}` : novoSob ? 'Adicionar subordinado' : 'Nova caixa'}
          antes={novoSob ? <>responde a {novoSob.nome}</> : 'Organograma'}
          aoFechar={() => setAbrindo(false)}
          rodape={<>
            <button type="button" className="btn" onClick={() => setAbrindo(false)}>Cancelar</button>
            <button type="button" className="btn btn-primario" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
          </>}
        >
          <div className="space-y-4">
            {/* O CARGO vem primeiro: é ele que sugere os nomes. */}
            <label className="block">
              <span className="rotulo">Cargo</span>
              <input className="campo w-full" list="org-cargos" placeholder="Ex.: Supervisor(a)"
                value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} />
              <datalist id="org-cargos">
                {cargos.filter(c => c?.nome).map(c => <option key={c.id} value={c.nome} />)}
              </datalist>
            </label>

            <label className="block">
              <span className="rotulo">Nome *</span>
              <input className="campo w-full" list="org-sugestoes" autoComplete="off"
                placeholder={form.cargo ? 'Digite ou escolha da lista' : 'Digite o nome'}
                value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              <datalist id="org-sugestoes">
                {sugestoes.map(f => <option key={f.id} value={f.nome}>{f.sede || ''}</option>)}
              </datalist>
              <span className="ajuda block">
                {!form.cargo
                  ? 'Informe o cargo para o sistema sugerir nomes do quadro.'
                  : sugestoes.length === 0
                  ? 'Ninguém no quadro com esse cargo (ou já estão no desenho). Dá para digitar livremente.'
                  : `${sugestoes.length === 1 ? '1 nome sugerido' : `${sugestoes.length} nomes sugeridos`} do quadro, ou digite outro, inclusive posição vaga.`}
              </span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="rotulo">Setor</span>
                <input className="campo w-full" list="org-setores" placeholder="Ex.: Infra"
                  value={form.setor} onChange={e => setForm(f => ({ ...f, setor: e.target.value }))} />
                <datalist id="org-setores">
                  {setoresDoDesenho.map(nome => <option key={nome} value={nome} />)}
                </datalist>
                <span className="ajuda block">Cada setor tem o seu organograma.</span>
              </label>
              <label className="block">
                <span className="rotulo">Sede (opcional)</span>
                <input className="campo w-full" list="org-sedes"
                  value={form.sede} onChange={e => setForm(f => ({ ...f, sede: e.target.value }))} />
                <datalist id="org-sedes">
                  {sedes.map(s => <option key={s.nome} value={s.nome} />)}
                </datalist>
              </label>
            </div>

            {/* Turno: lista fechada, e não texto livre. Digitado à mão, o
                mesmo turno vira "Noturno", "noturno" e "NOT" em três caixas
                do mesmo desenho — e aí o cartão deixa de alinhar. */}
            <label className="block">
              <span className="rotulo">Turno (opcional)</span>
              <select className="campo w-full" value={form.turno} onChange={e => setForm(f => ({ ...f, turno: e.target.value }))}>
                <option value="">Sem turno</option>
                <option value="Diurno">Diurno</option>
                <option value="Noturno">Noturno</option>
                <option value="ADM">ADM</option>
              </select>
            </label>

            {editando && (
              <label className="block">
                <span className="rotulo">Responde a</span>
                <select className="campo w-full" value={form.respondeA} onChange={e => setForm(f => ({ ...f, respondeA: e.target.value }))}>
                  <option value="">— ninguém (fica no topo) —</option>
                  {nos
                    .filter(n => n.id !== editando.id && !descendentes(raizes, editando.id).has(n.id))
                    .map(n => (
                      <option key={n.id} value={n.id}>{n.nome}{n.cargo ? ` — ${n.cargo}` : ''}</option>
                    ))}
                </select>
                <span className="ajuda block">A própria equipe dela não aparece na lista: evita o desenho virar um laço.</span>
              </label>
            )}

            {erro && <p role="alert" className="erro-form">{erro}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
};
