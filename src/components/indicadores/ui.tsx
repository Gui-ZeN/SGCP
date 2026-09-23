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
  <section className={`bg-white rounded-2xl border border-slate-200 p-5 min-w-0 ${className}`}>
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 mb-4">
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-slate-900 leading-snug">{titulo}</h3>
        {descricao && <p className="text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">{descricao}</p>}
      </div>
      {acoes && <div className="shrink-0">{acoes}</div>}
    </header>
    {children}
  </section>
);

type Tom = 'neutro' | 'bom' | 'atencao' | 'critico';
const COR_DO_TOM: Record<Tom, string> = {
  neutro: 'text-slate-900',
  bom: 'text-emerald-700',
  atencao: 'text-amber-700',
  critico: 'text-rose-700',
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
  <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3.5 min-w-0">
    <p className="text-xs font-semibold text-slate-600 truncate">{rotulo}</p>
    <p className={`mt-1 text-[28px] leading-none font-bold tabular-nums tracking-tight ${COR_DO_TOM[tom]}`}>
      {valor}
      {unidade && <span className="ml-1 text-sm font-semibold text-slate-500">{unidade}</span>}
    </p>
    {detalhe && <p className="mt-1.5 text-[11px] font-medium text-slate-500 leading-snug">{detalhe}</p>}
  </div>
);

/** Ressalva sobre o dado — dita onde o número aparece, não num rodapé. */
export const Nota: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <p className={`flex items-start gap-1.5 text-[11px] font-medium text-slate-500 leading-relaxed ${className}`}>
    <Info className="w-3.5 h-3.5 shrink-0 mt-px text-slate-400" aria-hidden="true" />
    <span>{children}</span>
  </p>
);

export const Vazio: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs font-medium text-slate-500 py-8 text-center">{children}</p>
);

/** Tooltip único dos gráficos: rótulo em cima, uma linha por série. */
export const Dica: React.FC<any> = ({ active, payload, label, sufixo = '', formatar }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-md px-3 py-2 text-[11px]">
      {label !== undefined && label !== '' && <p className="font-bold text-slate-900 mb-1">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-slate-600">
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: p.color || p.fill }} aria-hidden="true" />
          <span>{p.name}</span>
          <span className="ml-auto pl-4 font-bold text-slate-900 tabular-nums">
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
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="font-semibold text-slate-800 min-w-0">{i.nome}</span>
            <span className="shrink-0 tabular-nums font-bold text-slate-900">
              {num(i.valor)}{sufixo}
              {i.detalhe && <span className="ml-1.5 font-medium text-slate-500">{i.detalhe}</span>}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-slate-100" aria-hidden="true">
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, (i.valor / topo) * 100)}%`, background: cor || C.primary }} />
          </div>
        </li>
      ))}
    </ul>
  );
};
