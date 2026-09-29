/**
 * Funil completo da seleção (pedido de 29/09/2026): chamados → compareceram →
 * aprovado pelo gestor → documentação → contratados → passaram da experiência.
 *
 * Não existe um registro por pessoa que atravesse tudo isso, então cada etapa
 * vem de onde o sistema JÁ guarda a informação — nada é lançado de novo:
 *  - chamados/compareceram: as seleções (PESSOAS);
 *  - aprovado/documentação/contratado: o Quadro de Vagas (VAGAS — uma vaga,
 *    uma contratação). Cumulativo: vaga fechada passou pela documentação e
 *    teve aprovado, mesmo que o nome não tenha sido digitado;
 *  - experiência: o aprovado da vaga contratada, procurado pelo NOME no módulo
 *    Experiência. Quem ainda está nos 45/90 dias ou não foi cadastrado lá fica
 *    à parte — não é perda.
 */
import type { Vaga, Experiencia, Selecao } from '../types';
import { anoMes, noPeriodo, type Periodo } from './filtroIndicadores';
import { origemDoSetor } from './selecao';
import { ehRealizada } from './selecao';
import { normalizarNome } from './catalogo';
import type { RecorteSelecao } from './indicadores';

export interface EtapaFunil {
  id: 'chamados' | 'compareceram' | 'aprovados' | 'documentacao' | 'contratados' | 'efetivados';
  rotulo: string;
  valor: number;
  unidade: 'pessoas' | 'vagas';
}

export interface FunilCompleto {
  etapas: EtapaFunil[];
  /** Contratados cruzados com a Experiência pelo nome. */
  experiencia: { efetivados: number; sairam: number; emCurso: number; semCadastro: number };
  /** Vagas em andamento entram só quando o período inclui o mês de hoje. */
  incluiEmAndamento: boolean;
}

const EM_ANDAMENTO = ['ABERTA', 'REABERTA', 'DOCUMENTAÇÃO'];

/** Chave "primeiro + último nome", usada só quando é única dos dois lados. */
const primeiroUltimo = (nome: string) => {
  const p = normalizarNome(nome).split(' ').filter(Boolean);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1]}` : p[0] || '';
};

export function indiceDeExperiencia(experiencias: Experiencia[]) {
  const porNome = new Map<string, Experiencia>();
  const porPU = new Map<string, Experiencia | null>();
  for (const e of experiencias) {
    const k = normalizarNome(e.colaborador || '');
    if (k) porNome.set(k, e);
    const pu = primeiroUltimo(e.colaborador || '');
    if (pu) porPU.set(pu, porPU.has(pu) ? null : e); // null = ambíguo, não usa
  }
  return (nome: string): Experiencia | undefined =>
    porNome.get(normalizarNome(nome)) ?? (porPU.get(primeiroUltimo(nome)) || undefined);
}

export function funilCompleto(entrada: {
  selecoes: Selecao[];          // já no período e na sede
  vagas: Vaga[];                // já na sede (qualquer data)
  experiencias: Experiencia[];  // já na sede (qualquer data)
  periodo: Periodo;
  recorte: RecorteSelecao;
  hojeISO: string;
}): FunilCompleto {
  const { selecoes, vagas, experiencias, periodo, recorte, hojeISO } = entrada;
  const realizadas = selecoes.filter(ehRealizada);
  const chamados = realizadas.reduce((t, s) => t + (s.convocados || 0), 0);
  const compareceram = realizadas.reduce((t, s) => t + (s.compareceram || 0), 0);

  const incluiEmAndamento = noPeriodo(periodo, anoMes(hojeISO));
  const doRecorte = (v: Vaga) => recorte === 'ambos' || origemDoSetor(v.setor) === recorte;
  const fechadas = vagas.filter(v => doRecorte(v) && v.status === 'FECHADA' && noPeriodo(periodo, anoMes(v.conclusao)));
  const andamento = incluiEmAndamento ? vagas.filter(v => doRecorte(v) && EM_ANDAMENTO.includes(v.status)) : [];

  const emDoc = andamento.filter(v => v.status === 'DOCUMENTAÇÃO');
  const comAprovado = andamento.filter(v => v.status === 'DOCUMENTAÇÃO' || (v.aprovado || '').trim());

  const acha = indiceDeExperiencia(experiencias);
  const experiencia = { efetivados: 0, sairam: 0, emCurso: 0, semCadastro: 0 };
  for (const v of fechadas) {
    const e = (v.aprovado || '').trim() ? acha(v.aprovado!) : undefined;
    if (!e) experiencia.semCadastro++;
    else if (e.status === 'EFETIVADO') experiencia.efetivados++;
    else if (e.status === 'ENCERRADO') experiencia.sairam++;
    else experiencia.emCurso++;
  }

  return {
    etapas: [
      { id: 'chamados', rotulo: 'Chamados', valor: chamados, unidade: 'pessoas' },
      { id: 'compareceram', rotulo: 'Compareceram', valor: compareceram, unidade: 'pessoas' },
      { id: 'aprovados', rotulo: 'Aprovados pelo gestor', valor: fechadas.length + comAprovado.length, unidade: 'vagas' },
      { id: 'documentacao', rotulo: 'Entregaram a documentação', valor: fechadas.length + emDoc.length, unidade: 'vagas' },
      { id: 'contratados', rotulo: 'Contratados', valor: fechadas.length, unidade: 'vagas' },
      { id: 'efetivados', rotulo: 'Passaram da experiência', valor: experiencia.efetivados, unidade: 'vagas' },
    ],
    experiencia,
    incluiEmAndamento,
  };
}
