/**
 * Setembro Amarelo — campanha de prevenção ao suicídio e valorização da vida.
 *
 * Curadoria com cuidado: o tom é de ACOLHIMENTO e ESCUTA (o que cabe a um RH),
 * nunca de conselho fácil ou romantização. O CVV (188, gratuito, 24h) acompanha
 * a campanha porque é o canal oficial de apoio emocional no Brasil.
 */

export const CVV = {
  telefone: '188',
  descricao: 'ligação gratuita, 24h',
  site: 'https://www.cvv.org.br',
};

export const FRASES_SETEMBRO_AMARELO: string[] = [
  'Perguntar “você está bem?” e esperar a resposta pode mudar o dia de alguém.',
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
  'Falar sobre o que dói é o primeiro passo para aliviar o peso.',
  'Cuidar de quem cuida também é trabalho do RH.',
  'Se a dor parecer grande demais para carregar sozinho, o CVV atende 24h no 188.',
];

/** Sorteia uma frase. `aleatorio` injetável para testes determinísticos. */
export function sortearFrase(aleatorio: () => number = Math.random): string {
  const i = Math.floor(aleatorio() * FRASES_SETEMBRO_AMARELO.length);
  return FRASES_SETEMBRO_AMARELO[Math.min(Math.max(i, 0), FRASES_SETEMBRO_AMARELO.length - 1)];
}

/** Setembro (mês 9) → a campanha liga sozinha; fora dele, só se o admin ligar. */
export function ehSetembro(hoje: Date = new Date()): boolean {
  return hoje.getMonth() === 8;
}
