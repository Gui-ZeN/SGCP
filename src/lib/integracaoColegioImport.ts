import { Integracao } from '../types';
import { normalizeKey } from './spreadsheetImport';
import { cleanText, formatDateBR } from '../utils/date';
import { lerAbaComCabecalho, listarAbas } from './planilhaUtils';

export { listarAbas };

/**
 * Import da planilha "Admissão / Integração" do COLÉGIO.
 *
 * Diferente da planilha da Universidade ([integracaoImport.ts]), que tem uma
 * aba por campus com nomes fixos: aqui as abas são por ANO e público
 * ("2026 Geral", "2026 pedagógico", "2025 Geral", "2024"…), então o usuário
 * escolhe a aba — a lista de abas muda a cada ano e um mapa fixo envelheceria.
 *
 * Variações entre as abas, todas resolvidas por leitura por NOME de coluna:
 *  - a sede se chama "Localização/Sede" nas abas Geral e "Locação / Sede" nas
 *    pedagógicas e na de 2024;
 *  - só as pedagógicas têm a coluna "Realizada" (Sim/Não);
 *  - "Total de pessoas integradas" é um total da planilha, preenchido só na 1ª
 *    linha — não é dado da pessoa e é ignorado.
 *
 * A 1ª linha é o título ("Treinamento de Integração"), então o cabeçalho é
 * achado pelo conteúdo, como nos outros importadores com escolha de aba.
 */

/**
 * Sedes da planilha que NÃO existem no cadastro, e para onde vão (decidido com
 * o RH em 28/08/2026). Sem isto viram "sedes" fantasma no filtro.
 *
 * Só entram aqui os rótulos que não resolvem sozinhos: os demais ("DT", "BS",
 * "SUL"…) já são nome ou sigla de sede cadastrada e passam intactos.
 *
 * "Volante" era regime de trabalho, não sede — equipe de Infraestrutura que
 * circulava entre unidades, usada só em 2023/2024.
 */
const SEDE_DA_PLANILHA: Record<string, string> = {
  'kmc2': 'Construtora',
  'pql': 'PARQUELANDIA 1',
  'volante': 'DT',
  'unichristus': 'PARQUE ECOLÓGICO',
};

/** Resolve o rótulo de sede da planilha, ignorando caixa e acento. */
function sedeCanonica(rotulo: string): string {
  const chave = rotulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return SEDE_DA_PLANILHA[chave] || rotulo;
}

export interface IntegracaoImportada extends Omit<Integracao, 'id'> {}

export interface ResumoIntegracoes {
  integracoes: IntegracaoImportada[];
  ignoradas: string[];
}

/** Abas de dados: as de relatório são resumos, não têm pessoas. */
export function ehAbaDeDados(nome: string): boolean {
  const n = normalizeKey(nome);
  return !n.includes(normalizeKey('relatorio')) && !n.includes(normalizeKey('respostas'));
}

/**
 * Status da integração.
 *
 * Nas abas pedagógicas vem explícito em "Realizada" (Sim/Não). Nas Gerais não
 * existe coluna de status: ter data de treinamento É o registro de que a
 * integração aconteceu — a planilha do Colégio só é preenchida depois do fato.
 */
function statusDaLinha(realizada: unknown, dataTreinamento: string): Integracao['status'] {
  const texto = cleanText(realizada).toLowerCase();
  if (texto) {
    if (texto.includes('deslig')) return 'Desligado';
    return texto.startsWith('s') ? 'Realizado' : 'Não realizado';
  }
  return dataTreinamento ? 'Realizado' : 'Não realizado';
}

export async function parseIntegracoesColegio(file: File, aba: string): Promise<ResumoIntegracoes> {
  const { registros, primeiraLinha } = await lerAbaComCabecalho(file, aba, [
    'nome', 'data do treinamento', 'data de admissão', 'setor', 'facilitador',
  ]);

  const integracoes: IntegracaoImportada[] = [];
  const ignoradas: string[] = [];

  registros.forEach((linha, i) => {
    const nLinha = primeiraLinha + i;
    const nome = cleanText(linha[normalizeKey('nome')]);
    if (!nome) { ignoradas.push(`linha ${nLinha}: sem nome`); return; }

    const dataTreinamento = formatDateBR(linha[normalizeKey('data do treinamento')]);
    const sedeCrua = cleanText(linha[normalizeKey('localização/sede')])
      || cleanText(linha[normalizeKey('locação / sede')]);
    const sede = sedeCanonica(sedeCrua);

    integracoes.push({
      nome,
      sede,
      setor: cleanText(linha[normalizeKey('setor')]),
      admissao: formatDateBR(linha[normalizeKey('data de admissão')]),
      responsavel: cleanText(linha[normalizeKey('facilitador')]),
      dataIntegracao: dataTreinamento,
      status: statusDaLinha(linha[normalizeKey('realizada')], dataTreinamento),
    });
  });

  return { integracoes, ignoradas };
}

/** Uma integração é identificada por (nome, sede, admissão). */
function chave(i: Pick<Integracao, 'nome' | 'sede' | 'admissao'>): string {
  return `${i.nome.trim().toLowerCase()}|${(i.sede || '').trim().toLowerCase()}|${i.admissao || ''}`;
}

/**
 * Separa o que entra do que já existe, por CONTAGEM — mesma razão dos outros
 * importadores: homônimos na mesma sede e data não são impossíveis, e colapsar
 * apagaria uma pessoa de verdade.
 */
export function planejarIntegracoes(
  candidatas: IntegracaoImportada[],
  existentes: Pick<Integracao, 'nome' | 'sede' | 'admissao'>[]
): { aImportar: IntegracaoImportada[]; jaExistem: number } {
  const saldo = new Map<string, number>();
  existentes.forEach(e => {
    const k = chave(e);
    saldo.set(k, (saldo.get(k) || 0) + 1);
  });

  const aImportar: IntegracaoImportada[] = [];
  let jaExistem = 0;

  candidatas.forEach(c => {
    const k = chave(c);
    const restante = saldo.get(k) || 0;
    if (restante > 0) { saldo.set(k, restante - 1); jaExistem++; return; }
    aImportar.push(c);
  });

  return { aImportar, jaExistem };
}
