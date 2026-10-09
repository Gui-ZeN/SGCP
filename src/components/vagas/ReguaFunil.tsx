import type React from 'react';
import type { Vaga } from '../../types';
import { SLA_META_DIAS } from '../../constants/hr';
import { ETAPAS_FUNIL, normalizeEtapa, isPausedOrSuspended, vagaAtrasada } from '../../utils/vaga';
import { corEtapa } from './CartaoVaga';

export interface Funil {
  total: number;
  porEtapa: { etapa: string; n: number }[];
  atrasadas: number;
  pausadas: number;
}

/** Quantas vagas vivas há em cada etapa, e quantas passaram da meta. */
export function funilDasVagas(vagas: Vaga[]): Funil {
  const vivas = vagas.filter(v => v.status !== 'FECHADA');
  return {
    total: vivas.length,
    porEtapa: ETAPAS_FUNIL.map(etapa => ({ etapa, n: vivas.filter(v => normalizeEtapa(v) === etapa).length })),
    atrasadas: vivas.filter(vagaAtrasada).length,
    pausadas: vivas.filter(v => isPausedOrSuspended(v.status)).length,
  };
}

/**
 * Régua do funil: quantas vagas há em cada etapa, na cor da etapa. A mesma no
 * Quadro de Vagas e no Início — com `href`, a régua inteira vira atalho.
 */
export const ReguaFunil: React.FC<{ funil: Funil; complemento?: React.ReactNode; href?: string }> = ({ funil, complemento, href }) => {
  const conteudo = (
    <>
      <p className="regua-txt">
        {funil.total === 0
          ? 'Nenhuma vaga em andamento.'
          : <><b>{funil.atrasadas} de {funil.total} vagas</b> passaram da meta de {SLA_META_DIAS} dias na etapa · {funil.pausadas} pausadas ou suspensas{complemento}</>}
      </p>
      {funil.total > 0 && (
        <>
          <div className="regua-barra" aria-hidden="true">
            {funil.porEtapa.map(({ etapa, n }) => (
              <span key={etapa} className={n ? '' : 'vazia'} style={{ flex: Math.max(n, funil.total * 0.04), background: corEtapa(etapa), color: corEtapa(etapa) }} />
            ))}
          </div>
          <div className="regua-legenda">
            {funil.porEtapa.map(({ etapa, n }) => (
              <span key={etapa}><i style={{ background: corEtapa(etapa) }} />{etapa} <b>{n}</b></span>
            ))}
          </div>
        </>
      )}
    </>
  );
  return href
    ? <a href={href} className="painel regua regua-link" aria-label="Resumo do funil — abrir o Quadro de Vagas">{conteudo}</a>
    : <section className="painel regua" aria-label="Resumo do funil">{conteudo}</section>;
};
