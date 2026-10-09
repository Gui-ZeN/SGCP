/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * As peças do painel de Indicadores. Todas as abas usam ESTAS — é o que faz
 * cinco telas parecerem uma: o antigo painel tinha um estilo de título por
 * bloco (caixa alta 10px, 11px, 16px, com e sem ícone) e isso lia como colagem.
 *
 * Tema Suíço: hairline no lugar de sombra, um acento (cobalto), números
 * tabulares, cantos discretos. Nada de ícone decorativo em título.
 */
import React from 'react';
import { Info } from 'lucide-react';
import { useCoresGrafico } from '../../hooks/useCoresGrafico';

export const num = (n: number) => n.toLocaleString('pt-BR');
export const dec = (n: number, casas = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas });
export const pct = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 100) : 0);

/** Bloco de conteúdo: título que é título, descrição curta, e o resto. */
export const Painel: React.FC<{
  titulo: string;
  descricao?: React.ReactNode;
  acoes?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ titulo, descricao, acoes, className = '', children }) => (
  <section className={`painel p-5 min-w-0 ${className}`}>
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 mb-4">
      <div className="min-w-0">
        <h3 className="ind-titulo">{titulo}</h3>
        {descricao && <p className="ind-desc">{descricao}</p>}
      </div>
      {acoes && <div className="shrink-0">{acoes}</div>}
    </header>
    {children}
  </section>
);

type Tom = 'neutro' | 'bom' | 'atencao' | 'critico';
const COR_DO_TOM: Record<Tom, string> = {
  neutro: 'var(--tinta)',
  bom: 'var(--etapa-admissao)',
  atencao: 'var(--etapa-triagem)',
  critico: 'var(--atraso)',
};

/**
 * O número-chave. O número é o protagonista; o rótulo diz o que é, e o
 * `detalhe` diz sobre quê ("de 41 fechadas") — número sem denominador é
 * número que ninguém sabe ler.
 */
export const Kpi: React.FC<{
  rotulo: string;
  valor: React.ReactNode;
  unidade?: string;
  detalhe?: React.ReactNode;
  tom?: Tom;
}> = ({ rotulo, valor, unidade, detalhe, tom = 'neutro' }) => (
  <div className="painel ind-kpi">
    <p className="ind-kpi-rotulo">{rotulo}</p>
    <p className="ind-kpi-valor" style={{ color: COR_DO_TOM[tom] }}>
      {valor}
      {unidade && <span>{unidade}</span>}
    </p>
    {detalhe && <p className="ind-kpi-detalhe">{detalhe}</p>}
  </div>
);

/** Ressalva sobre o dado — dita onde o número aparece, não num rodapé. */
export const Nota: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <p className={`flex items-start gap-1.5 text-[12px] leading-relaxed ${className}`} style={{ color: 'var(--tinta-3)' }}>
    <Info className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
    <span>{children}</span>
  </p>
);

export const Vazio: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[13px] py-8 text-center" style={{ color: 'var(--tinta-3)' }}>{children}</p>
);

/** Tooltip único dos gráficos: rótulo em cima, uma linha por série. */
export const Dica: React.FC<any> = ({ active, payload, label, sufixo = '', formatar }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="painel px-3 py-2 text-[12px]" style={{ boxShadow: '0 4px 14px -4px rgba(20,27,45,.18)' }}>
      {label !== undefined && label !== '' && <p className="font-bold mb-1" style={{ color: 'var(--tinta)' }}>{label}</p>}
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2" style={{ color: 'var(--tinta-2)' }}>
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: p.color || p.fill }} aria-hidden="true" />
          <span>{p.name}</span>
          <span className="ml-auto pl-4 font-bold tabular-nums" style={{ color: 'var(--tinta)' }}>
            {formatar ? formatar(p.value, p.payload) : `${typeof p.value === 'number' ? num(p.value) : p.value}${sufixo}`}
          </span>
        </p>
      ))}
    </div>
  );
};

/** Eixos, grade e cursor com a mesma voz em todos os gráficos. */
export function useEixos() {
  const C = useCoresGrafico();
  return {
    C,
    grade: { stroke: C.grade, strokeDasharray: '0' },
    eixo: { fontSize: 11, stroke: C.eixo, tickLine: false, axisLine: false } as const,
    cursorBarra: { fill: C.primary, fillOpacity: 0.06 },
    cursorLinha: { stroke: C.eixo, strokeWidth: 1, strokeDasharray: '3 3' },
    /**
     * Legenda: o texto usa a tinta do texto, e a cor fica só no marcador — o
     * recharts, por padrão, pinta o rótulo com a cor da série.
     */
    legenda: {
      verticalAlign: 'top' as const, align: 'left' as const, height: 28, iconSize: 9,
      wrapperStyle: { fontSize: 11, fontWeight: 600, paddingLeft: 8 },
      formatter: (v: string) => <span style={{ color: C.rotulo }}>{v}</span>,
      // O recharts 3 ordena a legenda por nome; a ordem certa é a das séries.
      itemSorter: () => 0,
    },
  };
}

/**
 * Lista com barra — para rankings (motivos, cargos, sedes). Mais legível que
 * um gráfico de barras horizontal quando o rótulo é longo, e o número fica
 * escrito, não adivinhado na escala.
 */
export const ListaComBarra: React.FC<{
  itens: { nome: string; valor: number; detalhe?: string }[];
  cor?: string;
  sufixo?: string;
  max?: number;
}> = ({ itens, cor, sufixo = '', max }) => {
  const { C } = useEixos();
  const topo = max ?? Math.max(1, ...itens.map(i => i.valor));
  return (
    <ul className="space-y-2.5">
      {itens.map(i => (
        <li key={i.nome}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="font-semibold min-w-0" style={{ color: 'var(--tinta-2)' }}>{i.nome}</span>
            <span className="shrink-0 tabular-nums font-bold" style={{ color: 'var(--tinta)' }}>
              {num(i.valor)}{sufixo}
              {i.detalhe && <span className="ml-1.5 font-medium" style={{ color: 'var(--tinta-3)' }}>{i.detalhe}</span>}
            </span>
          </div>
          <div className="barra-fina mt-1" aria-hidden="true">
            <span style={{ width: `${Math.max(2, (i.valor / topo) * 100)}%`, background: cor || C.primary }} />
          </div>
        </li>
      ))}
    </ul>
  );
};
