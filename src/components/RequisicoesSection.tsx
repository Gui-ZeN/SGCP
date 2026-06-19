import React, { useState } from 'react';
import { Requisicao } from '../types';
import { Inbox, Check, X, ChevronDown, ChevronUp, Clock, MapPin, User, Briefcase } from 'lucide-react';

interface RequisicoesSectionProps {
  requisicoes: Requisicao[];
  onAceitar: (req: Requisicao) => void;
  onRecusar: (req: Requisicao, motivo: string) => void;
  canManage?: boolean;
}

const STATUS_BADGE: Record<string, string> = {
  pendente: 'bg-amber-50 text-amber-700 border-amber-200',
  aceita: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  recusada: 'bg-rose-50 text-rose-700 border-rose-200'
};

const Linha: React.FC<{ rotulo: string; valor?: string }> = ({ rotulo, valor }) =>
  valor && valor.trim() ? (
    <div className="text-xs">
      <span className="font-bold text-slate-500">{rotulo}: </span>
      <span className="text-slate-700 whitespace-pre-wrap">{valor}</span>
    </div>
  ) : null;

const RequisicaoCard: React.FC<{ req: Requisicao; onAceitar: (r: Requisicao) => void; onRecusar: (r: Requisicao, m: string) => void; canManage: boolean }> = ({ req, onAceitar, onRecusar, canManage }) => {
  const [aberto, setAberto] = useState(false);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const data = (() => { try { return new Date(req.criadaEm).toLocaleDateString('pt-BR'); } catch { return ''; } })();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 flex flex-wrap items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
          <Briefcase className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-slate-800 truncate">{req.cargo}</h3>
            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_BADGE[req.status] || ''}`}>{req.status}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500 font-semibold mt-0.5 flex-wrap">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{req.sede}</span>
            {req.setor && <span>{req.setor}</span>}
            <span className="flex items-center gap-1"><User className="w-3 h-3" />{req.gestorSolicitante}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{data}</span>
          </div>
        </div>
        <button onClick={() => setAberto(a => !a)} className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer shrink-0">
          {aberto ? <>Fechar <ChevronUp className="w-3.5 h-3.5" /></> : <>Detalhes <ChevronDown className="w-3.5 h-3.5" /></>}
        </button>
      </div>

      {aberto && (
        <div className="px-4 pb-4 pt-1 space-y-1.5 border-t border-slate-100">
          <Linha rotulo="Tipo de seleção" valor={req.selecao} />
          <Linha rotulo="Tipo de contratação" valor={req.tipoContratacao} />
          <Linha rotulo="Justificativa" valor={req.justificativa} />
          <Linha rotulo="Jornada/Horário" valor={req.jornada} />
          <Linha rotulo="Idade" valor={req.idade} />
          <Linha rotulo="Experiência" valor={req.experiencia} />
          <Linha rotulo="Salário/Benefícios" valor={req.salarioBeneficios} />
          <Linha rotulo="Hard Skills" valor={req.hardSkills} />
          <Linha rotulo="Soft Skills" valor={req.softSkills} />
          <Linha rotulo="Responsabilidades" valor={req.responsabilidades} />
          <Linha rotulo="E-mail do gestor" valor={req.gestorEmail} />
          {req.status === 'recusada' && <Linha rotulo="Motivo da recusa" valor={req.motivoRecusa} />}
        </div>
      )}

      {canManage && req.status === 'pendente' && (
        <div className="px-4 pb-4">
          {!recusando ? (
            <div className="flex gap-2">
              <button onClick={() => onAceitar(req)} className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition">
                <Check className="w-4 h-4" /> Aceitar e criar vaga
              </button>
              <button onClick={() => setRecusando(true)} className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition">
                <X className="w-4 h-4" /> Recusar
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea autoFocus value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} placeholder="Motivo da recusa (o gestor verá)…" className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-slate-800" />
              <div className="flex gap-2">
                <button onClick={() => { onRecusar(req, motivo.trim()); setRecusando(false); }} className="flex-1 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer">Confirmar recusa</button>
                <button onClick={() => { setRecusando(false); setMotivo(''); }} className="px-3 py-2 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg cursor-pointer">Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const RequisicoesSection: React.FC<RequisicoesSectionProps> = ({ requisicoes, onAceitar, onRecusar, canManage = true }) => {
  const pendentes = requisicoes.filter(r => r.status === 'pendente');
  const decididas = requisicoes.filter(r => r.status !== 'pendente');

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Requisições de Vaga</h1>
        <p className="text-sm text-slate-500 font-medium">Pedidos de abertura enviados pelos gestores. Aceite para criar a vaga.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Inbox className="w-4 h-4" /> Pendentes ({pendentes.length})
        </h2>
        {pendentes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center text-sm text-slate-400 font-semibold">
            Nenhuma requisição pendente. 🎉
          </div>
        ) : (
          pendentes.map(r => <RequisicaoCard key={r.id} req={r} onAceitar={onAceitar} onRecusar={onRecusar} canManage={canManage} />)
        )}
      </section>

      {decididas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Histórico ({decididas.length})</h2>
          {decididas.map(r => <RequisicaoCard key={r.id} req={r} onAceitar={onAceitar} onRecusar={onRecusar} canManage={false} />)}
        </section>
      )}
    </div>
  );
};
