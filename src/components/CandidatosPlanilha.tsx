/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Os candidatos numa lista corrida — a aba nominal da planilha ("GERAL 2026",
 * "PEDAGÓGICO 2026") no sistema, com as MESMAS colunas na mesma ordem:
 *   DATA | NOME | CARGO | SEDE | SETOR | GESTOR | RH | TESTE/ENTREVISTA |
 *   CONTRATADO | MOTIVO DA DESISTÊNCIA/OBSERVAÇÕES
 * (a aba pedagógica não tem SETOR nem CONTRATADO — somem com o filtro).
 *
 * Diferença de propósito: data, cargo, sede, setor, gestor e RH vêm da
 * SELEÇÃO da pessoa, não são redigitados a cada nome — na planilha, cada linha
 * repetia os seis, e é daí que vinham "Auxiliar de cantina" e "Auxiliar de
 * Cantina" no mesmo dia. Resultado, contratação e observação se editam na
 * própria linha, como numa planilha.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Candidato, Selecao } from '../types';
import type { Sede } from '../hooks/useMetadata';
import { RESULTADOS, CONTRATACOES, MOTIVOS_DESISTENCIA, type ResultadoCandidato, type Contratacao } from '../utils/candidatos';
import { anoMes, siglaDaSede } from '../utils/filtroIndicadores';
import { normalizarNome } from '../utils/catalogo';
import { comMudanca, nomesDoTexto, type Dados } from './CandidatosDoDia';
import { Trash2, UserPlus } from 'lucide-react';

interface Props {
  /** As seleções já filtradas (período, sede, planilha). */
  selecoes: Selecao[];
  busca: string;
  candidatos: Candidato[];
  sedes: Sede[];
  /** Pedagógico não tem SETOR nem CONTRATADO na planilha. */
  soPedagogico: boolean;
  onSalvar?: (selecao: Selecao, dados: Dados, id?: string) => Promise<void>;
  onRegistrar?: (selecao: Selecao, nomes: string[]) => Promise<void>;
  onRemover?: (selecao: Selecao, id: string) => Promise<void>;
  onNovaSelecao?: () => void;
  confirmAction?: (titulo: string, mensagem: string, onConfirm: () => void | Promise<void>) => void;
}

const ordem = (d: string) => { const am = anoMes(d); return am ? am[0] * 10000 + am[1] * 100 + Number(d.slice(0, 2)) : 0; };
const celula = 'celula-planilha w-full min-w-0 text-xs px-2 py-1 border rounded bg-transparent font-medium text-slate-800 outline-none disabled:cursor-default';
const th = 'px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-600 bg-slate-50 whitespace-nowrap border-r border-slate-200 last:border-r-0';
// Linha de grade entre colunas, como no Excel.
const td = 'border-r border-slate-100 last:border-r-0';

export const CandidatosPlanilha: React.FC<Props> = ({
  selecoes, busca, candidatos, sedes, soPedagogico, onSalvar, onRegistrar, onRemover, onNovaSelecao, confirmAction,
}) => {
  const editavel = !!onSalvar;
  const porId = useMemo(() => new Map(selecoes.map(s => [s.id, s])), [selecoes]);

  // Cronológica, como a planilha: a mais recente embaixo, onde se digita.
  const linhas = useMemo(() => {
    const q = normalizarNome(busca);
    return candidatos
      .map(c => ({ c, s: porId.get(c.selecaoId) }))
      .filter((x): x is { c: Candidato; s: Selecao } => !!x.s)
      .filter(({ c, s }) => !q || normalizarNome([c.nome, s.cargo, s.setor, s.gestor, s.responsavel].join(' ')).includes(q))
      .sort((a, b) => ordem(a.s.data) - ordem(b.s.data) || a.s.cargo.localeCompare(b.s.cargo, 'pt-BR') || a.c.nome.localeCompare(b.c.nome, 'pt-BR'));
  }, [candidatos, porId, busca]);

  // Abre rolada até o fim — o lugar onde se continua digitando.
  const rolagem = useRef<HTMLDivElement>(null);
  const [rolouInicio, setRolouInicio] = useState(false);
  useEffect(() => {
    if (!rolouInicio && linhas.length && rolagem.current) {
      rolagem.current.scrollTop = rolagem.current.scrollHeight;
      setRolouInicio(true);
    }
  }, [linhas.length, rolouInicio]);

  // ── adicionar ──
  const opcoesSelecao = useMemo(() => [...selecoes].sort((a, b) => ordem(b.data) - ordem(a.data)), [selecoes]);
  // Filtrada numa seleção só (veio do clique na aba Seleções): ela já vem
  // escolhida — é só colar os nomes.
  const [selId, setSelId] = useState(() => (selecoes.length === 1 ? selecoes[0].id : ''));
  const [texto, setTexto] = useState('');
  const [adicionando, setAdicionando] = useState(false);
  const nomes = nomesDoTexto(texto);
  const adicionar = async () => {
    const s = porId.get(selId);
    if (!s || !nomes.length || !onRegistrar) return;
    setAdicionando(true);
    try {
      await onRegistrar(s, nomes);
      setTexto('');
      requestAnimationFrame(() => { if (rolagem.current) rolagem.current.scrollTop = rolagem.current.scrollHeight; });
    } finally { setAdicionando(false); }
  };

  const salvar = (s: Selecao, c: Candidato, m: Partial<Dados>) => onSalvar?.(s, comMudanca(c, m), c.id);
  const remover = (s: Selecao, c: Candidato) => {
    if (!onRemover) return;
    const acao = () => onRemover(s, c.id);
    if (confirmAction) confirmAction('Remover candidato', `Remover ${c.nome} da seleção de ${s.cargo} (${s.data})?`, acao);
    else acao();
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden" aria-label="Candidatos">
      {linhas.length === 0 ? (
        <p className="text-sm font-medium text-slate-500 text-center py-12">
          Nenhum candidato com esses filtros{editavel ? ' — adicione abaixo, escolhendo a seleção do dia.' : '.'}
        </p>
      ) : (
        <div ref={rolagem} className="overflow-auto max-h-[68vh]">
          <table className="w-full min-w-[1180px] text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-200">
                <th scope="col" className={th}>Data</th>
                <th scope="col" className={`${th} min-w-[200px]`}>Nome</th>
                <th scope="col" className={th}>Cargo</th>
                <th scope="col" className={th}>Sede</th>
                {!soPedagogico && <th scope="col" className={th}>Setor</th>}
                <th scope="col" className={th}>Gestor</th>
                <th scope="col" className={th}>RH</th>
                <th scope="col" className={`${th} w-40`}>{soPedagogico ? 'Teste' : 'Teste / entrevista'}</th>
                {!soPedagogico && <th scope="col" className={`${th} w-32`}>Contratado</th>}
                <th scope="col" className={`${th} min-w-[260px]`}>{soPedagogico ? 'Observações' : 'Motivo da desistência / observações'}</th>
                {onRemover && <th scope="col" className={`${th} w-8`}><span className="sr-only">Remover</span></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linhas.map(({ c, s }) => (
                <tr key={c.id} className={c.resultado === 'convocado' ? 'bg-amber-50/40' : ''}>
                  <td className={`${td} px-2.5 py-0.5 tabular-nums text-slate-600 whitespace-nowrap`}>{s.data}</td>
                  <td className={`${td} px-1 py-0.5`}>
                    {editavel ? (
                      <input aria-label={`Nome (${c.nome})`} className={`${celula} font-semibold`} defaultValue={c.nome} maxLength={150}
                        onBlur={e => { const v = e.target.value.replace(/\s+/g, ' ').trim(); if (v && v !== c.nome) salvar(s, c, { nome: v }); }} />
                    ) : <span className="px-2 font-semibold text-slate-800">{c.nome}</span>}
                  </td>
                  <td className={`${td} px-2.5 py-0.5 text-slate-700 whitespace-nowrap max-w-[220px] truncate`} title={s.cargo}>{s.cargo}</td>
                  <td className={`${td} px-2.5 py-0.5 text-slate-700 whitespace-nowrap`}>{siglaDaSede(sedes, s.sede) || '—'}</td>
                  {!soPedagogico && <td className={`${td} px-2.5 py-0.5 text-slate-700`}>{s.setor || '—'}</td>}
                  <td className={`${td} px-2.5 py-0.5 text-slate-700`}>{s.gestor || '—'}</td>
                  <td className={`${td} px-2.5 py-0.5 text-slate-700`}>{s.responsavel || '—'}</td>
                  <td className={`${td} px-1 py-0.5`}>
                    <select aria-label={`Resultado de ${c.nome}`} disabled={!editavel} className={celula} value={c.resultado}
                      onChange={e => salvar(s, c, { resultado: e.target.value as ResultadoCandidato })}>
                      {RESULTADOS.map(r => <option key={r.id} value={r.id}>{r.id === 'convocado' ? '—' : r.rotulo}</option>)}
                    </select>
                  </td>
                  {!soPedagogico && (
                    <td className={`${td} px-1 py-0.5`}>
                      <select aria-label={`Contratado: ${c.nome}`} disabled={!editavel} className={celula} value={c.contratado || ''}
                        onChange={e => salvar(s, c, { contratado: e.target.value as Contratacao })}>
                        {CONTRATACOES.map(o => <option key={o.id} value={o.id}>{o.id === 'sim' ? 'Sim' : o.rotulo}</option>)}
                      </select>
                    </td>
                  )}
                  <td className={`${td} px-1 py-0.5`}>
                    <div className="flex gap-1">
                      {c.resultado === 'desistiu' && (
                        <select aria-label={`Motivo da desistência de ${c.nome}`} disabled={!editavel} className={`${celula} max-w-[190px]`} value={c.motivo || ''}
                          onChange={e => salvar(s, c, { motivo: e.target.value })}>
                          <option value="">Motivo…</option>
                          {MOTIVOS_DESISTENCIA.map(m => <option key={m} value={m}>{m}</option>)}
                          {c.motivo && !MOTIVOS_DESISTENCIA.includes(c.motivo) && <option value={c.motivo}>{c.motivo}</option>}
                        </select>
                      )}
                      <input aria-label={`Observação sobre ${c.nome}`} disabled={!editavel} className={celula} defaultValue={c.observacao || ''} maxLength={300}
                        onBlur={e => { const v = e.target.value.trim(); if (v !== (c.observacao || '')) salvar(s, c, { observacao: v }); }} />
                    </div>
                  </td>
                  {onRemover && (
                    <td className={`${td} px-1 py-0.5`}>
                      <button onClick={() => remover(s, c)} aria-label={`Remover ${c.nome}`}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {onRegistrar && (
        <div className="border-t border-slate-200 bg-slate-50 p-4">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,320px)_1fr_auto] gap-3 items-start">
            <label className="block">
              <span className="block text-[11px] font-semibold text-slate-600 mb-1">Seleção do dia</span>
              <select className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white font-medium text-slate-800 outline-none focus:border-slate-800"
                value={selId} onChange={e => setSelId(e.target.value)}>
                <option value="">Escolha a seleção…</option>
                {opcoesSelecao.map(s => (
                  <option key={s.id} value={s.id}>{s.data} · {s.cargo} · {siglaDaSede(sedes, s.sede) || 'sem sede'}</option>
                ))}
              </select>
              {onNovaSelecao && (
                <button type="button" onClick={onNovaSelecao} className="mt-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline underline-offset-2 cursor-pointer">
                  A seleção ainda não existe? Crie antes
                </button>
              )}
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold text-slate-600 mb-1">Nomes</span>
              <textarea rows={2} value={texto} onChange={e => setTexto(e.target.value)}
                placeholder="Um nome por linha — dá para colar a coluna NOME inteira da convocação"
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg outline-none bg-white font-medium focus:border-slate-800 resize-y" />
            </label>
            <button onClick={adicionar} disabled={adicionando || !selId || !nomes.length}
              className="lg:mt-[22px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold disabled:opacity-40 cursor-pointer disabled:cursor-default">
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              {adicionando ? 'Adicionando…' : nomes.length > 1 ? `Adicionar ${nomes.length}` : 'Adicionar'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
