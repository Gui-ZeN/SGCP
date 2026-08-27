import { Vaga } from '../types';
import { normalizeKey, numberValue } from './spreadsheetImport';
import { cleanText, formatDateBR, monthAbbrFromDate, yearFromDate } from '../utils/date';
import { lerAbaComCabecalho, listarAbas } from './planilhaUtils';

export { listarAbas };

/**
 * Importação do "Controle de Vagas" — a planilha histórica do RH, com UMA ABA
 * POR ANO (2026, 2025, 2024, 2023).
 *
 * Por que é um módulo separado do `spreadsheetImport`: lá a aba tem nome fixo
 * ("Controle de Vagas") e o arquivo traz vários módulos de uma vez. Aqui o
 * usuário ESCOLHE a aba, e cada ano tem um cabeçalho ligeiramente diferente:
 *
 *  - 2026 não tem a coluna `Etapa` (as outras têm) e o cabeçalho começa na 2ª
 *    linha, porque a 1ª é um lembrete solto ("Usar planilha do DASHBOARD").
 *  - 2023 usa `Cargo` no lugar de `Vaga` e `Observação` no singular.
 *
 * O cabeçalho é achado pelo CONTEÚDO (a primeira linha que traz colunas
 * conhecidas), não por "primeira linha não-vazia": na aba de 2026 a primeira
 * linha preenchida é o lembrete, e adotá-la como cabeçalho fazia o parser ler
 * zero vagas. A leitura de coluna aceita os nomes alternativos, então o mesmo
 * parser serve para todas as abas sem um mapa por ano.
 */

export interface VagaImportada extends Omit<Vaga, 'id' | 'codigo'> {}

export interface PlanoDeImportacao {
  aImportar: VagaImportada[];
  jaExistem: number;
  ignoradas: string[];
}

const STATUS_VALIDOS: Vaga['status'][] = ['ABERTA', 'FECHADA', 'PAUSADA', 'SUSPENSA', 'DOCUMENTAÇÃO', 'REABERTA'];

function normalizarStatus(valor: unknown): Vaga['status'] {
  const texto = cleanText(valor).toUpperCase();
  const achado = STATUS_VALIDOS.find(s => s === texto);
  if (achado) return achado;
  if (texto.startsWith('FECH')) return 'FECHADA';
  if (texto.startsWith('PAUS')) return 'PAUSADA';
  if (texto.startsWith('SUSP')) return 'SUSPENSA';
  if (texto.startsWith('REAB')) return 'REABERTA';
  if (texto.startsWith('DOC')) return 'DOCUMENTAÇÃO';
  return 'ABERTA';
}

function normalizarSexo(valor: unknown): Vaga['sexo'] {
  const texto = cleanText(valor).toUpperCase();
  if (texto.startsWith('MASC')) return 'MASCULINO';
  if (texto.startsWith('FEM')) return 'FEMININO';
  return 'INDIFERENTE';
}

/** Lê uma coluna aceitando nomes alternativos ("Vaga"/"Cargo", "Observações"/"Observação"). */
function coluna(linha: Record<string, unknown>, ...nomes: string[]): unknown {
  for (const nome of nomes) {
    const chave = normalizeKey(nome);
    if (Object.prototype.hasOwnProperty.call(linha, chave)) return linha[chave];
  }
  return null;
}

/** Lê UMA aba e devolve as vagas prontas para gravar (sem `codigo`, atribuído na importação). */
export async function parseVagasDaAba(
  file: File,
  aba: string
): Promise<{ vagas: VagaImportada[]; ignoradas: string[] }> {
  const { registros, primeiraLinha } = await lerAbaComCabecalho(file, aba, ['vaga', 'cargo', 'sede', 'status', 'setor', 'solicitação', 'solicitante']);
  const ignoradas: string[] = [];
  const vagas: VagaImportada[] = [];

  registros.forEach((linha, i) => {
    // Número real da linha na planilha, para o aviso ser conferível pelo RH.
    const nLinha = primeiraLinha + i;
    // `Cargo` é como a aba de 2023 chama a coluna de cargo.
    const vaga = cleanText(coluna(linha, 'Vaga', 'Cargo'));
    if (!vaga) {
      ignoradas.push(`linha ${nLinha}: sem cargo`);
      return;
    }

    const solicitacao = coluna(linha, 'Solicitação');
    if (!formatDateBR(solicitacao)) {
      // Sem data de solicitação a vaga não entra em nenhum indicador de tempo
      // (SLA, tempo de processo, volume por mês) — vira ruído na lista.
      ignoradas.push(`linha ${nLinha}: "${vaga}" sem data de solicitação`);
      return;
    }

    const conclusao = coluna(linha, 'Conclusão');
    const motivo = cleanText(coluna(linha, 'Motivo'));

    vagas.push({
      vaga,
      sede: cleanText(coluna(linha, 'Sede')) || 'DT',
      status: normalizarStatus(coluna(linha, 'Status')),
      setor: cleanText(coluna(linha, 'Setor')) || 'Geral',
      sexo: normalizarSexo(coluna(linha, 'Sexo')),
      solicitacao: formatDateBR(solicitacao),
      solicitante: cleanText(coluna(linha, 'Solicitante')),
      motivo,
      funcionarioSubstituido: cleanText(coluna(linha, 'Funcionário a ser substituído')),
      etapa: cleanText(coluna(linha, 'Etapa')), // ausente na aba de 2026
      aprovado: cleanText(coluna(linha, 'Aprovado')),
      observacoes: cleanText(coluna(linha, 'Observações', 'Observação')),
      responsavel: cleanText(coluna(linha, 'Responsável')) || 'RH',
      conclusao: formatDateBR(conclusao),
      tempoProcesso: numberValue(coluna(linha, 'Tempo do processo')),
      mesSolicitacao: monthAbbrFromDate(solicitacao),
      mesConclusao: monthAbbrFromDate(conclusao),
      categoria: 'Importado',
      tempoSla: numberValue(coluna(linha, 'Tempo do processo')),
      ano: yearFromDate(solicitacao),
      categoriaMotivo: motivo.toLowerCase().includes('aumento') ? 'Aumento de Quadro' : 'Substituição',
    });
  });

  return { vagas, ignoradas };
}

/** Chave de comparação com o que já está no banco. */
function chaveVaga(v: { vaga: string; sede: string; solicitacao: string }): string {
  return `${v.vaga.trim().toLowerCase()}|${v.sede.trim().toLowerCase()}|${v.solicitacao}`;
}

/**
 * Decide o que importar comparando com as vagas já existentes.
 *
 * A comparação é POR CONTAGEM, não por conjunto — e essa é a parte que importa.
 * `vaga+sede+data` NÃO é chave única: abrir 3 ASG na mesma sede no mesmo dia são
 * 3 vagas reais, 3 processos, 3 contratações (um terço das linhas da planilha
 * repete a combinação). Um `if (jáExiste) pula` apagaria vagas de verdade e
 * encolheria o indicador de volume. Então: se a combinação aparece 3× na
 * planilha e 1× no banco, importamos as 2 que faltam.
 */
export function planejarImportacao(
  candidatas: VagaImportada[],
  existentes: Pick<Vaga, 'vaga' | 'sede' | 'solicitacao'>[],
  ignoradas: string[] = []
): PlanoDeImportacao {
  const saldo = new Map<string, number>();
  existentes.forEach(v => {
    const k = chaveVaga(v);
    saldo.set(k, (saldo.get(k) || 0) + 1);
  });

  const aImportar: VagaImportada[] = [];
  let jaExistem = 0;

  candidatas.forEach(c => {
    const k = chaveVaga(c);
    const restante = saldo.get(k) || 0;
    if (restante > 0) {
      saldo.set(k, restante - 1); // consome uma ocorrência já existente
      jaExistem++;
      return;
    }
    aImportar.push(c);
  });

  return { aImportar, jaExistem, ignoradas };
}
