import React, { useState, useEffect } from 'react';
import { Vaga, Experiencia } from '../types';
import { CheckCircle2, X, Building, User, Calendar, Check } from 'lucide-react';

interface ConcludeVacancyModalProps {
  vaga: Vaga;
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

export const ConcludeVacancyModal: React.FC<ConcludeVacancyModalProps> = ({ vaga, onClose, onConclude }) => {
  const [concludeCandName, setConcludeCandName] = useState('');
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        {/* Header */}
        <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Concluir Processo Seletivo</h3>
              <p className="text-[11px] text-slate-500 font-semibold">Preencha os dados finais do contratado</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white border border-slate-205 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {concludeError && (
            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-semibold border border-red-100 flex items-center gap-2">
              <span className="w-5 h-5 flex items-center justify-center bg-red-100 rounded-full text-red-700 font-bold shrink-0">!</span>
              {concludeError}
            </div>
          )}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-800 leading-tight">{vaga.vaga}</h4>
              <p className="text-[9px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">{vaga.sede} • {vaga.setor}</p>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="conclude-candidate" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Nome Completo do Aprovado</label>
            <div className="relative">
              <input
                id="conclude-candidate"
                type="text"
                required
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none rounded-xl"
                placeholder="Ex: Ana de Souza Silva"
                value={concludeCandName}
                onChange={(e) => setConcludeCandName(e.target.value)}
              />
              <User className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="conclude-date" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Data Fechamento</label>
              <div className="relative">
                <input
                  id="conclude-date"
                  type="date"
                  required
                  className="w-full pl-8 pr-2 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none rounded-xl cursor-pointer"
                  value={concludeDate}
                  onChange={(e) => setConcludeDate(e.target.value)}
                />
                <Calendar className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="conclude-admissao" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Data Admissão</label>
              <div className="relative">
                <input
                  id="conclude-admissao"
                  type="date"
                  required
                  className="w-full pl-8 pr-2 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none rounded-xl cursor-pointer"
                  value={concludeAdmissaoDate}
                  onChange={(e) => setConcludeAdmissaoDate(e.target.value)}
                />
                <Calendar className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2.5 mt-2 cursor-pointer p-2.5 bg-slate-50/50 rounded-xl border border-slate-100 hover:bg-slate-50 transition border-dashed">
            <input
              type="checkbox"
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
              checked={addToExperiencia}
              onChange={(e) => setAddToExperiencia(e.target.checked)}
            />
            <span className="text-xs font-semibold text-slate-700">
              Adicionar ao <span className="text-emerald-700">Acompanhamento de Experiência</span>
            </span>
          </label>

          <div className="space-y-1">
            <label htmlFor="conclude-notes" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Observações Finais do RH / Feedback</label>
            <textarea
              id="conclude-notes"
              rows={2}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none rounded-xl"
              placeholder="Ex: Excelente perfil técnico. Início agendado para o próximo dia 5."
              value={concludeNotes}
              onChange={(e) => setConcludeNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold rounded-xl text-slate-650 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-xs font-bold rounded-xl text-white shadow-md shadow-emerald-600/10 transition cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-4 h-4 text-white" />
            <span>Salvar &amp; Concluir</span>
          </button>
        </div>
      </div>
    </div>
  );
};
