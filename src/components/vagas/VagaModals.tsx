import React from 'react';
import { Vaga } from '../../types';
import { MOTIVOS_DESISTENCIA } from '../../constants/hr';
import { Pause, AlertTriangle, Workflow, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';

/**
 * Modais do fluxo de vagas (extraídos do VacancyTable — Seção 5):
 * pausa com data, transição de etapa (funil/desistência) e confirmação de drag.
 * Apresentacionais: estado e handlers ficam no pai.
 */

/* ── Modal: confirmar a data da pausa (congela o SLA a partir dela) ── */
export const PauseVagaModal: React.FC<{
  vaga: Vaga;
  dateISO: string;
  onDateChange: (iso: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ vaga, dateISO, onDateChange, onCancel, onConfirm }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
      <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
        <div className="w-10 h-10 bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center">
          <Pause className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-800">Pausar vaga</h3>
          <p className="text-[11px] text-slate-500 font-semibold truncate">#{vaga.codigo} · {vaga.vaga}</p>
        </div>
      </div>
      <div className="p-6 space-y-2">
        <label htmlFor="pause-date" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Pausada desde</label>
        <input
          id="pause-date"
          type="date"
          max={new Date().toISOString().slice(0, 10)}
          value={dateISO}
          onChange={(e) => onDateChange(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-slate-500/10 focus:border-slate-500 focus:outline-none rounded-xl cursor-pointer"
        />
        <p className="text-[11px] text-slate-400 font-medium leading-relaxed">A partir desta data o SLA fica congelado. Ajuste se a vaga foi pausada num dia anterior.</p>
      </div>
      <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold rounded-xl text-slate-650 transition cursor-pointer">
          Cancelar
        </button>
        <button type="button" onClick={onConfirm} className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-bold rounded-xl text-white shadow-md transition cursor-pointer flex items-center gap-1.5">
          <Pause className="w-4 h-4" /> Pausar
        </button>
      </div>
    </div>
  </div>
);

/* ── Modal de transição de etapa: avanço pede o funil; retorno pede o motivo ── */
export interface EtapaMoveInfo { vaga: Vaga; novaEtapa: string; tipo: 'funil' | 'desistencia'; }

export const EtapaMoveModal: React.FC<{
  move: EtapaMoveInfo;
  chamados: number; compareceram: number; aprovados: number; motivo: string;
  onChamados: (n: number) => void; onCompareceram: (n: number) => void; onAprovados: (n: number) => void; onMotivo: (m: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ move, chamados, compareceram, aprovados, motivo, onChamados, onCompareceram, onAprovados, onMotivo, onCancel, onConfirm }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
      <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${move.tipo === 'desistencia' ? 'bg-rose-100 text-rose-600' : 'bg-orange-100 text-orange-600'}`}>
          {move.tipo === 'desistencia' ? <AlertTriangle className="w-5 h-5" /> : <Workflow className="w-5 h-5" />}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-800">
            {move.tipo === 'desistencia' ? `Voltar para "${move.novaEtapa}"` : `Mover para "${move.novaEtapa}"`}
          </h3>
          <p className="text-[11px] text-slate-500 font-semibold truncate">#{move.vaga.codigo} · {move.vaga.vaga}</p>
        </div>
      </div>
      <div className="p-6 space-y-4">
        {move.tipo === 'funil' ? (
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Funil de candidatos</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="move-chamados" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Chamados</label>
                <input id="move-chamados" type="number" min={0} value={chamados} onChange={(e) => onChamados(Number(e.target.value))} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl" />
              </div>
              <div>
                <label htmlFor="move-compareceram" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Compareceram</label>
                <input id="move-compareceram" type="number" min={0} value={compareceram} onChange={(e) => onCompareceram(Number(e.target.value))} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl" />
              </div>
              <div>
                <label htmlFor="move-aprovados" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Aprovados</label>
                <input id="move-aprovados" type="number" min={0} value={aprovados} onChange={(e) => onAprovados(Number(e.target.value))} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl" />
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label htmlFor="move-motivo" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Por que a vaga voltou de etapa?</label>
            <select id="move-motivo" value={motivo} onChange={(e) => onMotivo(e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:outline-none rounded-xl cursor-pointer">
              <option value="">— Não se aplica —</option>
              {MOTIVOS_DESISTENCIA.map((m, i) => (<option key={i} value={m}>{m}</option>))}
            </select>
            <p className="text-[11px] text-slate-400 font-medium mt-2 leading-relaxed">Use quando um candidato desistiu/caiu e o processo precisou retroceder.</p>
          </div>
        )}
      </div>
      <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold rounded-xl text-slate-650 transition cursor-pointer">Cancelar</button>
        {move.tipo === 'desistencia' ? (
          <button type="button" onClick={onConfirm} className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-xs font-bold rounded-xl text-white shadow-md transition cursor-pointer flex items-center gap-1.5">
            <ChevronLeft className="w-4 h-4" /> Voltar etapa
          </button>
        ) : (
          <button type="button" onClick={onConfirm} className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-xs font-bold rounded-xl text-white shadow-md transition cursor-pointer flex items-center gap-1.5">
            <ChevronRight className="w-4 h-4" /> Mover
          </button>
        )}
      </div>
    </div>
  </div>
);

/* ── Modal de confirmação do drag no Kanban (evita movimentações acidentais) ── */
export interface DragMoveInfo { vagaId: string; laneId: string; vagaCodigo: string | number; vagaTitle: string; oldLaneTitle: string; newLaneTitle: string; }

export const DragMoveConfirmModal: React.FC<{
  info: DragMoveInfo;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ info, onCancel, onConfirm }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
      {/* Header */}
      <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
            <Workflow className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Confirmar Mudança de Fase</h3>
            <p className="text-[11px] text-slate-500 font-semibold">Evite movimentações acidentais</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          aria-label="Fechar confirmação"
          className="w-7 h-7 rounded-full bg-white border border-slate-205 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content Body */}
      <div className="p-6 space-y-5">
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col gap-1.5 text-center">
          <span className="text-[10px] font-mono text-slate-400 font-bold tracking-widest">VAGA #{info.vagaCodigo}</span>
          <span className="text-xs font-extrabold text-slate-800 leading-tight">{info.vagaTitle}</span>
        </div>

        <div className="space-y-2">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center">Transição do Processo</span>

          <div className="grid grid-cols-7 items-center gap-2 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
            <div className="col-span-3 text-center p-2.5 bg-white border border-slate-200/80 rounded-xl flex flex-col justify-center items-center gap-1 min-h-[64px]">
              <span className="text-[9px] text-slate-400 uppercase font-bold">Origem</span>
              <span className="text-xs font-bold text-slate-600 line-clamp-2 leading-tight">{info.oldLaneTitle}</span>
            </div>

            <div className="col-span-1 flex flex-col items-center justify-center text-slate-350">
              <ChevronRight className="w-5 h-5 text-orange-500" />
            </div>

            <div className="col-span-3 text-center p-2.5 bg-orange-50/30 border border-orange-200 rounded-xl flex flex-col justify-center items-center gap-1 min-h-[64px]">
              <span className="text-[9px] text-orange-600 uppercase font-bold">Destino</span>
              <span className="text-xs font-extrabold text-orange-700 line-clamp-2 leading-tight">{info.newLaneTitle}</span>
            </div>
          </div>
        </div>

        <p className="text-xs font-semibold text-slate-500 leading-relaxed text-center px-2">
          Tem certeza que deseja mover esta vaga para a coluna <span className="font-extrabold text-slate-700">{info.newLaneTitle}</span>?
        </p>
      </div>

      {/* Footer */}
      <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold rounded-xl text-slate-650 transition cursor-pointer">
          Cancelar
        </button>
        <button type="button" onClick={onConfirm} className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-xs font-bold rounded-xl text-white shadow-md shadow-orange-600/10 transition cursor-pointer flex items-center gap-1.5">
          <Check className="w-4 h-4 text-white" />
          <span>Confirmar Transição</span>
        </button>
      </div>
    </div>
  </div>
);
