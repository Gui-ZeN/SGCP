import type React from 'react';
import { Pause, Play, Pencil, Check, Clock } from 'lucide-react';
import type { Vaga } from '../../types';
import { SLA_META_DIAS } from '../../constants/hr';

/** Cor de cada etapa (tokens em styles/ui.css). Não muda com campanha. */
export const CHAVE_ETAPA: Record<string, string> = {
  'Triagem': 'triagem',
  'Entrevista': 'entrevista',
  'Testes': 'testes',
  'Documentação': 'documentacao',
  'Aguardando admissão': 'admissao',
};
export const corEtapa = (etapa: string) => `var(--etapa-${CHAVE_ETAPA[etapa] ?? 'pausa'})`;
export const fundoEtapa = (etapa: string) => `var(--etapa-${CHAVE_ETAPA[etapa] ?? 'pausa'}-fundo)`;

interface Props {
  vaga: Vaga;
  sigla: string;
  /** Dias contados (na etapa, no Kanban por etapa; em aberto, nas outras visões). */
  dias: number;
  rotuloDias: string;
  pausada: boolean;
  /** Cor da barra de prazo quando está dentro da meta. */
  cor: string;
  podeGerir: boolean;
  abrir: () => void;
  editar: () => void;
  pausar: () => void;
  retomar: () => void;
  /** Próximo passo do processo, quando houver ("Mover para Entrevista"). */
  avancar?: { rotulo: string; cor: string; acao: () => void };
  concluir?: () => void;
  arrastando?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}

/**
 * Cartão de vaga do Quadro. As ações vêm sempre à mostra e dizem o que fazem:
 * quem usa não é de sistema, então nada fica escondido no passar do mouse.
 */
export function CartaoVaga({ vaga, sigla, dias, rotuloDias, pausada, cor, podeGerir, abrir, editar, pausar, retomar, avancar, concluir, arrastando, onDragStart, onDragEnd }: Props) {
  const fechada = vaga.status === 'FECHADA';
  const atrasada = !fechada && !pausada && dias > SLA_META_DIAS;
  return (
    <article
      className={`cartao${pausada ? ' pausa' : ''}${arrastando ? ' arrastando' : ''}`}
      draggable={podeGerir && !fechada && !!onDragStart}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="cartao-topo">
        <span>nº {vaga.codigo}</span>
        <span className="cartao-sede" title={vaga.sede}>{sigla}</span>
      </div>
      <button type="button" className="cartao-titulo" onClick={abrir} title="Ver detalhes da vaga">{vaga.vaga}</button>
      <div className="cartao-setor" title={vaga.setor}>{vaga.setor || 'Sem setor'}</div>

      {fechada ? (
        <div className="cartao-contratado" title={vaga.aprovado}>Contratado: {vaga.aprovado || 'não informado'}</div>
      ) : pausada ? (
        <div className="cartao-prazo">
          <span className="etiqueta">{vaga.status === 'SUSPENSA' ? 'Suspensa' : 'Pausada'}</span>
          <span>prazo parado</span>
        </div>
      ) : (
        <>
          <div className="cartao-prazo">
            {/* Curto de propósito (pedido de 08/10): o detalhe fica no title. */}
            <b className={atrasada ? 'atraso' : ''} title={`${dias} ${dias === 1 ? 'dia' : 'dias'} ${rotuloDias}`}><Clock aria-hidden="true" />{dias} {dias === 1 ? 'dia' : 'dias'}<span className="sr-only"> {rotuloDias}</span></b>
            {atrasada && <span className="etiqueta etiqueta-atraso">Atrasada</span>}
          </div>
          <div className="trilho" aria-hidden="true">
            <i style={{ width: `${Math.min(100, Math.max(4, (dias / SLA_META_DIAS) * 100))}%`, background: atrasada ? 'var(--atraso)' : cor }} />
          </div>
        </>
      )}

      {podeGerir && !fechada && (
        <div className="cartao-acoes">
          {pausada ? (
            <button type="button" className="btn" onClick={retomar}><Play />Retomar a vaga</button>
          ) : concluir ? (
            <button type="button" className="btn btn-avancar" style={{ background: 'var(--etapa-admissao)' }} onClick={concluir}><Check />Concluir a vaga</button>
          ) : avancar ? (
            <button type="button" className="btn btn-avancar" style={{ background: avancar.cor }} onClick={avancar.acao}>{avancar.rotulo} →</button>
          ) : null}
          <div className="cartao-acoes-sec">
            {!pausada && <button type="button" className="btn-texto" onClick={pausar} title="O prazo para de contar enquanto a vaga estiver pausada"><Pause />Pausar</button>}
            <button type="button" className="btn-texto" onClick={editar}><Pencil />Editar</button>
          </div>
        </div>
      )}
    </article>
  );
}
