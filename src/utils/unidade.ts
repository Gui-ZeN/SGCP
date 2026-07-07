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

/** Região de uma sede pelo NOME ou pela SIGLA; '' se não encontrada.
 *  (Treinamentos usam sigla no campo unidade — ex.: "DT", "PQL 1".) */
export function regiaoDaSede(sedes: Sede[], nomeSede?: string): string {
  const alvo = String(nomeSede || '').toLowerCase().trim();
  if (!alvo) return '';
  return sedes.find(s =>
    (s.nome || '').toLowerCase() === alvo || (s.sigla || '').toLowerCase() === alvo
  )?.regiao || '';
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
