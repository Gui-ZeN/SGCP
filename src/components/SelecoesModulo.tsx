/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Módulo Seleções — a planilha de Seleções dentro do sistema (23/09/2026:
 * "daqui para frente elas lançam só no sistema").
 *
 * Um dia de seleção por linha, como a aba QUANTI, com a linha de TOTAL; ao
 * clicar, os dados da seleção (editáveis) e os candidatos, como a aba nominal.
 * O Resumo do Dia continua sendo a visão "de hoje" — os dois usam `selecoes`.
 */
import React, { useMemo, useState } from 'react';
import type { Selecao, Candidato, Vaga } from '../types';
import type { Sede } from '../hooks/useMetadata';
import { camposDoFormulario, ehRealizada, vagasSugeridas, origemDoSetor, type FormularioSelecao } from '../utils/selecao';
import { formatDateBR, toISOInput, dataISOLocal } from '../utils/date';
import {
  opcoesDeSede, naSede, siglaDaSede, anoMes, noPeriodo, anosDosDados, MESES_LONGOS, type Periodo,
} from '../utils/filtroIndicadores';
import { normalizarNome } from '../utils/catalogo';
import { CandidatosPlanilha } from './CandidatosPlanilha';
import { PlusCircle, Search, X } from 'lucide-react';

type Dados = Pick<Candidato, 'nome' | 'resultado' | 'contratado' | 'motivo' | 'observacao'>;

interface Props {
  selecoes: Selecao[];
  sedes: Sede[];
  /** O Quadro de Vagas — para ligar a seleção às vagas que ela atende. */
  vagas?: Vaga[];
  /** Abrir esta seleção já filtrada nos candidatos (vindo do Quadro de Vagas). */
  foco?: { id: string; token: number } | null;
  setores?: string[];
  sedePadrao?: string;
  responsavelPadrao?: string;
  /** Ausente = somente leitura (Visualizador). */
  salvarSelecao?: (campos: Omit<Selecao, 'id'>, id?: string) => Promise<void>;
  candidatos?: Candidato[];
  salvarCandidato?: (selecao: Selecao, dados: Dados, id?: string) => Promise<void>;
  registrarCandidatos?: (selecao: Selecao, nomes: string[]) => Promise<void>;
  removerCandidato?: (selecao: Selecao, id: string) => Promise<void>;
  confirmAction?: (titulo: string, mensagem: string, onConfirm: () => void | Promise<void>) => void;
}

const ordem = (d: string) => { const am = anoMes(d); return am ? am[0] * 10000 + am[1] * 100 + Number(d.slice(0, 2)) : 0; };
const campo = 'w-full text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white font-medium text-slate-800 outline-none focus:border-slate-800 disabled:bg-slate-100 disabled:text-slate-500';
const rotulo = 'block text-[11px] font-semibold text-slate-600 mb-1';
const filtro = 'text-sm bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-2 font-semibold text-slate-800 outline-none focus:border-slate-800 cursor-pointer';

export const SelecoesModulo: React.FC<Props> = ({
  selecoes, sedes, vagas = [], foco, setores = [], sedePadrao = '', responsavelPadrao = '', salvarSelecao,
  candidatos, salvarCandidato, registrarCandidatos, removerCandidato, confirmAction,
}) => {
  // ── filtros ──
  const anos = useMemo(() => anosDosDados(selecoes.map(s => s.data)), [selecoes]);
  const anoAtual = new Date().getFullYear();
  const [periodo, setPeriodo] = useState<Periodo>({ ano: anoAtual, mes: null });
  const [sede, setSede] = useState<string | null>(null);
  const [origem, setOrigem] = useState<'todas' | Selecao['origem']>('todas');
  const [busca, setBusca] = useState('');
  // As duas abas da planilha: QUANTI (um dia por linha) e a nominal (uma
  // pessoa por linha).
  const [visao, setVisao] = useState<'selecoes' | 'candidatos'>('selecoes');
  const opcoes = useMemo(() => opcoesDeSede(sedes, selecoes.map(s => s.sede)), [sedes, selecoes]);
  const daSede = useMemo(() => naSede(sedes, sede), [sedes, sede]);

  const filtradas = useMemo(
    () => selecoes.filter(s => noPeriodo(periodo, anoMes(s.data)) && daSede(s.sede) && (origem === 'todas' || s.origem === origem)),
    [selecoes, periodo, daSede, origem]
  );
  const linhas = useMemo(() => {
    const q = normalizarNome(busca);
    return filtradas
      .filter(s => !q || normalizarNome([s.cargo, s.setor, s.gestor, s.responsavel, s.sede].join(' ')).includes(q))
      .sort((a, b) => ordem(b.data) - ordem(a.data) || a.cargo.localeCompare(b.cargo, 'pt-BR'));
  }, [filtradas, busca]);

  // Total só das REALIZADAS — o mesmo recorte do painel de Indicadores. Somar
  // convocados de agendada e presença só de realizada daria dois números
  // diferentes para o mesmo mês em duas telas.
  const total = useMemo(() => {
    const feitas = linhas.filter(ehRealizada);
    const soma = (k: 'convocados' | 'compareceram' | 'ausentes' | 'desistiram' | 'contratados') => feitas.reduce((t, s) => t + (Number(s[k]) || 0), 0);
    return { feitas: feitas.length, agendadas: linhas.length - feitas.length,
      convocados: soma('convocados'), compareceram: soma('compareceram'), ausentes: soma('ausentes'), desistiram: soma('desistiram'), contratados: soma('contratados') };
  }, [linhas]);

  const porSelecao = useMemo(() => {
    const m = new Map<string, Candidato[]>();
    for (const c of candidatos || []) (m.get(c.selecaoId) || m.set(c.selecaoId, []).get(c.selecaoId)!).push(c);
    return m;
  }, [candidatos]);

  // ── edição ──
  const [aberta, setAberta] = useState<'nova' | null>(null);
  // Clicar numa seleção leva aos CANDIDATOS dela (a aba de nomes filtrada) —
  // é para lá que se vai quase sempre: lançar nomes e resultados.
  const [filtroSel, setFiltroSel] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const selFiltrada = filtroSel ? selecoes.find(s => s.id === filtroSel) : undefined;
  const abrirCandidatos = (id: string) => {
    setFiltroSel(id); setEditando(false); setVisao('candidatos');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  // Veio do Quadro de Vagas ("Ver candidatos" numa seleção da vaga).
  React.useEffect(() => { if (foco?.id) abrirCandidatos(foco.id); }, [foco?.token]);

  /** Salvar com os CÓDIGOS das vagas junto dos ids — o Quadro também casa por código. */
  const comCodigos = (campos: Omit<Selecao, 'id'>) => ({
    ...campos,
    vagaCodigos: (campos.vagaIds || []).map(id => Number(vagas.find(v => v.id === id)?.codigo)).filter(n => Number.isFinite(n)),
  });

  const sugestoes = useMemo(() => {
    const u = (f: (s: Selecao) => string | undefined) => [...new Set(selecoes.map(f).map(x => (x || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return { cargos: u(s => s.cargo), gestores: u(s => s.gestor), setores: [...new Set([...setores, ...u(s => s.setor)])].sort((a, b) => a.localeCompare(b, 'pt-BR')), rh: u(s => s.responsavel) };
  }, [selecoes, setores]);

  return (
    <div className="space-y-5">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Seleções</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            {visao === 'selecoes'
              ? 'Um dia de seleção por linha, como a aba QUANTI. Clique numa linha para ir aos candidatos dela.'
              : 'Uma pessoa por linha, como a aba de nomes da planilha. Resultado, contratação e observação se editam na própria linha.'}
          </p>
          <div role="tablist" aria-label="Visão" className="mt-3 inline-flex border-b border-slate-200">
            {([['selecoes', 'Seleções'], ['candidatos', 'Candidatos']] as const).map(([id, r]) => (
              <button key={id} role="tab" type="button" aria-selected={visao === id} onClick={() => { setVisao(id); setFiltroSel(null); }}
                className={`px-3.5 py-2 text-sm font-semibold border-b-2 -mb-px cursor-pointer transition-colors ${
                  visao === id ? 'border-[var(--sgpc-acento,#1B4DD8)] text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>
        {salvarSelecao && (
          <button onClick={() => setAberta('nova')}
            className="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold cursor-pointer transition-colors">
            <PlusCircle className="w-4 h-4" aria-hidden="true" /> Nova seleção
          </button>
        )}
      </header>

      {aberta === 'nova' && salvarSelecao && (
        <FormSelecao
          titulo="Nova seleção" sugestoes={sugestoes} sedes={sedes} vagas={vagas}
          inicial={{ data: formatDateBR(dataISOLocal()), cargo: '', sede: sedePadrao, origem: 'geral', setor: '', gestor: '', responsavel: responsavelPadrao,
            convocados: 0, jaAconteceu: false, compareceram: 0, ausentes: 0, desistiram: 0, contratados: 0, vagaIds: [] }}
          onSalvar={async campos => { await salvarSelecao(comCodigos(campos)); setAberta(null); }}
          onFechar={() => setAberta(null)}
        />
      )}

      {/* Filtros numa linha só, acima da tabela */}
      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-600">Ano</span>
          <select className={filtro} value={periodo.ano ?? ''} onChange={e => setPeriodo({ ano: e.target.value ? Number(e.target.value) : null, mes: null })}>
            {[...new Set([anoAtual, ...anos])].sort((a, b) => b - a).map(a => <option key={a} value={a}>{a}</option>)}
            <option value="">Todos</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-600">Mês</span>
          <select className={filtro} value={periodo.mes ?? ''} disabled={periodo.ano === null}
            onChange={e => setPeriodo(p => ({ ...p, mes: e.target.value ? Number(e.target.value) : null }))}>
            <option value="">Ano inteiro</option>
            {MESES_LONGOS.map((m, i) => <option key={m} value={i + 1}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-600">Sede</span>
          <select className={filtro} value={sede ?? ''} onChange={e => setSede(e.target.value || null)}>
            <option value="">Todas as sedes</option>
            {opcoes.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-600">Planilha</span>
          <div role="group" aria-label="Geral ou Pedagógico" className="inline-flex p-1 bg-slate-100 rounded-lg gap-0.5">
            {([['todas', 'Todas'], ['geral', 'Geral'], ['pedagogico', 'Pedagógico']] as const).map(([id, r]) => (
              <button key={id} type="button" aria-pressed={origem === id} onClick={() => setOrigem(id)}
                className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${origem === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <span className="text-[11px] font-semibold text-slate-600">Buscar</span>
          <span className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input className={`${campo} pl-9`} value={busca} onChange={e => setBusca(e.target.value)} placeholder={visao === 'candidatos' ? 'Nome, cargo, setor, gestor, RH…' : 'Cargo, setor, gestor, responsável…'} />
          </span>
        </label>
      </div>

      {visao === 'candidatos' ? (<>
        {selFiltrada && (
          <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-500">Candidatos da seleção</p>
              <p className="text-sm font-bold text-slate-900">
                {selFiltrada.data} · {selFiltrada.cargo} · {siglaDaSede(sedes, selFiltrada.sede) || 'sem sede'}
                <span className="font-medium text-slate-500"> · {selFiltrada.origem === 'pedagogico' ? 'Pedagógico' : 'Geral'}{selFiltrada.gestor ? ` · gestor ${selFiltrada.gestor}` : ''}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {salvarSelecao && (
                <button onClick={() => setEditando(v => !v)} aria-expanded={editando}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                  {editando ? 'Fechar dados' : 'Editar dados da seleção'}
                </button>
              )}
              <button onClick={() => { setFiltroSel(null); setEditando(false); }}
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                Ver todos os candidatos
              </button>
            </div>
          </div>
        )}
        {selFiltrada && editando && salvarSelecao && (
          <FormSelecao
            key={`form-${selFiltrada.id}`}
            titulo={`Dados da seleção · ${selFiltrada.cargo} · ${selFiltrada.data}`} sugestoes={sugestoes} sedes={sedes} vagas={vagas}
            numerosDaLista={!!selFiltrada.numerosPelaLista}
            inicial={{
              data: selFiltrada.data, cargo: selFiltrada.cargo, sede: selFiltrada.sede, origem: selFiltrada.origem,
              setor: selFiltrada.setor || '', gestor: selFiltrada.gestor || '', responsavel: selFiltrada.responsavel || '',
              convocados: selFiltrada.convocados, jaAconteceu: ehRealizada(selFiltrada),
              compareceram: selFiltrada.compareceram, ausentes: selFiltrada.ausentes, desistiram: selFiltrada.desistiram, contratados: selFiltrada.contratados,
              vagaIds: selFiltrada.vagaIds || (selFiltrada.vagaId ? [selFiltrada.vagaId] : []),
            }}
            onSalvar={async campos => {
              // Seleção com lista: os números são da lista — o formulário só
              // mexe nos dados da linha, nunca sobrescreve a contagem.
              const { convocados, compareceram, ausentes, desistiram, contratados, status, ...dados } = campos;
              await salvarSelecao(comCodigos(selFiltrada.numerosPelaLista ? dados as any : campos), selFiltrada.id);
              setEditando(false);
            }}
            onFechar={() => setEditando(false)}
          />
        )}
        <CandidatosPlanilha
          // Chave com prefixo: o formulário ao lado usa o mesmo id da seleção, e
          // duas irmãs com a mesma chave fazem o React deixar o formulário velho
          // na tela (visto no teste: "Ver todos" não fechava os dados).
          key={`lista-${filtroSel || 'todos'}`}
          selecoes={selFiltrada ? [selFiltrada] : filtradas} busca={busca} candidatos={candidatos || []} sedes={sedes}
          soPedagogico={selFiltrada ? selFiltrada.origem === 'pedagogico' : origem === 'pedagogico'}
          onSalvar={salvarCandidato} onRegistrar={registrarCandidatos} onRemover={removerCandidato}
          onNovaSelecao={salvarSelecao ? () => { setAberta('nova'); window.scrollTo({ top: 0, behavior: 'smooth' }); } : undefined}
          confirmAction={confirmAction}
        />
      </>) : (<>
      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden" aria-label="Seleções">
        {linhas.length === 0 ? (
          <p className="text-sm font-medium text-slate-500 text-center py-12">Nenhuma seleção com esses filtros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-[11px] font-semibold text-slate-600">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Data</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Cargo</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Sede</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Setor</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Gestor</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">RH</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Convocados</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Compareceram</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Ausentes</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Desistiram</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Contratados</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold text-right">Candidatos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linhas.map(s => {
                  const feita = ehRealizada(s);
                  const n = porSelecao.get(s.id)?.length || 0;
                  const numero = (v: number) => (feita ? v : '—');
                  return (
                    <tr key={s.id} onClick={() => abrirCandidatos(s.id)} title="Ver os candidatos desta seleção"
                      className="cursor-pointer transition-colors hover:bg-slate-50">
                      <td className="px-4 py-2.5 tabular-nums text-slate-700 whitespace-nowrap">
                        <button type="button" className="text-left font-semibold text-slate-900 cursor-pointer focus-visible:underline"
                          onClick={e => { e.stopPropagation(); abrirCandidatos(s.id); }} aria-label={`Candidatos da seleção de ${s.cargo}, ${s.data}`}>
                          {s.data}
                        </button>
                        {!feita && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-amber-700">agendada</span>}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900">
                        {s.cargo}
                        {s.origem === 'pedagogico' && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-violet-700">pedag.</span>}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{siglaDaSede(sedes, s.sede) || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-700">{s.setor || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-700">{s.gestor || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-700">{s.responsavel || '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-900">{s.convocados}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-800">{numero(s.compareceram)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-800">{numero(s.ausentes)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-800">{numero(s.desistiram)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-800">{s.origem === 'pedagogico' && !s.numerosPelaLista ? '—' : numero(s.contratados)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{n || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr className="text-sm font-bold text-slate-900">
                  <th scope="row" colSpan={6} className="px-4 py-2.5 text-left">
                    Total · {total.feitas} realizada{total.feitas === 1 ? '' : 's'}
                    {total.agendadas > 0 && <span className="font-medium text-slate-500"> · {total.agendadas} agendada{total.agendadas === 1 ? '' : 's'} fora da soma</span>}
                  </th>
                  <td className="px-3 py-2.5 text-right tabular-nums">{total.convocados.toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{total.compareceram.toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{total.ausentes.toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{total.desistiram.toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{total.contratados.toLocaleString('pt-BR')}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      </>)}
    </div>
  );
};

/** Os dados da seleção — o mesmo formulário para criar e para corrigir. */
const FormSelecao: React.FC<{
  titulo: string;
  inicial: FormularioSelecao;
  sedes: Sede[];
  sugestoes: { cargos: string[]; gestores: string[]; setores: string[]; rh: string[] };
  numerosDaLista?: boolean;
  vagas?: Vaga[];
  onSalvar: (campos: Omit<Selecao, 'id'>) => Promise<void>;
  onFechar: () => void;
}> = ({ titulo, inicial, sedes, sugestoes, numerosDaLista, vagas = [], onSalvar, onFechar }) => {
  const [f, setF] = useState<FormularioSelecao>(inicial);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const set = <K extends keyof FormularioSelecao>(k: K, v: FormularioSelecao[K]) => setF(x => ({ ...x, [k]: v }));
  // Seleção antiga sem vaga ligada abre com os campos livres; nova abre pedindo a vaga.
  const [semVaga, setSemVaga] = useState(!(inicial.vagaIds || []).length && !!inicial.cargo);
  const trocarSede = (sede: string) =>
    setF(x => semVaga ? { ...x, sede } : { ...x, sede, vagaIds: [], cargo: '', setor: '', gestor: '' });
  const marcarVaga = (v: Vaga) => setF(x => {
    const ligadas = x.vagaIds || [];
    if (ligadas.includes(v.id)) {
      const resto = ligadas.filter(id => id !== v.id);
      return resto.length ? { ...x, vagaIds: resto } : { ...x, vagaIds: [], cargo: '', setor: '', gestor: '' };
    }
    if (ligadas.length) return { ...x, vagaIds: [...ligadas, v.id] };
    return { ...x, vagaIds: [v.id], cargo: v.vaga, setor: v.setor || '', gestor: v.solicitante || '' };
  });
  const numeroCampo = (k: 'convocados' | 'compareceram' | 'ausentes' | 'desistiram' | 'contratados', r: string, bloqueado = false) => (
    <label className="block">
      <span className={rotulo}>{r}</span>
      <input type="number" min={0} inputMode="numeric" className={`${campo} tabular-nums`} disabled={bloqueado}
        value={f[k] || ''} onChange={e => set(k, Number(e.target.value) || 0)} />
    </label>
  );

  const salvar = async () => {
    // Planilha pelo setor. Sem setor (histórico da aba pedagógica, que não tem
    // a coluna), fica a que já estava.
    const g = { ...f, origem: f.setor ? origemDoSetor(f.setor) : f.origem };
    const { erros: e0, campos } = camposDoFormulario(numerosDaLista ? { ...g, convocados: Math.max(1, g.convocados) } : g);
    const e = !semVaga && !(f.vagaIds || []).length ? ['Escolha a vaga — ou use "Seleção sem vaga aberta".', ...e0.filter(x => !/cargo/i.test(x))] : e0;
    setErros(e);
    if (e.length) return;
    setSalvando(true);
    try { await onSalvar(campos); } catch (err: any) { setErros([`Não foi possível salvar: ${err?.message || err}`]); } finally { setSalvando(false); }
  };

  return (
    <section aria-label={titulo} className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h3 className="text-sm font-bold text-slate-900">{titulo}</h3>
        <button onClick={onFechar} aria-label="Fechar" className="w-8 h-8 shrink-0 rounded-full border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-500 cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <label className="block">
          <span className={rotulo}>Data *</span>
          <input type="date" className={campo} value={toISOInput(f.data)} onChange={e => set('data', formatDateBR(e.target.value))} />
        </label>
        <label className="block md:col-span-2">
          <span className={rotulo}>Sede *</span>
          <select className={campo} value={f.sede} onChange={e => trocarSede(e.target.value)}>
            <option value="">Escolha…</option>
            {f.sede && !sedes.some(s => s.nome === f.sede) && <option value={f.sede}>{f.sede}</option>}
            {sedes.map(s => <option key={s.nome} value={s.nome}>{s.sigla ? `${s.sigla} · ${s.nome}` : s.nome}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={rotulo}>Responsável (RH)</span>
          <input className={campo} list="sm-rh" value={f.responsavel} onChange={e => set('responsavel', e.target.value)} />
        </label>
      </div>

      {/* A seleção nasce de uma vaga aberta (24/09/2026): cargo, setor, gestor e
          planilha vêm dela. Ligar também soma o funil da vaga automaticamente. */}
      {!semVaga ? (
        <fieldset className="mt-4">
          <legend className={rotulo}>Vaga *</legend>
          {(() => {
            if (!f.sede) return <p className="text-xs text-slate-500 font-medium">Escolha a sede para ver as vagas abertas dela.</p>;
            const ligadas = f.vagaIds || [];
            // Depois da primeira vaga, só as do mesmo cargo: uma seleção, um cargo.
            const opcoes = vagasSugeridas(vagas, sedes, f.sede, f.cargo, ligadas)
              .filter(v => !ligadas.length || ligadas.includes(v.id) || normalizarNome(v.vaga) === normalizarNome(f.cargo));
            if (!opcoes.length) return <p className="text-xs text-slate-500 font-medium">Nenhuma vaga aberta nesta sede.</p>;
            return (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {opcoes.map(v => (
                  <label key={v.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50 text-sm">
                    <input type="checkbox" className="w-4 h-4 accent-slate-900 shrink-0" checked={ligadas.includes(v.id)} onChange={() => marcarVaga(v)} />
                    <span className="tabular-nums text-xs font-semibold text-slate-500 shrink-0">#{v.codigo}</span>
                    <span className="font-semibold text-slate-800 truncate">{v.vaga}</span>
                    <span className="ml-auto text-xs text-slate-500 shrink-0">{v.setor || ''}</span>
                  </label>
                ))}
              </div>
            );
          })()}
          {(f.vagaIds || []).length > 0 && (
            <p className="mt-2 text-xs text-slate-700 font-medium">
              <b className="font-semibold">{f.cargo}</b>
              {f.setor && <> · {f.setor}</>}
              {f.gestor && <> · gestor {f.gestor}</>}
              <span className="text-slate-500"> · conta na planilha {origemDoSetor(f.setor) === 'pedagogico' ? 'Pedagógico' : 'Geral'}</span>
            </p>
          )}
          <button type="button" onClick={() => { setSemVaga(true); setF(x => ({ ...x, vagaIds: [] })); }}
            className="mt-2 text-[11px] font-semibold text-slate-600 underline hover:text-slate-900 cursor-pointer">
            Seleção sem vaga aberta (banco de talentos)
          </button>
        </fieldset>
      ) : (
        <fieldset className="mt-4">
          <legend className={rotulo}>Seleção sem vaga aberta</legend>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block">
              <span className={rotulo}>Cargo *</span>
              <input className={campo} list="sm-cargos" value={f.cargo} onChange={e => set('cargo', e.target.value)} />
            </label>
            <label className="block">
              <span className={rotulo}>Setor</span>
              <input className={campo} list="sm-setores" value={f.setor} onChange={e => set('setor', e.target.value)} />
            </label>
            <label className="block">
              <span className={rotulo}>Gestor</span>
              <input className={campo} list="sm-gestores" value={f.gestor} onChange={e => set('gestor', e.target.value)} />
            </label>
          </div>
          <button type="button" onClick={() => { setSemVaga(false); setF(x => ({ ...x, cargo: '', setor: '', gestor: '' })); }}
            className="mt-2 text-[11px] font-semibold text-slate-600 underline hover:text-slate-900 cursor-pointer">
            Escolher uma vaga aberta
          </button>
        </fieldset>
      )}

      <datalist id="sm-cargos">{sugestoes.cargos.map(x => <option key={x} value={x} />)}</datalist>
      <datalist id="sm-setores">{sugestoes.setores.map(x => <option key={x} value={x} />)}</datalist>
      <datalist id="sm-gestores">{sugestoes.gestores.map(x => <option key={x} value={x} />)}</datalist>
      <datalist id="sm-rh">{sugestoes.rh.map(x => <option key={x} value={x} />)}</datalist>

      <div className="mt-4 pt-4 border-t border-slate-100">
        {numerosDaLista ? (
          <p className="text-xs font-medium text-slate-600">
            Os números desta seleção vêm da <b className="text-slate-800">lista de candidatos</b> abaixo — mude o resultado de cada pessoa para mudá-los.
          </p>
        ) : (
          <>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-slate-900" checked={f.jaAconteceu} onChange={e => set('jaAconteceu', e.target.checked)} />
              A seleção já aconteceu
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
              {numeroCampo('convocados', 'Convocados *')}
              {f.jaAconteceu && <>
                {numeroCampo('compareceram', 'Compareceram')}
                {numeroCampo('ausentes', 'Ausentes')}
                {numeroCampo('desistiram', 'Desistiram')}
                {(f.setor ? origemDoSetor(f.setor) : f.origem) === 'geral' && numeroCampo('contratados', 'Contratados')}
              </>}
            </div>
            {!f.jaAconteceu && <p className="text-[11px] text-slate-500 font-medium mt-2">Fica como agendada. O resultado é lançado depois — aqui ou pela lista de candidatos.</p>}
          </>
        )}
      </div>

      {erros.length > 0 && (
        <ul role="alert" className="mt-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3.5 py-2.5 text-xs font-semibold space-y-1">
          {erros.map(e => <li key={e}>{e}</li>)}
        </ul>
      )}

      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onFechar} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
        <button onClick={salvar} disabled={salvando} className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer">
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </section>
  );
};
