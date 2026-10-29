/**
 * Vaga concluída → Integração (29/10/2026). Até aqui a conclusão só levava a
 * pessoa à Experiência; a Integração dependia de planilha, e de julho em diante
 * (quando a Universidade passou a concluir pelo sistema) quase ninguém entrou
 * lá. Decisão do Guilherme: toda vaga concluída com aprovado entra, sem opção,
 * como "Não realizado" — a não ser que a pessoa já esteja na Integração.
 */
import type { Integracao, Vaga } from '../types';
import { normalizarNome } from './catalogo';

export function integracaoDaVaga(
  vaga: Pick<Vaga, 'vaga' | 'setor' | 'sede' | 'solicitante' | 'codigo'>,
  nome: string,
  admissao: string,
): Omit<Integracao, 'id'> {
  return {
    nome: nome.trim(),
    funcao: vaga.vaga,
    setor: vaga.setor || '',
    sede: vaga.sede,
    admissao,
    supervisor: vaga.solicitante || '',
    status: 'Não realizado',
    observacao: `Veio da vaga nº ${vaga.codigo}.`,
  };
}

/** Já está na Integração? Pelo nome, sem acento nem caixa (a Integração não guarda matrícula). */
export function jaNaIntegracao(nome: string, integracoes: Pick<Integracao, 'nome'>[]): boolean {
  const alvo = normalizarNome(nome);
  return !!alvo && integracoes.some(i => normalizarNome(i.nome) === alvo);
}
