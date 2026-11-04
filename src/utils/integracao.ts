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

/**
 * A vaga salva pelo Editar ficou concluída com aprovado, e ele ainda não está na
 * Integração? Só o botão Concluir criava: preencher o aprovado depois, ou concluir
 * pelo Status, deixava a pessoa de fora (04/11/2026). Sem data de admissão: o Editar
 * não pergunta, e o RH preenche na Integração.
 */
export function integracaoAoEditar(
  vaga: Pick<Vaga, 'vaga' | 'setor' | 'sede' | 'solicitante' | 'codigo' | 'status' | 'aprovado'>,
  campos: Partial<Pick<Vaga, 'status' | 'aprovado'>>,
  integracoes: Pick<Integracao, 'nome'>[],
): Omit<Integracao, 'id'> | null {
  const status = campos.status ?? vaga.status, nome = (campos.aprovado ?? vaga.aprovado ?? '').trim();
  if (status !== 'FECHADA' || !nome || jaNaIntegracao(nome, integracoes)) return null;
  return integracaoDaVaga(vaga, nome, '');
}

/** Já está na Integração? Pelo nome, sem acento nem caixa (a Integração não guarda matrícula). */
export function jaNaIntegracao(nome: string, integracoes: Pick<Integracao, 'nome'>[]): boolean {
  const alvo = normalizarNome(nome);
  return !!alvo && integracoes.some(i => normalizarNome(i.nome) === alvo);
}
