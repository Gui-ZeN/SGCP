import React from 'react';
import { dataISOLocal } from '../../utils/date';
import { Vaga } from '../../types';
import { MOTIVOS_DESISTENCIA } from '../../constants/hr';
import { Pause, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Modal } from '../ui/Modal';

/**
 * Modais do fluxo de vagas (extraídos do VacancyTable — Seção 5):
 * pausa com data, transição de etapa (funil/desistência) e confirmação de drag.
 * Apresentacionais: estado e handlers ficam no pai. Desde 08/10/2026 usam o
 * modal padrão (ui/Modal): no meio da tela, fecham no Esc e clicando fora.
 */

const rotulo = 'block text-[13px] font-semibold mb-1';
const nota = 'text-[13px] mt-2 leading-relaxed';

/* ── Modal: confirmar a data da pausa (congela o SLA a partir dela) ── */
export const PauseVagaModal: React.FC<{
  vaga: Vaga;
  dateISO: string;
  onDateChange: (iso: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ vaga, dateISO, onDateChange, onCancel, onConfirm }) => (
  <Modal
    largura="sm"
    aoFechar={onCancel}
    antes={<span>Vaga nº {vaga.codigo}</span>}
    titulo={`Pausar: ${vaga.vaga}`}
    rodape={<>
      <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
      <button type="button" className="btn btn-primario" onClick={onConfirm}><Pause />Pausar</button>
    </>}
  >
    <label className="block">
      <span className={rotulo}>Pausada desde</span>
      <input id="pause-date" type="date" max={dataISOLocal()} value={dateISO} onChange={(e) => onDateChange(e.target.value)} className="campo w-full" />
    </label>
    <p className={nota} style={{ color: 'var(--tinta-3)' }}>A partir desta data o prazo para de contar. Ajuste se a vaga foi pausada num dia anterior.</p>
  </Modal>
);

/* ── Modal de transição de etapa: avanço pede o funil; retorno pede o motivo ── */
export interface EtapaMoveInfo { vaga: Vaga; novaEtapa: string; tipo: 'funil' | 'desistencia'; }

export const EtapaMoveModal: React.FC<{
  move: EtapaMoveInfo;
  chamados: number; compareceram: number; aprovados: number; motivo: string;
  onChamados: (n: number) => void; onCompareceram: (n: number) => void; onAprovados: (n: number) => void; onMotivo: (m: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  /** Números já registrados nas seleções desta vaga — sugestão, não imposição. */
  selecao?: { selecoes: number; chamados: number; compareceram: number; aprovados: number; ultimaData: string } | null;
  onUsarSelecao?: () => void;
  /** Funil vem das seleções ligadas: só leitura. */
  automatico?: boolean;
}> = ({ move, chamados, compareceram, aprovados, motivo, onChamados, onCompareceram, onAprovados, onMotivo, onCancel, onConfirm, selecao, onUsarSelecao, automatico }) => (
  <Modal
    largura="sm"
    aoFechar={onCancel}
    antes={<span>Vaga nº {move.vaga.codigo} · {move.vaga.vaga}</span>}
    titulo={move.tipo === 'desistencia' ? `Voltar para ${move.novaEtapa}` : `Mover para ${move.novaEtapa}`}
    rodape={<>
      <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
      {move.tipo === 'desistencia'
        ? <button type="button" className="btn btn-primario" onClick={onConfirm}><ChevronLeft />Voltar a vaga de etapa</button>
        : <button type="button" className="btn btn-primario" onClick={onConfirm}>Mover<ChevronRight /></button>}
    </>}
  >
    {move.tipo === 'funil' ? (
      <div>
        <p className="text-[15px] font-bold mb-2">Funil de candidatos</p>
        {selecao && (
          /* Não grava nada sozinho: diz de onde vieram os números e deixa
             aplicar num clique quando o RH já tinha digitado outra coisa. */
          <div className="painel mb-3 px-3 py-2.5 text-[13px]" style={{ background: '#FAFAFB' }}>
            <p className="font-semibold">
              {selecao.selecoes === 1 ? '1 seleção registrada' : `${selecao.selecoes} seleções registradas`} nesta vaga
              {selecao.ultimaData && ` · última em ${selecao.ultimaData}`}
            </p>
            <p className="mt-0.5 tabular-nums" style={{ color: 'var(--tinta-2)' }}>
              {selecao.chamados} chamados · {selecao.compareceram} compareceram · {selecao.aprovados} aprovados
            </p>
            {(chamados !== selecao.chamados || compareceram !== selecao.compareceram || aprovados !== selecao.aprovados) && onUsarSelecao && (
              <button type="button" onClick={onUsarSelecao} className="atalho mt-1.5">Usar estes números</button>
            )}
          </div>
        )}
        {automatico && (
          <p className="mb-3 text-[13px]" style={{ color: 'var(--tinta-2)' }}>Somado das seleções ligadas a esta vaga: atualiza sozinho, na tela de Seleções.</p>
        )}
        <fieldset disabled={automatico} className="grid grid-cols-3 gap-3 disabled:opacity-80">
          <label className="block">
            <span className={rotulo}>Chamados</span>
            <input id="move-chamados" type="number" min={0} value={chamados} onChange={(e) => onChamados(Number(e.target.value))} className="campo w-full" />
          </label>
          <label className="block">
            <span className={rotulo}>Compareceram</span>
            <input id="move-compareceram" type="number" min={0} value={compareceram} onChange={(e) => onCompareceram(Number(e.target.value))} className="campo w-full" />
          </label>
          <label className="block">
            <span className={rotulo}>Aprovados</span>
            <input id="move-aprovados" type="number" min={0} value={aprovados} onChange={(e) => onAprovados(Number(e.target.value))} className="campo w-full" />
          </label>
        </fieldset>
      </div>
    ) : (
      <label className="block">
        <span className={rotulo}>Por que a vaga voltou de etapa?</span>
        <select id="move-motivo" value={motivo} onChange={(e) => onMotivo(e.target.value)} className="campo w-full">
          <option value="">Não se aplica</option>
          {MOTIVOS_DESISTENCIA.map((m, i) => (<option key={i} value={m}>{m}</option>))}
        </select>
        <p className={nota} style={{ color: 'var(--tinta-3)' }}>Use quando um candidato desistiu ou caiu e o processo precisou voltar.</p>
      </label>
    )}
  </Modal>
);

/* ── Modal de confirmação do drag no Kanban (evita movimentações acidentais) ── */
export interface DragMoveInfo { vagaId: string; laneId: string; vagaCodigo: string | number; vagaTitle: string; oldLaneTitle: string; newLaneTitle: string; }

export const DragMoveConfirmModal: React.FC<{
  info: DragMoveInfo;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ info, onCancel, onConfirm }) => (
  <Modal
    largura="sm"
    aoFechar={onCancel}
    antes={<span>Vaga nº {info.vagaCodigo} · {info.vagaTitle}</span>}
    titulo="Mudar a vaga de coluna?"
    rodape={<>
      <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
      <button type="button" className="btn btn-primario" onClick={onConfirm}><Check />Mudar de coluna</button>
    </>}
  >
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
      <div className="painel px-3 py-3">
        <p className="text-[12.5px]" style={{ color: 'var(--tinta-3)' }}>De</p>
        <p className="text-[14px] font-semibold">{info.oldLaneTitle}</p>
      </div>
      <ChevronRight className="w-5 h-5" style={{ color: 'var(--tinta-3)' }} aria-hidden="true" />
      <div className="painel px-3 py-3" style={{ borderColor: 'var(--tinta)' }}>
        <p className="text-[12.5px]" style={{ color: 'var(--tinta-3)' }}>Para</p>
        <p className="text-[14px] font-bold">{info.newLaneTitle}</p>
      </div>
    </div>
  </Modal>
);
