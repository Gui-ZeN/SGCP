/**
 * Lista de presença para imprimir (29/10/2026), no modelo do papel do RH
 * ("LISTA DE PRESENÇA EM AÇÃO DE DESENVOLVIMENTO"): os nomes já vêm do quadro
 * da Infra (Chromos) e a pessoa só assina; no fim, linhas em branco para quem
 * não estava no quadro. Uma logo para cada unidade.
 *
 * Paginação feita AQUI (linhas por folha fixas), e não pelo navegador: assim o
 * cabeçalho se repete e cada folha diz "Página X de Y" de verdade.
 */
export type UnidadeDaLista = 'colegio' | 'universidade';

export interface DadosDaLista {
  unidade: UnidadeDaLista;
  /** Endereço absoluto da logo (a janela de impressão não conhece o caminho do app). */
  logo: string;
  tema: string;
  instrutor: string;
  data: string;
  local: string;
  horario: string;
  cargaHoraria: string;
  pessoas: { nome: string; setor: string }[];
  emBranco: number;
}

// Cabe numa A4 com o cabeçalho e o rodapé (Observações/Visto) — conferido no PDF.
export const LINHAS_POR_FOLHA = 22;
export const MAX_EM_BRANCO = 60;

const NOME_DA_UNIDADE: Record<UnidadeDaLista, string> = { colegio: 'Colégio Christus', universidade: 'Universidade Christus' };

const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** As linhas da lista, já em folhas: os do quadro e depois as em branco. */
export function folhasDaLista(pessoas: DadosDaLista['pessoas'], emBranco: number, porFolha = LINHAS_POR_FOLHA) {
  const brancas = Math.max(0, Math.min(MAX_EM_BRANCO, Math.floor(emBranco) || 0));
  const linhas = [...pessoas, ...Array.from({ length: brancas }, () => ({ nome: '', setor: '' }))];
  const folhas: { n: number; nome: string; setor: string }[][] = [];
  linhas.forEach((l, i) => {
    if (i % porFolha === 0) folhas.push([]);
    folhas[folhas.length - 1].push({ n: i + 1, ...l });
  });
  return folhas.length ? folhas : [[]];
}

export function htmlDaListaDePresenca(d: DadosDaLista): string {
  const folhas = folhasDaLista(d.pessoas, d.emBranco);
  const total = folhas.length;
  const campo = (rotulo: string, valor: string) => `<span class="r">${rotulo}</span><span class="v">${esc(valor)}</span>`;
  const folha = (linhas: ReturnType<typeof folhasDaLista>[number], pagina: number) => `
  <section class="folha">
    <table class="cab">
      <tr>
        <td class="logo" rowspan="3"><img src="${esc(d.logo)}" alt="${esc(NOME_DA_UNIDADE[d.unidade])}" onerror="this.replaceWith(Object.assign(document.createElement('b'),{textContent:this.alt}))"></td>
        <td class="tit" rowspan="2"><b>RECURSOS HUMANOS</b><br><b>DESENVOLVIMENTO DE PESSOAS</b></td>
        <td class="ctl">Código:</td>
      </tr>
      <tr><td class="ctl">Revisão:</td></tr>
      <tr><td class="tit"><b>LISTA DE PRESENÇA EM AÇÃO DE DESENVOLVIMENTO</b></td><td class="ctl">Data: ${esc(d.data)}<br>Página: ${pagina} de ${total}</td></tr>
    </table>
    <div class="faixa">DADOS DA AÇÃO DE DESENVOLVIMENTO</div>
    <div class="dados">
      <div class="lin">${campo('TEMA DO TREINAMENTO/CURSO:', d.tema)}</div>
      <div class="lin">${campo('INSTRUTOR(ES):', d.instrutor)}<span class="sep"></span>${campo('LOCAL:', d.local)}</div>
      <div class="lin">${campo('DATA:', d.data)}<span class="sep"></span>${campo('HORÁRIO:', d.horario)}<span class="sep"></span>${campo('CARGA HORÁRIA:', d.cargaHoraria)}</div>
    </div>
    <table class="lista">
      <thead><tr><th class="n">Nº</th><th>Nome</th><th>Assinatura</th><th class="s">Setor</th></tr></thead>
      <tbody>${linhas.map(l => `<tr><td class="n">${l.n}</td><td class="nome">${esc(l.nome)}</td><td></td><td class="s">${esc(l.setor)}</td></tr>`).join('')}</tbody>
    </table>
    <table class="rod"><tr><td><b>OBSERVAÇÕES:</b></td><td><b>VISTO DO(S) INSTRUTOR(ES):</b></td></tr></table>
  </section>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Lista de presença — ${esc(d.tema)}</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 10.5pt Arial, Helvetica, sans-serif; color: #000; }
  .folha { page-break-after: always; }
  .folha:last-child { page-break-after: auto; }
  table { width: 100%; border-collapse: collapse; }
  .cab td { border: 1px solid #000; padding: 4px 6px; }
  .cab .logo { width: 26%; text-align: center; } .cab .logo img { max-width: 100%; max-height: 18mm; }
  .cab .tit { text-align: center; font-size: 11pt; } .cab .ctl { width: 20%; font-size: 9.5pt; }
  .faixa { background: #000; color: #fff; text-align: center; font-size: 9pt; letter-spacing: .04em; padding: 2px; margin-top: 4mm;
           -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .dados .lin { display: flex; border-bottom: 1px solid #000; padding: 3px 0; gap: 6px; }
  .dados .r { font-weight: bold; white-space: nowrap; } .dados .v { flex: 1; } .dados .sep { width: 4mm; }
  .lista { margin-top: 4mm; } .lista th, .lista td { border: 1px solid #000; height: 8.2mm; padding: 0 5px; }
  .lista th { background: #eee; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .lista .n { width: 9mm; text-align: center; } .lista .nome { width: 40%; } .lista .s { width: 18%; }
  .rod { margin-top: 5mm; } .rod td { border-top: 1px solid #000; height: 16mm; vertical-align: top; width: 50%; padding: 3px; }
</style></head><body>${folhas.map((f, i) => folha(f, i + 1)).join('')}</body></html>`;
}

/** Abre a lista numa janela própria e manda imprimir quando a logo carregar. */
export function imprimirListaDePresenca(d: DadosDaLista): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(htmlDaListaDePresenca(d));
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
  return true;
}
