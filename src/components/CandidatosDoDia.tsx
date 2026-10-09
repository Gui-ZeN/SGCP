/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Candidatos de UM dia de seleção — as abas nominais da planilha ("GERAL
 * 2026", "PEDAGÓGICO 2026") dentro do sistema. Os números do dia saem desta
 * lista (ver `numerosDoDia`): lançar aqui É confirmar a presença.
 */
import React, { useMemo, useState } from 'react';
import type { Candidato, Selecao } from '../types';
import {
  RESULTADOS, CONTRATACOES, MOTIVOS_DESISTENCIA, numerosDoDia,
  type ResultadoCandidato, type Contratacao,
} from '../utils/candidatos';
import { X, Trash2, UserPlus } from 'lucide-react';
import { ListaDeNomes, nomesPreenchidos } from './ui/ListaDeNomes';

export type Dados = Pick<Candidato, 'nome' | 'resultado' | 'contratado' | 'motivo' | 'observacao'>;

interface Props {
  selecao: Selecao;
  candidatos: Candidato[];
  onSalvar: (dados: Dados, id: string) => Promise<void>;
  onRegistrar: (nomes: string[]) => Promise<void>;
  onRemover: (id: string) => Promise<void>;
  onFechar: () => void;
  confirmAction?: (titulo: string, mensagem: string, onConfirm: () => void | Promise<void>) => void;
}

const campo = 'w-full min-w-0 text-xs px-2 py-1.5 border border-slate-200 rounded-lg bg-white font-medium text-slate-800 outline-none focus:border-slate-800';

/**
 * O candidato inteiro com um campo trocado — é o que se grava. Campos
 * opcionais vão como '' e não undefined: undefined some da gravação e o valor
 * antigo fica. Motivo só existe para quem desistiu.
 */
export function comMudanca(c: Candidato, mudanca: Partial<Dados>): Dados {
  const d: Dados = {
    nome: c.nome, resultado: c.resultado, contratado: c.contratado || '',
    motivo: c.motivo || '', observacao: c.observacao || '', ...mudanca,
  };
  if (d.resultado !== 'desistiu') d.motivo = '';
  return d;
}

export const CandidatosDoDia: React.FC<Props> = ({ selecao, candidatos, onSalvar, onRegistrar, onRemover, onFechar, confirmAction }) => {
  const [lista, setLista] = useState<string[]>(['']);
  const [registrando, setRegistrando] = useState(false);
  const nomes = nomesPreenchidos(lista);
  const n = useMemo(() => numerosDoDia(candidatos), [candidatos]);
  const pendentes = candidatos.filter(c => c.resultado === 'convocado').length;

  const salvar = (c: Candidato, mudanca: Partial<Dados>) => onSalvar(comMudanca(c, mudanca), c.id);

  const registrar = async () => {
    if (!nomes.length) return;
    setRegistrando(true);
    try {
      await onRegistrar(nomes);
      setLista(['']);
    } finally {
      setRegistrando(false);
    }
  };

  const remover = (c: Candidato) => {
    const acao = () => onRemover(c.id);
    if (confirmAction) confirmAction('Remover candidato', `Remover ${c.nome} desta seleção?${selecao.numerosPelaLista ? ' Os números do dia são recalculados.' : ''}`, acao);
    else acao();
  };

  return (
    <section aria-labelledby="cand-titulo" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="cand-titulo" className="text-sm font-bold text-slate-900">
            Candidatos · {selecao.cargo}
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {[selecao.sede, selecao.data, selecao.origem === 'pedagogico' ? 'Pedagógico' : 'Geral'].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button onClick={onFechar} aria-label="Fechar candidatos"
          className="w-8 h-8 shrink-0 rounded-full border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-500 cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {candidatos.length === 0 && selecao.convocados > 0 && (
        <p className="mt-3 text-[12.5px] font-semibold text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
          Este dia tem {selecao.convocados} convocado(s) lançado(s) sem nome. Ao registrar candidatos, os números do dia
          passam a ser calculados pela lista — registre todos os que foram chamados.
        </p>
      )}

      {candidatos.length > 0 && !selecao.numerosPelaLista && (
        <p className="mt-3 text-[12.5px] font-semibold text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
          Nomes importados da planilha, para consulta. Os números deste dia continuam os da QUANTI
          ({selecao.convocados} convocados, {selecao.compareceram} compareceram) — corrigir um candidato aqui não os altera.
        </p>
      )}

      {candidatos.length > 0 && selecao.numerosPelaLista && (
        <p className="mt-3 text-xs font-semibold text-slate-700" role="status">
          {n.convocados} convocado(s) · {n.compareceram} compareceram · {n.ausentes} ausente(s) · {n.desistiram} desistiram · {n.contratados} contratado(s)
          {pendentes > 0 && (
            <span className="block text-[12.5px] font-semibold text-amber-700 mt-0.5">
              {pendentes} sem resultado — o dia só entra nos números quando todos tiverem resultado.
            </span>
          )}
        </p>
      )}

      {candidatos.length > 0 && (
        // Sem rolagem de lado (regra de 08/10/2026): em tela estreita, cartão.
        <div className="mt-3">
          <table className="w-full text-xs tabela-empilha">
            <thead>
              <tr className="text-left text-[12px] font-bold text-slate-500 border-b border-slate-200">
                <th scope="col" className="py-2 pr-2 font-bold">Nome</th>
                <th scope="col" className="py-2 px-2 font-bold w-44">Resultado</th>
                <th scope="col" className="py-2 px-2 font-bold w-48">Desistência</th>
                <th scope="col" className="py-2 px-2 font-bold w-36">Contratação</th>
                <th scope="col" className="py-2 px-2 font-bold">Observação</th>
                <th scope="col" className="py-2 pl-2 w-8"><span className="sr-only">Remover</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidatos.map(c => (
                <tr key={c.id} className={c.resultado === 'convocado' ? 'bg-amber-50/40' : ''}>
                  <td className="py-1.5 pr-2 font-semibold text-slate-800">{c.nome}</td>
                  <td className="py-1.5 px-2" data-rotulo="Resultado">
                    <select aria-label={`Resultado de ${c.nome}`} className={campo} value={c.resultado}
                      onChange={e => salvar(c, { resultado: e.target.value as ResultadoCandidato })}>
                      {RESULTADOS.map(r => <option key={r.id} value={r.id}>{r.rotulo}</option>)}
                    </select>
                  </td>
                  <td className="py-1.5 px-2" data-rotulo="Desistência">
                    {c.resultado === 'desistiu' ? (
                      <select aria-label={`Motivo da desistência de ${c.nome}`} className={campo} value={c.motivo || ''}
                        onChange={e => salvar(c, { motivo: e.target.value })}>
                        <option value="">Sem motivo informado</option>
                        {MOTIVOS_DESISTENCIA.map(m => <option key={m} value={m}>{m}</option>)}
                        {/* Motivo antigo fora da lista continua visível, não some. */}
                        {c.motivo && !MOTIVOS_DESISTENCIA.includes(c.motivo) && <option value={c.motivo}>{c.motivo}</option>}
                      </select>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="py-1.5 px-2" data-rotulo="Contratação">
                    <select aria-label={`Contratação de ${c.nome}`} className={campo} value={c.contratado || ''}
                      onChange={e => salvar(c, { contratado: e.target.value as Contratacao })}>
                      {CONTRATACOES.map(o => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
                    </select>
                  </td>
                  <td className="py-1.5 px-2" data-rotulo="Observação">
                    <input aria-label={`Observação sobre ${c.nome}`} className={campo} defaultValue={c.observacao || ''} maxLength={300}
                      onBlur={e => { if (e.target.value.trim() !== (c.observacao || '')) salvar(c, { observacao: e.target.value.trim() }); }} />
                  </td>
                  <td className="py-1.5 pl-2">
                    <button onClick={() => remover(c)} aria-label={`Remover ${c.nome}`}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-slate-100">
        <span className="block text-[13px] font-semibold mb-1.5" style={{ color: 'var(--tinta)' }}>Adicionar candidatos</span>
        <ListaDeNomes nomes={lista} onChange={setLista} />
        <div className="flex items-center justify-between gap-3 mt-2">
          <p className="text-[12px] text-slate-500 font-medium">Entram como "Convocado"; o resultado é lançado depois, na lista.</p>
          <button onClick={registrar} disabled={registrando || !nomes.length}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white text-[12.5px] font-bold hover:bg-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-default">
            <UserPlus className="w-3.5 h-3.5" />
            {registrando ? 'Adicionando...' : nomes.length > 1 ? `Adicionar ${nomes.length}` : 'Adicionar'}
          </button>
        </div>
      </div>
    </section>
  );
};
