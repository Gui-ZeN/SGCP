import React from 'react';
import { Vaga } from '../../types';
import { SystemLog } from '../../hooks/useLogs';
import { getDiasEmAberto, getSlaInfo, isPausedOrSuspended } from '../../utils/vaga';
import { Workflow, X, History, UserCheck, FileText, CheckCircle2, Edit2, Trash2 } from 'lucide-react';

/**
 * Gaveta lateral de detalhes da vaga (extraída do VacancyTable — Seção 4).
 * Puramente apresentacional: recebe a vaga + callbacks; todo estado fica no pai.
 */
interface VagaDetailsDrawerProps {
  vaga: Vaga;
  logs?: SystemLog[];
  canManage: boolean;
  getSedeLabel: (nome: string) => string;
  renderStatusBadge: (status: Vaga['status']) => React.ReactNode;
  onClose: () => void;
  onConcluir: (vaga: Vaga) => void;
  onEditar: (vaga: Vaga) => void;
  onExcluir: (vaga: Vaga) => void;
}

export const VagaDetailsDrawer: React.FC<VagaDetailsDrawerProps> = ({
  vaga, logs, canManage, getSedeLabel, renderStatusBadge, onClose, onConcluir, onEditar, onExcluir
}) => {
  const sla = getSlaInfo(getDiasEmAberto(vaga), vaga.status === 'FECHADA', isPausedOrSuspended(vaga.status));

  return (
    <div className="fixed inset-0 z-[120] flex justify-end animate-fade-in">
      {/* Backdrop Overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
      ></div>

      {/* Drawer Panel */}
      <div className="w-full max-w-lg bg-white h-full relative shadow-2xl z-[130] flex flex-col justify-between animate-in slide-in-from-right duration-300 transform">

        {/* Header Area */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-100 rounded-2xl text-orange-600">
              <Workflow className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-mono text-xs font-bold">VAGA #{vaga.codigo}</span>
                {renderStatusBadge(vaga.status)}
              </div>
              <h3 className="text-base font-bold text-slate-800 leading-snug mt-0.5">{vaga.vaga}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar detalhes"
            className="w-8 h-8 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-850 cursor-pointer shadow-sm transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Attributes Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 scrollbar-thin">

          {/* Thermometer block of SLA */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
              <div className="flex items-center gap-1.5 text-slate-700">
                <History className="w-4 h-4 text-orange-500" />
                <span>Cronômetro de SLA</span>
              </div>
              <span className={`px-2 py-0.5 font-bold rounded-lg text-[9px] uppercase border font-sans ${sla.color}`}>
                {sla.label}
              </span>
            </div>

            <div className="space-y-1">
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div className={`h-full ${sla.progressBar}`} style={{ width: `${sla.percent}%` }}></div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Abertura: {vaga.solicitacao}</span>
                <span className="font-bold text-slate-800">{getDiasEmAberto(vaga)} dias decorridos</span>
                {vaga.conclusao && <span>Fechada: {vaga.conclusao}</span>}
              </div>
            </div>

            <p className="text-xs text-slate-500 font-medium italic">{sla.desc}</p>
          </div>

          {/* General details grid (Bento Section 1) */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Origem & Identidade</h4>
            <div className="grid grid-cols-2 gap-3 text-xs leading-relaxed">
              <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider mb-0.5">Sede Organizacional</span>
                <span className="text-slate-700 font-bold">{getSedeLabel(vaga.sede)}</span>
              </div>
              <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider mb-0.5">Setor / Departamento</span>
                <span className="text-slate-700 font-bold">{vaga.setor}</span>
              </div>
              <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider mb-0.5">Sexo Preferencial</span>
                <span className={`font-bold inline-flex ${vaga.sexo === 'FEMININO' ? 'text-pink-700' : vaga.sexo === 'MASCULINO' ? 'text-indigo-700' : 'text-slate-700'}`}>
                  {vaga.sexo || 'Indiferente'}
                </span>
              </div>
              <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider mb-0.5">Recruiter Responsável</span>
                <span className="text-slate-700 font-bold">{vaga.responsavel || 'Equipe RH'}</span>
              </div>
            </div>
          </div>

          {/* Requester details grid (Bento Section 2) */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Detalhes da Requisição</h4>
            <div className="grid grid-cols-2 gap-3 text-xs leading-relaxed">
              <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 col-span-2">
                <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider mb-0.5">Gestor Solicitante</span>
                <span className="text-slate-750 font-bold">{vaga.solicitante}</span>
              </div>
              <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider mb-0.5">Motivo de Abertura</span>
                <span className="text-slate-750 font-semibold">{vaga.motivo || 'Substituição'}</span>
              </div>
              <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider mb-0.5">Funcional Substituído</span>
                <span className="text-slate-750 font-semibold italic">{vaga.funcionarioSubstituido || '-'}</span>
              </div>
            </div>
          </div>

          {/* Dynamic workflow attributes (Bento Section 3) */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Status & Contratação</h4>
            <div className="grid grid-cols-2 gap-3 text-xs leading-relaxed">
              <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider mb-0.5">Etapa Atual no SGPC</span>
                <span className="text-orange-700 font-bold bg-orange-50 px-2 py-0.5 rounded border border-orange-150 uppercase text-[9px] inline-block mt-0.5">
                  {vaga.etapa || 'Triagem'}
                </span>
              </div>
              <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider mb-0.5">Candidato Selecionado</span>
                <span className={`font-bold flex items-center gap-1.5 ${vaga.status === 'FECHADA' ? 'text-emerald-850' : 'text-slate-700'}`}>
                  {vaga.aprovado ? (
                    <>
                      <UserCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{vaga.aprovado}</span>
                    </>
                  ) : vaga.status === 'FECHADA' ? (
                    <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 text-[10px] uppercase font-extrabold flex items-center gap-1">
                      ⚠️ Não informado
                    </span>
                  ) : (
                    <span className="text-slate-400 font-medium italic">Ainda em aberto</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Funil de candidatos (indicadores do processo) */}
          {(!!vaga.candChamados || !!vaga.candCompareceram || !!vaga.candAprovados || !!vaga.motivoDesistencia) && (
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Funil de Candidatos</h4>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                  <span className="block text-lg font-extrabold text-slate-800">{vaga.candChamados || 0}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Chamados</span>
                </div>
                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                  <span className="block text-lg font-extrabold text-blue-700">{vaga.candCompareceram || 0}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Compareceram</span>
                </div>
                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                  <span className="block text-lg font-extrabold text-emerald-700">{vaga.candAprovados || 0}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Aprovados</span>
                </div>
              </div>
              {vaga.motivoDesistencia && (
                <div className="flex items-center gap-2 text-[11px] bg-rose-50/50 border border-rose-100 rounded-xl px-3 py-2">
                  <span className="font-bold text-rose-700 uppercase text-[9px]">Desistência:</span>
                  <span className="text-slate-700 font-semibold">{vaga.motivoDesistencia}</span>
                </div>
              )}
            </div>
          )}

          {/* Notes block */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Informações Complementares</h4>
            <div className="bg-orange-50/15 border border-orange-100/70 rounded-2xl p-4 text-xs text-slate-700 font-medium relative italic leading-relaxed">
              <FileText className="absolute right-4 top-4 text-slate-205 w-5 h-5 shrink-0 opacity-40" />
              <p className="whitespace-pre-line">
                {vaga.observacoes || "Nenhuma anotação adicional registrada para o processo seletivo deste cargo."}
              </p>
            </div>
          </div>

          {/* Histórico / timeline a partir dos logs (carregados só para admin) */}
          {logs && logs.length > 0 && (() => {
            const marca = `#${vaga.codigo}`;
            const vagaLogs = logs
              .filter(l => l.modulo === 'Vagas' && l.detalhes.includes(marca))
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .slice(0, 12);
            return (
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Histórico da Vaga</h4>
                {vagaLogs.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">Nenhum registro de alteração para esta vaga.</p>
                ) : (
                  <ul className="space-y-2.5 pt-1">
                    {vagaLogs.map(l => (
                      <li key={l.id} className="flex gap-2.5 text-[11px]">
                        <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${l.acao === 'EXCLUIU' ? 'bg-rose-500' : l.acao === 'CRIOU' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                        <div className="min-w-0">
                          <p className="text-slate-700 font-semibold leading-snug">{l.detalhes}</p>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">{new Date(l.timestamp).toLocaleString('pt-BR')} · {l.usuario}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })()}

        </div>

        {/* Quick Actions Footer inside Drawer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold rounded-xl text-slate-650 cursor-pointer transition"
          >
            Fechar Detalhes
          </button>

          {canManage && (
            <div className="flex items-center gap-2">
              {vaga.status !== 'FECHADA' && (
                <button
                  onClick={() => onConcluir(vaga)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 font-bold text-white text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Concluir Vaga
                </button>
              )}
              <button
                onClick={() => onEditar(vaga)}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 font-bold text-white text-xs rounded-xl flex items-center gap-1 cursor-pointer transition shadow-none"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Editar Registro
              </button>
              <button
                onClick={() => onExcluir(vaga)}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition"
                title="Excluir Vaga"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir Vaga
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
