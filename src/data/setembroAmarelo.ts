/**
 * Setembro Amarelo — frases de enfeite para o Início do SGPC.
 *
 * Sistema interno do RH: o tom é leve e acolhedor, sem peso institucional.
 * Uma frase é sorteada a cada abertura do sistema.
 */

export const FRASES_SETEMBRO_AMARELO: string[] = [
  'Perguntar “você está bem?” e esperar a resposta pode mudar o dia de alguém.',
  'Conversar pode mudar vidas.',
  'Falar é a melhor solução. Ouvir também.',
  'Ninguém precisa dar conta de tudo sozinho.',
  'Escutar sem julgar é um cuidado que cabe em qualquer agenda.',
  'Saúde mental não é assunto só de setembro — é o ano inteiro.',
  'Um “como você está?” sincero vale mais do que qualquer indicador.',
  'Pedir ajuda é sinal de coragem, não de fraqueza.',
  'Por trás de cada nome nesta tela existe uma pessoa e uma história.',
  'Reserve um minuto hoje para perguntar a alguém como ele realmente está.',
  'Presença acolhe mais do que conselho.',
  'Um ambiente que escuta é um ambiente que cuida.',
  'Você não precisa ter a resposta certa — basta estar por perto.',
  'Cuidar de quem cuida também é trabalho do RH.',
  'Reservar um tempo para o que te faz bem também é cuidado.',
  'Notar a mudança em alguém e perguntar já é ajudar.',
  'Gentileza no corredor também é política de bem-estar.',
  'Toda vida importa. Inclusive a sua.',
  'Se precisar, peça ajuda.',
  'O melhor da equipe não aparece em relatório: é o cuidado entre as pessoas.',
];

/** Sorteia uma frase. `aleatorio` injetável para testes determinísticos. */
export function sortearFrase(aleatorio: () => number = Math.random): string {
  const i = Math.floor(aleatorio() * FRASES_SETEMBRO_AMARELO.length);
  return FRASES_SETEMBRO_AMARELO[Math.min(Math.max(i, 0), FRASES_SETEMBRO_AMARELO.length - 1)];
}

/** Setembro (mês 9) → o enfeite liga sozinho; fora dele, só se o admin ligar. */
export function ehSetembro(hoje: Date = new Date()): boolean {
  return hoje.getMonth() === 8;
}
