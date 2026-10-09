import React from 'react';
import { Vaga, Selecao, Requisicao } from '../../types';
import { ehRealizada, type FunilEfetivo } from '../../utils/selecao';
import { SystemLog } from '../../hooks/useLogs';
import { getDiasEmAberto, getSlaInfo, isPausedOrSuspended } from '../../utils/vaga';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Atalho } from '../ui/Atalhos';
import { toISOInput } from '../../utils/date';

/**
 * Detalhes da vaga. Era uma gaveta que abria na lateral; desde 08/10/2026 abre
 * no meio da tela, no modal padrão (pedido do Guilherme). O nome do arquivo
 * ficou por ser importado em vários lugares.
 * Puramente apresentacional: recebe a vaga + callbacks; todo estado fica no pai.
 */
interface VagaDetailsDrawerProps {
  vaga: Vaga;
  logs?: SystemLog[];
  canManage: boolean;
  /** O funil que a vaga mostra (das seleções ligadas, ou digitado). */
  funil: FunilEfetivo;
  /** Seleções ligadas a esta vaga. */
  selecoes?: Selecao[];
  onAbrirSelecao?: (id: string) => void;
  /** A requisição de onde a vaga nasceu (só para quem vê requisições). */
  origem?: Requisicao;
  /** Mostra o atalho "Nova seleção para esta vaga". */
  podeNovaSelecao?: boolean;
  getSedeLabel: (nome: string) => string;
  renderStatusBadge: (status: Vaga['status']) => React.ReactNode;
  onClose: () => void;
  onConcluir: (vaga: Vaga) => void;
  onEditar: (vaga: Vaga) => void;
  onExcluir: (vaga: Vaga) => void;
}

export const VagaDetailsDrawer: React.FC<VagaDetailsDrawerProps> = ({
  vaga, logs, canManage, funil, selecoes = [], onAbrirSelecao, origem, podeNovaSelecao, getSedeLabel, renderStatusBadge, onClose, onConcluir, onEditar, onExcluir
}) => {
  const dias = getDiasEmAberto(vaga);
  const pausada = isPausedOrSuspended(vaga.status);
  const sla = getSlaInfo(dias, vaga.status === 'FECHADA', pausada);
  const corPrazo = pausada ? 'var(--etapa-pausa)'
    : /Crítico/.test(sla.label) ? 'var(--atraso)'
    : /Alerta/.test(sla.label) ? '#B7791F'
    : 'var(--etapa-admissao)';
  const temFunil = !!funil.chamados || !!funil.compareceram || !!funil.aprovados || !!vaga.motivoDesistencia || funil.fonte === 'selecao';
  const historico = (logs || [])
    .filter(l => l.modulo === 'Vagas' && l.detalhes.includes(`#${vaga.codigo}`))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 12);

  return (
    <Modal
      largura="lg"
      aoFechar={onClose}
      antes={<><span>Vaga nº {vaga.codigo}</span>{renderStatusBadge(vaga.status)}</>}
      titulo={vaga.vaga}
      rodape={canManage ? (
        <>
          <button type="button" className="btn btn-perigo mr-auto" onClick={() => onExcluir(vaga)}><Trash2 />Excluir</button>
          <button type="button" className="btn" onClick={() => onEditar(vaga)}><Pencil />Editar</button>
          {vaga.status !== 'FECHADA' && (
            <button type="button" className="btn btn-primario" onClick={() => onConcluir(vaga)}><Check />Concluir vaga</button>
          )}
        </>
      ) : (
        <button type="button" className="btn" onClick={onClose}>Fechar</button>
      )}
    >
      <section className="secao">
        <h3 className="secao-titulo">
          Prazo
          <span className="etiqueta" style={{ color: corPrazo, background: 'var(--superficie)' }}>{sla.label.replace('SLA ', '')}</span>
        </h3>
        <div className="trilho" style={{ height: 6 }} aria-hidden="true">
          <i style={{ width: `${sla.percent}%`, background: corPrazo }} />
        </div>
        <p className="mt-2 text-[13.5px]" style={{ color: 'var(--tinta-2)' }}>
          Aberta em {vaga.solicitacao} · <b style={{ color: 'var(--tinta)' }}>{dias} dias</b>
          {vaga.conclusao ? ` · fechada em ${vaga.conclusao}` : ''} · {sla.desc}
        </p>
      </section>

      <section className="secao">
        <dl className="ficha">
          <div><dt>Sede</dt><dd>{getSedeLabel(vaga.sede)}</dd></div>
          <div><dt>Setor</dt><dd>{vaga.setor || '—'}</dd></div>
          <div><dt>Gestor solicitante</dt><dd>{vaga.solicitante || '—'}</dd></div>
          <div><dt>Responsável no RH</dt><dd>{vaga.responsavel || 'Equipe RH'}</dd></div>
          <div><dt>Motivo da abertura</dt><dd>{vaga.motivo || 'Substituição'}</dd></div>
          <div><dt>Quem está sendo substituído</dt><dd>{vaga.funcionarioSubstituido || '—'}</dd></div>
          <div><dt>Sexo preferencial</dt><dd>{vaga.sexo || 'Indiferente'}</dd></div>
          <div><dt>Etapa</dt><dd>{vaga.etapa || 'Triagem'}</dd></div>
          {origem && (
            <div className="larga">
              <dt>Origem</dt>
              <dd>
                Requisição de {origem.gestorSolicitante}{origem.criadaEm ? ` em ${new Date(origem.criadaEm).toLocaleDateString('pt-BR')}` : ''}
                {' · '}<Atalho para="requisicoes">ver as requisições</Atalho>
              </dd>
            </div>
          )}
          <div className="larga">
            <dt>Candidato selecionado</dt>
            <dd>
              {vaga.aprovado
                ? <>{vaga.aprovado}{vaga.status === 'FECHADA' && <>{' · '}<Atalho para="experiencias" params={{ pessoa: vaga.aprovado }}>ver na Experiência</Atalho></>}</>
                : vaga.status === 'FECHADA'
                  ? <span className="etiqueta etiqueta-atraso">Não informado</span>
                  : <span style={{ color: 'var(--tinta-3)', fontWeight: 500 }}>Ainda em aberto</span>}
            </dd>
          </div>
        </dl>
      </section>

      {temFunil && (
        <section className="secao">
          <h3 className="secao-titulo">Funil de candidatos {funil.fonte === 'selecao' && <small>somado das seleções, automático</small>}</h3>
          <dl className="ficha" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <div><dt>Chamados</dt><dd className="text-[22px] tabular-nums">{funil.chamados}</dd></div>
            <div><dt>Compareceram</dt><dd className="text-[22px] tabular-nums">{funil.compareceram}</dd></div>
            <div><dt>Aprovados</dt><dd className="text-[22px] tabular-nums">{funil.aprovados}</dd></div>
          </dl>
          {vaga.motivoDesistencia && (
            <p className="mt-3 text-[13.5px]"><span className="etiqueta etiqueta-atraso mr-2">Desistência</span>{vaga.motivoDesistencia}</p>
          )}
        </section>
      )}

      {(selecoes.length > 0 || (podeNovaSelecao && vaga.status !== 'FECHADA')) && (
        <section className="secao">
          <h3 className="secao-titulo">
            Seleções desta vaga
            {podeNovaSelecao && vaga.status !== 'FECHADA' && (
              <Atalho para="selecoesLista" params={{ novaSelecao: vaga.id }} className="btn btn-sm">+ Nova seleção para esta vaga</Atalho>
            )}
          </h3>
          {selecoes.length === 0 && <p className="text-[13.5px]" style={{ color: 'var(--tinta-3)' }}>Nenhuma seleção ligada ainda.</p>}
          <ul className="divide-y" style={{ borderColor: '#EEF0F3' }}>
            {selecoes.map(s => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-[13.5px]">
                <b className="tabular-nums w-24 shrink-0">{s.data}</b>
                <span className="flex-1 min-w-[180px]" style={{ color: 'var(--tinta-2)' }}>
                  {ehRealizada(s) ? `${s.convocados} convocados · ${s.compareceram} vieram · ${s.contratados} contratados` : `Agendada · ${s.convocados} convocados`}
                </span>
                {onAbrirSelecao && <button type="button" className="atalho" onClick={() => onAbrirSelecao(s.id)}>Candidatos</button>}
                <Atalho para="selecoes" params={{ dia: toISOInput(s.data) }}>Ver o dia</Atalho>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="secao">
        <h3 className="secao-titulo">Observações</h3>
        <p className="whitespace-pre-line text-[14px]" style={{ color: vaga.observacoes ? 'var(--tinta)' : 'var(--tinta-3)' }}>
          {vaga.observacoes || 'Nenhuma observação registrada.'}
        </p>
      </section>

      {logs && (
        <section className="secao">
          <h3 className="secao-titulo">Histórico</h3>
          {historico.length === 0 ? (
            <p className="text-[13.5px]" style={{ color: 'var(--tinta-3)' }}>Nenhuma alteração registrada para esta vaga.</p>
          ) : (
            <ul className="space-y-2.5">
              {historico.map(l => (
                <li key={l.id} className="text-[13.5px]">
                  <p style={{ color: 'var(--tinta)' }}>{l.detalhes}</p>
                  <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--tinta-3)' }}>{new Date(l.timestamp).toLocaleString('pt-BR')} · {l.usuario}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </Modal>
  );
};
