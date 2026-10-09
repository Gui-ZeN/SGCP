import type React from 'react';
import { linkPara, type Aba, type ParametrosDaRota } from '../../lib/rotas';

/**
 * Atalhos entre telas: são links comuns (#/vagas?vaga=124), então o Voltar do
 * navegador traz de volta e dá para abrir em outra aba com o botão do meio.
 * `stopPropagation` porque costumam morar dentro de linhas clicáveis.
 */
export function Atalho({ para, params, children, className = 'atalho', title }: {
  para: Aba;
  params?: ParametrosDaRota;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <a href={linkPara(para, params)} className={className} title={title} onClick={e => e.stopPropagation()}>
      {children}
    </a>
  );
}

/** "nº 124" que abre a vaga no Quadro, já com os detalhes. */
export function LinkVaga({ codigo }: { codigo: number | string }) {
  return (
    <Atalho para="vagas" params={{ vaga: String(codigo) }} className="link-vaga" title={`Abrir a vaga nº ${codigo} no Quadro de Vagas`}>
      nº {codigo}
    </Atalho>
  );
}
