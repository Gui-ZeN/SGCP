/**
 * Outubro Rosa — frases de enfeite para o Início do SGPC (mês de
 * conscientização sobre o câncer de mama).
 *
 * Mesmo tom do Setembro Amarelo: leve e acolhedor. Nada de recomendação médica
 * específica (idade, frequência de exame) — isso é conversa com o médico, e a
 * frase diz isso em vez de arriscar um número. Uma frase é sorteada a cada
 * abertura do sistema.
 */

export const FRASES_OUTUBRO_ROSA: string[] = [
  'Cuidar de si também é prioridade.',
  'Conhecer o próprio corpo ajuda a notar quando algo muda.',
  'Percebeu alguma mudança na mama? Procure um médico, sem esperar.',
  'Diagnóstico precoce aumenta muito as chances de tratamento.',
  'Já marcou seus exames de rotina deste ano?',
  'Converse com seu médico sobre quando fazer a mamografia.',
  'Nódulo, pele retraída ou líquido saindo do mamilo: vale uma consulta.',
  'Lembre quem você ama de cuidar da saúde também.',
  'O câncer de mama também pode atingir homens. A atenção vale para todos.',
  'Uma consulta hoje pode evitar muita preocupação amanhã.',
  'Cuidar da saúde não é luxo, é rotina.',
  'Informação de qualidade salva vidas. Compartilhe.',
  'Liberar um horário para o exame também é cuidar da equipe.',
  'Quem está em tratamento precisa de acolhimento e flexibilidade.',
  'Acolher uma colega em tratamento também é trabalho do RH.',
  'Se alguém da equipe precisar de apoio, esteja por perto.',
  'Autocuidado não precisa esperar outubro.',
  'O laço rosa é um lembrete: a sua saúde importa.',
  'Prevenir é um jeito de cuidar do seu futuro.',
  'Por trás de cada nome nesta tela existe uma história que merece cuidado.',
];

/** Sorteia uma frase. `aleatorio` injetável para testes determinísticos. */
export function sortearFraseOutubro(aleatorio: () => number = Math.random): string {
  const i = Math.floor(aleatorio() * FRASES_OUTUBRO_ROSA.length);
  return FRASES_OUTUBRO_ROSA[Math.min(Math.max(i, 0), FRASES_OUTUBRO_ROSA.length - 1)];
}

/** Outubro (mês 10) → o enfeite liga sozinho; fora dele, só se o admin ligar. */
export function ehOutubro(hoje: Date = new Date()): boolean {
  return hoje.getMonth() === 9;
}
