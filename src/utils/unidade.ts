import type { Vaga } from '../types';
import type { Sede } from '../hooks/useMetadata';

/**
 * Isolamento por UNIDADE (Colégio × Universidade) — regra de negócio central.
 * "Universidade" = vagas vindas da planilha (origem) ou cuja sede pertence à
 * região "Universidade". Todas as outras regiões são Colégio e se enxergam
 * entre si. Administrador vê tudo. (Antes inline no App.tsx; extraído para
 * ser puro e testável.)
 */

export const REGIAO_UNIVERSIDADE = 'universidade';
export const ORIGEM_PLANILHA_UNI = 'planilha-universidade';

/** A sede do catálogo correspondente ao rótulo — casa por NOME ou por SIGLA,
 *  ignorando caixa e espaços em volta. undefined se não estiver catalogada. */
export function acharSede(sedes: Sede[], rotulo?: string): Sede | undefined {
  const alvo = String(rotulo || '').toLowerCase().trim();
  if (!alvo) return undefined;
  return sedes.find(s =>
    (s.nome || '').toLowerCase().trim() === alvo || (s.sigla || '').toLowerCase().trim() === alvo
  );
}

/**
 * Sigla canônica de uma sede escrita de qualquer jeito. É a CHAVE DE
 * AGRUPAMENTO dos indicadores por sede.
 *
 * O campo `sede` das vagas mistura nome e sigla da mesma unidade e varia a
 * caixa — "DT" e "DIONISIO TORRES", "Sul 2" e "SUL 2", "PQL 1" e
 * "PARQUELANDIA 1". Agrupar pela string crua parte a mesma sede em duas fatias
 * e, como o rótulo final é a sigla nos dois casos, o gráfico desenha duas
 * barras com o MESMO nome. Medido em 27/08/2026: 10 colisões, sendo DT 63 + 20
 * quando o total real é 83.
 *
 * Rótulo fora do catálogo volta como veio (trim), para não sumir do gráfico.
 */
export function siglaCanonica(sedes: Sede[], rotulo?: string): string {
  const achada = acharSede(sedes, rotulo);
  if (achada) return achada.sigla || achada.nome || '';
  return String(rotulo || '').trim();
}

/** Região de uma sede pelo NOME ou pela SIGLA; '' se não encontrada.
 *  (Treinamentos usam sigla no campo unidade — ex.: "DT", "PQL 1".) */
export function regiaoDaSede(sedes: Sede[], nomeSede?: string): string {
  return acharSede(sedes, nomeSede)?.regiao || '';
}

/** A sede (por nome) pertence à região Universidade? */
export function sedeEhUniversidade(sedes: Sede[], nomeSede?: string): boolean {
  return regiaoDaSede(sedes, nomeSede).toLowerCase() === REGIAO_UNIVERSIDADE;
}

/** A vaga é da Universidade? (origem de planilha OU sede em região Universidade) */
export function vagaEhUniversidade(vaga: Pick<Vaga, 'origem' | 'sede'>, sedes: Sede[]): boolean {
  return (vaga.origem || '').indexOf(ORIGEM_PLANILHA_UNI) === 0 || sedeEhUniversidade(sedes, vaga.sede);
}

/**
 * Vagas visíveis para o usuário. Admin vê tudo; os demais veem apenas a sua
 * unidade (usuário da Universidade ↔ vagas da Universidade; caso contrário,
 * todo o Colégio — as 5 regiões se enxergam).
 */
export function escoparVagasPorUnidade(
  vagas: Vaga[],
  sedes: Sede[],
  sedeDoUsuario: string | undefined,
  isAdminOuEquivalente: boolean
): Vaga[] {
  if (isAdminOuEquivalente) return vagas;
  const usuarioEhUni = sedeEhUniversidade(sedes, sedeDoUsuario);
  return vagas.filter(v => vagaEhUniversidade(v, sedes) === usuarioEhUni);
}

/**
 * Escopo por unidade para qualquer lista que carregue uma sede/unidade num campo
 * (treinamentos→unidade, experiências→sede, entrevistas→unidade). Item sem sede
 * ou com sede desconhecida conta como Colégio (não some registro antigo).
 */
export function escoparListaPorUnidade<T>(
  itens: T[],
  sedeDoItem: (item: T) => string | undefined,
  sedes: Sede[],
  sedeDoUsuario: string | undefined,
  isAdminOuEquivalente: boolean
): T[] {
  if (isAdminOuEquivalente) return itens;
  const usuarioEhUni = sedeEhUniversidade(sedes, sedeDoUsuario);
  return itens.filter(i => sedeEhUniversidade(sedes, sedeDoItem(i)) === usuarioEhUni);
}

/** Sedes oferecidas nos filtros/forms: só as da unidade do usuário (admin vê todas). */
export function escoparSedesPorUnidade(
  sedes: Sede[],
  sedeDoUsuario: string | undefined,
  isAdminOuEquivalente: boolean
): Sede[] {
  if (isAdminOuEquivalente) return sedes;
  const usuarioEhUni = sedeEhUniversidade(sedes, sedeDoUsuario);
  return sedes.filter(s => ((s.regiao || '').toLowerCase() === REGIAO_UNIVERSIDADE) === usuarioEhUni);
}
