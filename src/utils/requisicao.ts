import { Requisicao, Vaga } from '../types';

/**
 * Converte uma Requisição aceita nos campos da Vaga a criar (puro, testável).
 * Regras combinadas: 1 vaga por requisição; campos extras (seleção, justificativa,
 * jornada, skills, responsabilidades, contato) vão para as OBSERVAÇÕES da vaga.
 */
export function requisicaoParaVaga(
  req: Requisicao,
  agora: Date = new Date()
): Omit<Vaga, 'id' | 'codigo'> {
  const obs = [
    `Origem: requisição (${req.tipoContratacao}).`,
    req.selecao && `Seleção: ${req.selecao}.`,
    req.justificativa && `Justificativa: ${req.justificativa}`,
    req.jornada && `Jornada/Horário: ${req.jornada}`,
    req.idade && `Idade: ${req.idade}`,
    req.experiencia && `Experiência: ${req.experiencia}`,
    req.salarioBeneficios && `Salário/Benefícios: ${req.salarioBeneficios}`,
    req.hardSkills && `Hard skills: ${req.hardSkills}`,
    req.softSkills && `Soft skills: ${req.softSkills}`,
    req.responsabilidades && `Responsabilidades: ${req.responsabilidades}`,
    req.gestorEmail && `Contato do gestor: ${req.gestorEmail}`,
  ].filter(Boolean).join('\n');

  // Solicitação = data de criação da requisição; cai para "agora" se inválida.
  let solicitacao = agora.toLocaleDateString('pt-BR');
  if (req.criadaEm) {
    const d = new Date(req.criadaEm);
    if (!Number.isNaN(d.getTime())) solicitacao = d.toLocaleDateString('pt-BR');
  }

  return {
    vaga: req.cargo,
    sede: req.sede,
    setor: req.setor || 'Geral',
    status: 'ABERTA',
    solicitacao,
    solicitante: req.gestorSolicitante,
    motivo: req.tipoContratacao,
    responsavel: 'RH',
    etapa: 'Triagem',
    categoria: 'Requisição',
    observacoes: obs,
  } as Omit<Vaga, 'id' | 'codigo'>;
}
