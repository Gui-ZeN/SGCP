import React, { useState } from 'react';
import { Requisicao } from '../types';
import { Check, ChevronDown, ChevronUp, Link2 } from 'lucide-react';
import { LinkVaga } from './ui/Atalhos';
import { Modal } from './ui/Modal';

interface RequisicoesSectionProps {
  requisicoes: Requisicao[];
  onAceitar: (req: Requisicao) => void;
  onRecusar: (req: Requisicao, motivo: string) => void;
  canManage?: boolean;
}

/** Cor da situação (tokens de ui.css). */
const COR_STATUS: Record<string, string> = {
  pendente: 'var(--etapa-triagem)',
  aceita: 'var(--etapa-admissao)',
  recusada: 'var(--atraso)',
};
const ROTULO_STATUS: Record<string, string> = { pendente: 'Pendente', aceita: 'Aceita', recusada: 'Recusada' };

const idade = (criadaEm: string) => {
  const d = Math.floor((Date.now() - new Date(criadaEm).getTime()) / 86400000);
  return isNaN(d) ? '' : d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`;
};

const RequisicaoCard: React.FC<{ req: Requisicao; onAceitar: (r: Requisicao) => void; recusar: (r: Requisicao) => void; canManage: boolean }> = ({ req, onAceitar, recusar, canManage }) => {
  const [aberto, setAberto] = useState(false);
  const data = (() => { try { return new Date(req.criadaEm).toLocaleDateString('pt-BR'); } catch { return ''; } })();
  const detalhes: [string, string | undefined][] = [
    ['Tipo de seleção', req.selecao],
    ['Tipo de contratação', req.tipoContratacao],
    ['Jornada / horário', req.jornada],
    ['Idade', req.idade],
    ['Experiência', req.experiencia],
    ['Salário e benefícios', req.salarioBeneficios],
    ['Justificativa', req.justificativa],
    ['Hard skills', req.hardSkills],
    ['Soft skills', req.softSkills],
    ['Responsabilidades', req.responsabilidades],
    ['E-mail do gestor', req.gestorEmail],
    ...(req.status === 'recusada' ? [['Motivo da recusa', req.motivoRecusa] as [string, string | undefined]] : []),
  ];
  const longos = ['Justificativa', 'Hard skills', 'Soft skills', 'Responsabilidades', 'Motivo da recusa'];

  return (
    <article className="painel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[15.5px] font-bold" style={{ color: 'var(--tinta)' }}>{req.cargo}</h3>
            <b className="text-[13px]" style={{ color: COR_STATUS[req.status] }}>{ROTULO_STATUS[req.status] || req.status}</b>
            {/* A vaga que nasceu desta requisição (gravado ao aceitar, desde 08/10/2026). */}
            {req.status === 'aceita' && req.vagaCodigo != null && <LinkVaga codigo={req.vagaCodigo} />}
          </div>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--tinta-2)' }}>
            {[req.sede, req.setor, `pedido por ${req.gestorSolicitante}`, `${data}${req.status === 'pendente' ? ` (${idade(req.criadaEm)})` : ''}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" className="btn btn-sm" onClick={() => setAberto(a => !a)} aria-expanded={aberto}>
            {aberto ? <>Fechar <ChevronUp aria-hidden="true" /></> : <>Detalhes <ChevronDown aria-hidden="true" /></>}
          </button>
          {canManage && req.status === 'pendente' && (
            <>
              <button type="button" className="btn btn-sm btn-perigo" onClick={() => recusar(req)}>Recusar</button>
              <button type="button" className="btn btn-sm btn-primario" onClick={() => onAceitar(req)}><Check aria-hidden="true" /> Aceitar e criar vaga</button>
            </>
          )}
        </div>
      </div>

      {aberto && (
        <dl className="ficha mt-4 pt-4" style={{ borderTop: '1px solid var(--fio)' }}>
          {detalhes.filter(([, v]) => v && v.trim()).map(([r, v]) => (
            <div key={r} className={longos.includes(r) ? 'larga' : undefined}>
              <dt>{r}</dt>
              <dd className="whitespace-pre-wrap font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
};

export const RequisicoesSection: React.FC<RequisicoesSectionProps> = ({ requisicoes, onAceitar, onRecusar, canManage = true }) => {
  const pendentes = requisicoes.filter(r => r.status === 'pendente');
  const decididas = requisicoes.filter(r => r.status !== 'pendente');
  const [aba, setAba] = useState<'pendentes' | 'historico'>('pendentes');
  const [recusando, setRecusando] = useState<Requisicao | null>(null);
  const [motivo, setMotivo] = useState('');

  const [copiado, setCopiado] = useState(false);
  const linkForm = (typeof window !== 'undefined' ? window.location.origin : '') + '/requisicao';
  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(linkForm);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = linkForm; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const lista = aba === 'pendentes' ? pendentes : decididas;
  const abrirRecusa = (r: Requisicao) => { setRecusando(r); setMotivo(''); };

  return (
    <div className="space-y-5">
      <header className="pagina-cab">
        <div className="min-w-0">
          <p className="pagina-trilha">Recrutamento</p>
          <h1 className="pagina-titulo">Requisições de vaga</h1>
          <p className="inicio-sub">Pedidos de abertura enviados pelos gestores. Aceite para criar a vaga.</p>
        </div>
        <div className="pagina-acoes">
          <button type="button" className="btn" onClick={copiarLink} title={linkForm}>
            {copiado ? <><Check aria-hidden="true" /> Link copiado</> : <><Link2 aria-hidden="true" /> Link do formulário</>}
          </button>
        </div>
      </header>

      <div className="seg" role="group" aria-label="Requisições">
        <button type="button" aria-pressed={aba === 'pendentes'} onClick={() => setAba('pendentes')}>Pendentes <b className="tabular-nums">{pendentes.length}</b></button>
        <button type="button" aria-pressed={aba === 'historico'} onClick={() => setAba('historico')}>Histórico <b className="tabular-nums">{decididas.length}</b></button>
      </div>

      {lista.length === 0 ? (
        <p className="painel text-center py-12 text-[14px]" style={{ color: 'var(--tinta-3)' }}>
          {aba === 'pendentes' ? 'Nenhuma requisição esperando resposta.' : 'Nenhuma requisição decidida ainda.'}
        </p>
      ) : (
        <div className="space-y-3">
          {lista.map(r => <RequisicaoCard key={r.id} req={r} onAceitar={onAceitar} recusar={abrirRecusa} canManage={canManage && aba === 'pendentes'} />)}
        </div>
      )}

      {recusando && (
        <Modal
          titulo={`Recusar: ${recusando.cargo}`}
          antes={<>{recusando.sede} · pedido por {recusando.gestorSolicitante}</>}
          largura="sm"
          aoFechar={() => setRecusando(null)}
          rodape={<>
            <button type="button" className="btn" onClick={() => setRecusando(null)}>Cancelar</button>
            <button type="button" className="btn btn-perigo" onClick={() => { onRecusar(recusando, motivo.trim()); setRecusando(null); }}>Recusar requisição</button>
          </>}
        >
          <label className="block">
            <span className="rotulo">Motivo da recusa</span>
            <textarea autoFocus rows={3} className="campo w-full" value={motivo} onChange={e => setMotivo(e.target.value)} />
            <span className="ajuda block">O gestor vê este texto.</span>
          </label>
        </Modal>
      )}
    </div>
  );
};
