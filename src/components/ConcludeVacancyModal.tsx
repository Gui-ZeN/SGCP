import React, { useState, useEffect } from 'react';
import { Vaga } from '../types';
import { Check } from 'lucide-react';
import { Modal } from './ui/Modal';

interface ConcludeVacancyModalProps {
  vaga: Vaga;
  /** Quem está na documentação desta vaga: o nome já vem preenchido. */
  sugestao?: string;
  onClose: () => void;
  onConclude: (
    vagaId: string,
    candidato: string,
    dataConclusao: string,
    dataAdmissao: string,
    observacoes: string,
    adicionarNaExperiencia: boolean
  ) => Promise<void>;
}

const rotulo = 'block text-[13px] font-semibold mb-1';

export const ConcludeVacancyModal: React.FC<ConcludeVacancyModalProps> = ({ vaga, sugestao, onClose, onConclude }) => {
  const [concludeCandName, setConcludeCandName] = useState(sugestao || '');
  const [concludeDate, setConcludeDate] = useState('');
  const [concludeAdmissaoDate, setConcludeAdmissaoDate] = useState('');
  const [addToExperiencia, setAddToExperiencia] = useState(true);
  const [concludeNotes, setConcludeNotes] = useState('');
  const [concludeError, setConcludeError] = useState('');

  // Initialize dates
  useEffect(() => {
    const today = new Date();
    const defaultDate = today.toISOString().split('T')[0];
    setConcludeDate(defaultDate);
    setConcludeAdmissaoDate(defaultDate);
    setConcludeNotes(vaga.observacoes || '');
  }, [vaga]);

  const handleSave = async () => {
    setConcludeError('');
    if (!concludeCandName.trim()) {
      setConcludeError("Por favor, preencha o nome do candidato aprovado.");
      return;
    }

    try {
      await onConclude(
        vaga.id,
        concludeCandName,
        concludeDate,
        concludeAdmissaoDate,
        concludeNotes,
        addToExperiencia
      );
      onClose();
    } catch (err: any) {
      setConcludeError(err.message || 'Erro ao concluir vaga');
    }
  };

  return (
    <Modal
      largura="sm"
      aoFechar={onClose}
      antes={<span>Vaga nº {vaga.codigo} · {vaga.sede}{vaga.setor ? ` · ${vaga.setor}` : ''}</span>}
      titulo={`Concluir: ${vaga.vaga}`}
      rodape={<>
        <button type="button" className="btn" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn btn-primario" onClick={handleSave}><Check />Concluir vaga</button>
      </>}
    >
      <div className="space-y-4">
        {concludeError && (
          <p role="alert" className="etiqueta etiqueta-atraso" style={{ fontSize: 13.5, padding: '6px 10px', whiteSpace: 'normal' }}>{concludeError}</p>
        )}
        <label className="block">
          <span className={rotulo}>Nome completo de quem foi aprovado</span>
          <input id="conclude-candidate" type="text" required autoFocus className="campo w-full" placeholder="Ex.: Ana de Souza Silva"
            value={concludeCandName} onChange={(e) => setConcludeCandName(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={rotulo}>Data de fechamento</span>
            <input id="conclude-date" type="date" required className="campo w-full" value={concludeDate} onChange={(e) => setConcludeDate(e.target.value)} />
          </label>
          <label className="block">
            <span className={rotulo}>Data de admissão</span>
            <input id="conclude-admissao" type="date" required className="campo w-full" value={concludeAdmissaoDate} onChange={(e) => setConcludeAdmissaoDate(e.target.value)} />
          </label>
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer text-[14px]">
          <input type="checkbox" className="w-4 h-4 shrink-0" style={{ accentColor: 'var(--tinta)' }}
            checked={addToExperiencia} onChange={(e) => setAddToExperiencia(e.target.checked)} />
          Abrir o acompanhamento de experiência (45/90 dias) para essa pessoa
        </label>
        <label className="block">
          <span className={rotulo}>Observações finais do RH</span>
          <textarea id="conclude-notes" rows={3} className="campo w-full" style={{ paddingTop: 8, paddingBottom: 8 }}
            placeholder="Ex.: Excelente perfil técnico. Início agendado para o dia 5."
            value={concludeNotes} onChange={(e) => setConcludeNotes(e.target.value)} />
        </label>
      </div>
    </Modal>
  );
};
