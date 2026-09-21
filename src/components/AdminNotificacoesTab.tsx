import React, { useState } from 'react';
import { Mail, Plus, Trash2, Clock } from 'lucide-react';
import type { Notificacoes } from '../hooks/useAppConfig';

/**
 * Quem recebe o e-mail das Seleções do dia.
 *
 * A lista mora em `config/notificacoes` e é a ÚNICA fonte de destinatários: a
 * função de disparo ignora qualquer endereço que venha por requisição. É o que
 * impede o endpoint de virar relay do Gmail do Grupo — mesmo quem descobrisse a
 * URL só conseguiria mandar para a lista que está aqui.
 */
interface Props {
  notificacoes: Notificacoes;
  salvar: (n: Notificacoes) => Promise<void>;
}

const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const AdminNotificacoesTab: React.FC<Props> = ({ notificacoes, salvar }) => {
  const [novo, setNovo] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const lista = notificacoes.destinatariosSelecoes || [];
  const ultimo = notificacoes.ultimoDisparo;

  const aplicar = async (n: Notificacoes) => {
    setSalvando(true);
    setErro('');
    try { await salvar(n); }
    catch (e: any) { setErro(`Não foi possível salvar: ${e?.message || e}`); }
    finally { setSalvando(false); }
  };

  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = novo.trim().toLowerCase();
    if (!EMAIL_VALIDO.test(email)) return setErro('E-mail inválido.');
    if (lista.some(x => x.toLowerCase() === email)) return setErro('Este e-mail já está na lista.');
    setNovo('');
    await aplicar({ ...notificacoes, destinatariosSelecoes: [...lista, email] });
  };

  const remover = (email: string) =>
    aplicar({ ...notificacoes, destinatariosSelecoes: lista.filter(x => x !== email) });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 bg-slate-50/70 p-5 rounded-2xl border border-slate-100">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-2">
          <Mail className="w-4 h-4 text-slate-500" />
          Seleções do dia
        </h3>
        <p className="text-xs text-slate-600 font-medium mb-4">
          Resumo do que o RH fez no dia, por e-mail.
        </p>

        <div className="flex items-start gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 mb-3">
          <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-600 font-semibold leading-relaxed">
            Disparo automático às <strong>18h de Fortaleza</strong>.
            Dia sem seleção não gera e-mail.
          </p>
        </div>

        {/* O que a última execução fez. Sem isto, "não chegou e-mail" e "não
            havia seleção" são a mesma tela em branco. */}
        <div className={`rounded-xl border px-3 py-2.5 mb-4 ${
          !ultimo ? 'bg-slate-50 border-slate-200'
            : ultimo.enviado ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
        }`}>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Último disparo</p>
          {!ultimo ? (
            <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
              Nenhum registro ainda — o primeiro aparece aqui depois das 18h.
            </p>
          ) : (
            <>
              <p className={`text-xs font-bold mt-0.5 ${ultimo.enviado ? 'text-emerald-800' : 'text-amber-800'}`}>
                {ultimo.enviado
                  ? `Enviado para ${ultimo.destinatarios || 0} ${(ultimo.destinatarios || 0) === 1 ? 'pessoa' : 'pessoas'}`
                  : `Não enviado — ${ultimo.motivo || 'sem motivo registrado'}`}
              </p>
              <p className="text-[11px] font-semibold text-slate-600">
                {ultimo.dia ? `Resumo de ${ultimo.dia} · ` : ''}
                {ultimo.quando ? new Date(ultimo.quando).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' }) : ''}
              </p>
              {ultimo.enviado && ultimo.assunto && (
                <p className="text-[10px] text-slate-600 font-medium mt-1 truncate" title={ultimo.assunto}>
                  {ultimo.assunto}
                </p>
              )}
            </>
          )}
        </div>

        <form onSubmit={adicionar} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="notif-email" className="text-xs font-bold text-slate-500 uppercase">
              Adicionar destinatário
            </label>
            <input
              id="notif-email"
              type="email"
              value={novo}
              onChange={e => { setNovo(e.target.value); setErro(''); }}
              placeholder="nome@christus.com.br"
              className="w-full text-xs px-3.5 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 outline-none bg-white font-medium"
            />
          </div>
          <button
            type="submit"
            disabled={salvando || !novo.trim()}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </form>

        <label className="flex items-start gap-2.5 mt-4 cursor-pointer">
          <input
            type="checkbox"
            checked={notificacoes.selecoesAtivo !== false}
            onChange={e => aplicar({ ...notificacoes, selecoesAtivo: e.target.checked })}
            className="w-4 h-4 accent-slate-900 cursor-pointer mt-0.5"
          />
          <span className="text-[11px] font-semibold text-slate-700 leading-relaxed">
            Disparo ligado — desmarque para suspender sem apagar a lista.
          </span>
        </label>

        {erro && (
          <p role="alert" className="mt-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-3 py-2 text-[11px] font-semibold">
            {erro}
          </p>
        )}
      </div>

      <div className="md:col-span-2 space-y-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Destinatários ({lista.length})
        </h3>

        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white divide-y divide-slate-100">
          {lista.map(email => (
            <div key={email} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <span className="text-xs font-bold text-slate-700 truncate">{email}</span>
              <button
                onClick={() => remover(email)}
                disabled={salvando}
                aria-label={`Remover ${email}`}
                className="p-1 px-2.5 border border-slate-200 rounded-lg hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 transition text-[10px] uppercase tracking-wider font-bold text-slate-500 cursor-pointer shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                Remover
              </button>
            </div>
          ))}

          {lista.length === 0 && (
            <div className="px-5 py-8 text-center">
              <p className="text-xs font-bold text-slate-600">Nenhum destinatário.</p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                Sem ninguém na lista, o disparo das 18h não envia nada.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
