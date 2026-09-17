import React, { useMemo, useState } from 'react';
import type { Funcionario } from '../types';
import type { Sede, Cargo } from '../hooks/useMetadata';
import type { NoOrganogramaDoc } from '../hooks/useOrganograma';
import { montarArvore, profundidade, descendentes, type ArvoreNo } from '../utils/organograma';
import {
  Network, Plus, X, Pencil, Trash2, Printer, ChevronDown, ChevronRight, UserPlus, AlertTriangle,
} from 'lucide-react';

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
  adicionarNo?: (dados: Omit<NoOrganogramaDoc, 'id'>) => Promise<void>;
  atualizarNo?: (id: string, campos: Partial<NoOrganogramaDoc>) => Promise<void>;
  removerNo?: (id: string) => Promise<void>;
  confirmAction?: (titulo: string, mensagem: string, onConfirm: () => void | Promise<void>) => void;
}

const campoCls = 'w-full text-sm px-3 py-2.5 border border-slate-200 rounded-xl outline-none bg-white font-medium focus:border-slate-800';
const rotuloCls = 'block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1';
const chave = (t?: string) =>
  String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const OrganogramaSection: React.FC<OrganogramaSectionProps> = ({
  nos, funcionarios, cargos, sedes,
  adicionarNo, atualizarNo, removerNo, confirmAction,
}) => {
  const [editando, setEditando] = useState<NoOrganogramaDoc | null>(null);
  const [novoSob, setNovoSob] = useState<NoOrganogramaDoc | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const [form, setForm] = useState({ nome: '', cargo: '', sede: '', respondeA: '' });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const [mostrarTodos, setMostrarTodos] = useState<Set<string>>(new Set());
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [arrastandoSobre, setArrastandoSobre] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');

  const podeEditar = !!adicionarNo;
  const LIMITE_VISIVEL = 8;

  const { raizes, orfaos, total } = useMemo(() => montarArvore(nos), [nos]);

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
    setForm({ nome: '', cargo: '', sede: sob?.sede || '', respondeA: sob?.id || '' });
    setErro('');
    setAbrindo(true);
  };

  const abrirEdicao = (n: NoOrganogramaDoc) => {
    setEditando(n);
    setNovoSob(null);
    setForm({ nome: n.nome || '', cargo: n.cargo || '', sede: n.sede || '', respondeA: n.respondeA || '' });
    setErro('');
    setAbrindo(true);
  };

  const salvar = async () => {
    if (!form.nome.trim()) return setErro('Informe o nome (ou o que vai na caixa).');
    const corpo = {
      nome: form.nome.trim(),
      cargo: form.cargo.trim() || undefined,
      sede: form.sede.trim() || undefined,
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
          className={`group flex items-center gap-2.5 rounded-lg border bg-white px-2.5 py-1.5 transition ${
            podeEditar ? 'cursor-grab active:cursor-grabbing' : ''
          } ${alvo ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'} ${saindo ? 'opacity-40' : ''}`}
        >
          {temFilhos ? (
            <button
              onClick={() => alternarRecolhido(no.id)}
              aria-label={recolhido ? `Expandir equipe de ${no.nome}` : `Recolher equipe de ${no.nome}`}
              aria-expanded={!recolhido}
              className="flex items-center gap-0.5 px-1 py-0.5 -ml-0.5 rounded text-[10px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0 no-print"
            >
              {recolhido ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {item.filhos.length}
            </button>
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" aria-hidden="true" />
          )}

          <span className="text-[13px] font-bold text-slate-800 truncate">{no.nome}</span>
          {no.cargo && <span className="text-[11px] font-semibold text-slate-600 truncate">{no.cargo}</span>}
          {no.sede && <span className="text-[10px] font-semibold text-slate-500 truncate hidden sm:inline">{no.sede}</span>}

          {podeEditar && (
            <span className="flex items-center gap-0.5 ml-auto shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition no-print">
              <button onClick={() => abrirNovo(no)} aria-label={`Adicionar subordinado a ${no.nome}`}
                title="Adicionar subordinado"
                className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 cursor-pointer">
                <UserPlus className="w-3 h-3" />
              </button>
              <button onClick={() => abrirEdicao(no)} aria-label={`Editar ${no.nome}`}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 cursor-pointer">
                <Pencil className="w-3 h-3" />
              </button>
              <button onClick={() => remover(no)} aria-label={`Remover ${no.nome}`}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:bg-rose-50 hover:text-rose-600 cursor-pointer">
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>

        {temFilhos && !recolhido && (
          <ul className="org-l">
            {item.filhos.slice(0, mostrarTodos.has(no.id) ? undefined : LIMITE_VISIVEL)
              .map(f => <Caixa key={f.no.id} item={f} />)}
            {item.filhos.length > LIMITE_VISIVEL && (
              <li className="pl-[22px]">
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-850 flex items-center gap-2">
            <Network className="w-6 h-6 text-indigo-500" />
            Organograma
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Monte a estrutura de cima para baixo. O cargo sugere nomes do quadro.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start no-print">
          <button
            onClick={imprimir}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-750 rounded-xl text-xs font-bold uppercase tracking-wider border border-slate-250 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Imprimir
          </button>
          {podeEditar && (
            <button
              onClick={() => abrirNovo(null)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-slate-900/15 transition"
            >
              <Plus className="w-4 h-4" /> Nova caixa
            </button>
          )}
        </div>
      </div>

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

      <div className="org-folha bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        {raizes.length === 0 ? (
          <div className="py-14 text-center">
            <Network className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-600">O organograma está vazio.</p>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              Comece pela caixa do topo — depois use o <strong>+</strong> de cada caixa para pendurar quem responde a ela.
            </p>
          </div>
        ) : (
          <>
            <div className="print-only mb-3">
              <p className="text-sm font-bold">Organograma</p>
              <p className="text-[11px]">
                {total} {total === 1 ? 'caixa' : 'caixas'} · {profundidade(raizes)} níveis ·
                gerado em {new Date().toLocaleDateString('pt-BR')}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {total} {total === 1 ? 'caixa' : 'caixas'} · {profundidade(raizes)} níveis
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
              <ul className="org-l">
                {raizes.map(item => <Caixa key={item.no.id} item={item} />)}
              </ul>
            </div>
          </>
        )}
      </div>

      {abrindo && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div role="dialog" aria-modal="true" aria-labelledby="org-titulo"
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="min-w-0">
                <h3 id="org-titulo" className="text-sm font-bold text-slate-800">
                  {editando ? `Editar ${editando.nome}` : novoSob ? 'Adicionar subordinado' : 'Nova caixa'}
                </h3>
                {novoSob && (
                  <p className="text-[11px] text-slate-600 font-semibold truncate">responde a {novoSob.nome}</p>
                )}
              </div>
              <button onClick={() => setAbrindo(false)} aria-label="Fechar"
                className="w-8 h-8 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              {/* O CARGO vem primeiro: é ele que sugere os nomes. */}
              <div>
                <label htmlFor="org-cargo" className={rotuloCls}>Cargo</label>
                <input id="org-cargo" className={campoCls} list="org-cargos" placeholder="Ex.: Supervisor(a)…"
                  value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} />
                <datalist id="org-cargos">
                  {cargos.filter(c => c?.nome).map(c => <option key={c.id} value={c.nome} />)}
                </datalist>
              </div>

              <div>
                <label htmlFor="org-nome" className={rotuloCls}>Nome *</label>
                <input id="org-nome" className={campoCls} list="org-sugestoes" autoComplete="off"
                  placeholder={form.cargo ? 'Digite ou escolha da lista…' : 'Digite o nome'}
                  value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
                <datalist id="org-sugestoes">
                  {sugestoes.map(f => <option key={f.id} value={f.nome}>{f.sede || ''}</option>)}
                </datalist>
                <p className="text-[10px] text-slate-500 font-semibold mt-1">
                  {!form.cargo
                    ? 'Informe o cargo para o sistema sugerir nomes do quadro.'
                    : sugestoes.length === 0
                    ? 'Ninguém no quadro com esse cargo (ou já estão no desenho). Dá para digitar livremente.'
                    : `${sugestoes.length === 1 ? '1 nome sugerido' : `${sugestoes.length} nomes sugeridos`} do quadro — ou digite outro, inclusive posição vaga.`}
                </p>
              </div>

              <div>
                <label htmlFor="org-sede" className={rotuloCls}>Sede (opcional)</label>
                <input id="org-sede" className={campoCls} list="org-sedes"
                  value={form.sede} onChange={e => setForm(f => ({ ...f, sede: e.target.value }))} />
                <datalist id="org-sedes">
                  {sedes.map(s => <option key={s.nome} value={s.nome} />)}
                </datalist>
              </div>

              {editando && (
                <div>
                  <label htmlFor="org-responde" className={rotuloCls}>Responde a</label>
                  <select id="org-responde" className={campoCls} value={form.respondeA}
                    onChange={e => setForm(f => ({ ...f, respondeA: e.target.value }))}>
                    <option value="">— ninguém (fica no topo) —</option>
                    {nos
                      .filter(n => n.id !== editando.id && !descendentes(raizes, editando.id).has(n.id))
                      .map(n => (
                        <option key={n.id} value={n.id}>{n.nome}{n.cargo ? ` — ${n.cargo}` : ''}</option>
                      ))}
                  </select>
                  <p className="text-[10px] text-slate-500 font-semibold mt-1">
                    A própria equipe dela não aparece na lista — evita o desenho virar um laço.
                  </p>
                </div>
              )}

              {erro && (
                <p role="alert" className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-3.5 py-2.5 text-[11px] font-semibold">
                  {erro}
                </p>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setAbrindo(false)}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold rounded-xl text-slate-650 cursor-pointer">
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-bold rounded-xl text-white shadow-md cursor-pointer disabled:opacity-60">
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
