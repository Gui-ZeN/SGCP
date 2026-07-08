import React, { useMemo } from 'react';
import { CalendarDays, Loader2, WifiOff } from 'lucide-react';
import { useCalendario } from '../hooks/useCalendario';
import { corDaData, rotuloTipo, diasAteData, rotuloRelativo, dataCurtaBR } from '../utils/calendario';

/**
 * Widget "Próximas datas" no Início — consome a API de Calendários (read-only).
 * Some silenciosamente se a API não estiver configurada (VITE_CALENDARIO_API_URL).
 */
export const ProximasDatasCard: React.FC<{ dias?: number; limite?: number }> = ({ dias = 45, limite = 6 }) => {
  const { datas, loading, erro, configurada } = useCalendario(dias);

  // Ordena por data e corta no limite (a API já filtra por janela/região).
  const lista = useMemo(
    () => [...datas].sort((a, b) => a.data.localeCompare(b.data)).slice(0, limite),
    [datas, limite]
  );

  if (!configurada) return null; // não polui o Início enquanto a API não é ligada

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
          <CalendarDays className="w-4.5 h-4.5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800 leading-tight">Próximas datas</h3>
          <p className="text-[11px] text-slate-500 font-medium">Feriados, comemorativas e dias de profissão · CE/Fortaleza</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
        </div>
      ) : erro ? (
        <div className="flex items-center gap-2 text-amber-600 text-[12px] font-semibold py-6 justify-center">
          <WifiOff className="w-4 h-4" /> Calendário indisponível no momento.
        </div>
      ) : lista.length === 0 ? (
        <p className="text-center text-slate-400 text-sm font-semibold py-6">Nenhuma data nos próximos {dias} dias.</p>
      ) : (
        <ul className="space-y-2.5">
          {lista.map(d => {
            const dias = diasAteData(d.data);
            return (
              <li key={`${d.id}-${d.data}`} className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: corDaData(d.tipo, d.cor_sugerida) }} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-800 truncate leading-tight">{d.nome}</div>
                  <div className="text-[11px] text-slate-500 font-semibold">{dataCurtaBR(d.data)} · {rotuloTipo(d.tipo)}</div>
                </div>
                {dias !== null && (
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0 ${dias <= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                    {rotuloRelativo(dias)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
