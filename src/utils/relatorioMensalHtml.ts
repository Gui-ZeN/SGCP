/**
 * A folha do relatório mensal (29/10/2026): slides 16:9 no visual do deck que
 * a Universidade fazia no Canva — creme com título laranja para os números de
 * seleção, azul-marinho para pessoas e fechamento. Os números vêm de
 * `dadosDoRelatorio`; o que o sistema não tem (linha do tempo, comunicação,
 * ações, calendário, fotos) o RH escreve na hora de exportar.
 *
 * Duas trocas em relação ao deck, de propósito: a pizza que punha "Convocados"
 * como fatia ao lado das partes virou números (convocados é o todo), e as
 * listas que repetiam o gráfico ao lado sumiram — o valor vai na ponta da barra.
 */
import type { DadosDoRelatorio, Funil, ExperienciaDaSede } from './relatorioMensal';
import type { CumprimentoSede } from './indicadores';
import { MESES_LONGOS } from './filtroIndicadores';
import type { UnidadeDaLista } from './listaPresenca';

export interface TextosDoRelatorio {
  /** Um texto por mês do ano (jan..dez); cada linha vira um item. */
  linhaDoTempo: string[];
  artes: string;
  emails: string;
  /** Uma ação por linha. */
  acoes: string;
  /** Uma data por linha, "12/10 - Dia de Nossa Senhora Aparecida". */
  calendario: string;
  /** Tema do treinamento em destaque ('' = sem a página). */
  destaque: string;
  destaqueTexto: string;
}

export interface FotosDoRelatorio { comunicacao: string[]; destaque: string[]; equipe: string }

export interface EntradaDoRelatorio {
  unidade: UnidadeDaLista;
  /** Endereço absoluto da logo (a janela de impressão não conhece o caminho do app). */
  logo: string;
  ano: number;
  mes: number;
  dados: DadosDoRelatorio;
  textos: TextosDoRelatorio;
  fotos: FotosDoRelatorio;
}

const NOME_DA_UNIDADE: Record<UnidadeDaLista, string> = { colegio: 'Colégio Christus', universidade: 'Universidade Christus' };
const MAX_LINHAS_RANKING = 18;

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const linhas = (s: string) => s.split('\n').map(l => l.trim()).filter(Boolean);
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const fmtPct = (n: number) => `${String(n).replace('.', ',')}%`;
/** Só imagem embutida (FileReader): nada de endereço externo na folha. */
const imagem = (src: string) => (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(src) ? src : '');
const fatias = <T,>(lista: T[], max: number): T[][] => {
  const n = Math.max(1, Math.ceil(lista.length / max)), por = Math.ceil(lista.length / n);
  return Array.from({ length: n }, (_, i) => lista.slice(i * por, (i + 1) * por)).filter(f => f.length);
};

function barrasDoFunil(f: Funil): string {
  const itens: [string, number][] = [['Convocados', f.convocados], ['Ausentes', f.ausentes], ['Presentes', f.presentes], ['Desistentes', f.desistentes]];
  const max = Math.max(1, f.convocados);
  return `<div class="vbar">${itens.map(([, v]) => `<div class="vcol"><div class="vval">${v}</div><div class="vb" style="height:${(v / max) * 100}%"></div></div>`).join('')}</div>
    <div class="vrots">${itens.map(([r]) => `<span>${r}</span>`).join('')}</div>`;
}

function ranking(itens: { rotulo: string; valor: number; texto: string }[], escala: number): string {
  return `<div class="hbar">${itens.map(i => `
    <div class="hl">${esc(i.rotulo)}</div><div class="ht"><span class="hb" style="width:${escala > 0 ? (i.valor / escala) * 100 : 0}%"></span><span class="hv">${esc(i.texto)}</span></div>`).join('')}</div>`;
}

function medidor(p: number): string {
  const arco = Math.PI * 40, cheio = Math.min(100, Math.max(0, p)) / 100 * arco;
  return `<svg class="med" viewBox="0 0 100 56" aria-hidden="true">
    <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="#2C3A7A" stroke-width="12"/>
    <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="#41B8D9" stroke-width="12" stroke-dasharray="${cheio} ${arco}"/>
  </svg>`;
}

function calendario(ano: number, mes: number, destaques: Set<number>): string {
  const dias = new Date(ano, mes, 0).getDate(), inicio = new Date(ano, mes - 1, 1).getDay();
  const cel = [...Array(inicio).fill(''), ...Array.from({ length: dias }, (_, i) => i + 1)];
  return `<div class="cal"><div class="calt">• ${cap(MESES_LONGOS[mes - 1])} •</div><div class="calg">
    ${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => `<b>${d}</b>`).join('')}
    ${cel.map(d => `<span class="${d && destaques.has(d as number) ? 'mk' : ''}">${d}</span>`).join('')}</div></div>`;
}

export function htmlDoRelatorio(r: EntradaDoRelatorio): string {
  const { dados: d, textos: t, fotos } = r;
  const mesNome = cap(MESES_LONGOS[r.mes - 1]);
  const unidade = NOME_DA_UNIDADE[r.unidade];
  const logo = `<img class="logo" src="${esc(r.logo)}" alt="${esc(unidade)}">`;
  const creme = (corpo: string, comLogo = true) => `<section class="s creme">${comLogo ? logo : ''}${corpo}</section>`;
  const marinho = (corpo: string) => `<section class="s marinho"><img class="logo branca" src="${esc(r.logo)}" alt="${esc(unidade)}">${corpo}</section>`;
  const titulo = (txt: string, sub = '') => `<h1>${esc(txt)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}`;
  const s: string[] = [];

  // Capa
  s.push(`<section class="s marinho capa"><img class="logo-capa branca" src="${esc(r.logo)}" alt="${esc(unidade)}">
    <div><span class="pilula">Recursos Humanos</span><h1>Indicadores<br>${esc(mesNome)}</h1><p class="ano">${r.ano}</p></div></section>`);

  // Linha do tempo (só se escreveram algo)
  const tempo = t.linhaDoTempo.map(linhas);
  if (tempo.some(l => l.length)) s.push(creme(`${titulo('Linha do Tempo', String(r.ano))}
    <div class="tempo">${MESES_LONGOS.map((m, i) => `<div class="tm${i + 1 === r.mes ? ' atual' : ''}"><div class="tmn">${cap(m)}</div>
      ${tempo[i].map(x => `<p>${esc(x)}</p>`).join('<i>+</i>')}</div>`).join('')}</div>`));

  // Comunicação
  const artesFotos = fotos.comunicacao.map(imagem).filter(Boolean);
  if (t.artes.trim() || t.emails.trim() || artesFotos.length) s.push(creme(`<h1 class="esq">Comunicação<br>${esc(unidade)}</h1>
    <div class="com">${artesFotos.map(f => `<img src="${f}" alt="">`).join('')}</div>
    <div class="caixa total"><b>TOTAL:</b><div><strong>${esc(t.artes.trim() || '0')}</strong><span>Artes criadas</span></div>
      <div><strong>${esc(t.emails.trim() || '0')}</strong><span>E-mails enviados</span></div></div>`));

  // Recrutamento e Seleção do mês
  s.push(creme(`${titulo(`Recrutamento e Seleção`, mesNome)}
    <div class="caixa tres"><div><strong>${d.vagas.solicitadas}</strong><span>Vagas solicitadas</span></div>
      <div><strong>${d.vagas.fechadas}</strong><span>Vagas fechadas</span></div>
      <div><strong>${d.vagas.mediaDias ?? '—'}</strong><span>Média de dias para fechar uma vaga</span></div></div>`));

  const sel = d.selecao;
  if (sel.total.convocados) {
    for (const grupo of fatias(sel.grupos, 3)) s.push(creme(`${titulo('Recrutamento e Seleção', mesNome)}
      <div class="grupos g${grupo.length}">${grupo.map(g => `<div class="card"><div class="cab">${esc(g.grupo)}</div>${barrasDoFunil(g.total)}
        <ul>${g.cargos.slice(0, 6).map(c => `<li>${esc(c)}</li>`).join('')}${g.cargos.length > 6 ? `<li>+${g.cargos.length - 6} cargos</li>` : ''}</ul></div>`).join('')}</div>`, false));

    const top = sel.cargos.slice(0, MAX_LINHAS_RANKING);
    const resto = sel.cargos.length - top.length;
    const rodapeResto = resto > 0 ? `<p class="nota">+${resto} cargo(s) com menos convocados.</p>` : '';
    s.push(creme(`${titulo('Recrutamento e Seleção', 'algumas considerações')}
      <div class="duas"><div class="numeros">
        <div class="n grande"><strong>${sel.total.convocados}</strong><span>Convocados</span></div>
        <div class="n"><strong>${sel.total.presentes}</strong><span>Presentes</span></div>
        <div class="n"><strong>${sel.total.ausentes}</strong><span>Ausentes</span></div>
        <div class="n"><strong>${sel.total.desistentes}</strong><span>Desistentes</span></div></div>
      <div class="card lista"><div class="cab">Maior índice de convocados</div>
        ${ranking(top.map(c => ({ rotulo: c.cargo, valor: c.convocados, texto: String(c.convocados) })), top[0]?.convocados || 1)}${rodapeResto}</div></div>`, false));

    const taxa = (k: 'presentes' | 'desistentes') => [...sel.cargos].filter(c => c.convocados > 0)
      .map(c => ({ rotulo: c.cargo, p: pct(c[k], c.convocados) })).sort((a, b) => b.p - a.p || a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
    const paginaDeTaxa = (nome: string, k: 'presentes' | 'desistentes', numerador: string) => {
      const todas = taxa(k), lista = todas.slice(0, MAX_LINHAS_RANKING);
      s.push(creme(`${titulo('Recrutamento e Seleção', `Maior índice de ${nome.toLowerCase()}`)}
        <div class="card lista largo">${ranking(lista.map(l => ({ rotulo: l.rotulo, valor: l.p, texto: fmtPct(l.p) })), Math.max(1, lista[0]?.p || 0))}
        ${todas.length > lista.length ? `<p class="nota">+${todas.length - lista.length} cargo(s) com taxa menor.</p>` : ''}</div>
        <div class="formula">Taxa de ${esc(nome)} = <span class="fr"><i>${esc(numerador)}</i><i>Convocados</i></span> × 100</div>`, false));
    };
    paginaDeTaxa('Presença', 'presentes', 'Presentes');
    paginaDeTaxa('Desistência', 'desistentes', 'Desistentes');

    if (sel.total.desistentes) {
      const semMotivo = sel.total.desistentes - sel.motivos.reduce((a, m) => a + m.total, 0);
      const itens = [...sel.motivos.map(m => ({ rotulo: m.name, valor: m.total })), ...(semMotivo > 0 ? [{ rotulo: 'Motivo não lançado', valor: semMotivo }] : [])];
      s.push(creme(`${titulo('Recrutamento e Seleção', 'motivos das desistências')}
        <div class="duas"><div class="numeros"><div class="n grande"><strong>${sel.total.desistentes}</strong><span>Desistências</span></div></div>
        <div class="card lista"><div class="cab">Motivos das desistências</div>
          ${ranking(itens.map(i => ({ rotulo: i.rotulo, valor: i.valor, texto: `${i.valor} (${fmtPct(pct(i.valor, sel.total.desistentes))})` })), Math.max(...itens.map(i => i.valor)))}</div></div>`, false));
    }
  }

  // Experiência
  const cardExp = (e: ExperienciaDaSede) => {
    // Nada venceu ainda (mês corrente): "—", não um 0% que parece atraso.
    const vencidas = e.programadas - e.aVencer, p = pct(e.realizadas, vencidas);
    return `<div class="cardm"><div class="cabm">${esc(e.sede)}</div><dl>
      <dt>Programadas</dt><dd>${e.programadas}</dd><dt>Realizadas</dt><dd>${e.realizadas}</dd>
      <dt>Prorrogadas</dt><dd>${e.prorrogadas}</dd><dt>Efetivadas</dt><dd>${e.efetivadas}</dd>
      <dt>Desligados</dt><dd>${e.desligados}</dd><dt>Pediu desligamento</dt><dd>${e.pediram}</dd>
      <dt>Sem desfecho lançado</dt><dd>${e.semDesfecho}</dd>${e.aVencer ? `<dt>A vencer no mês</dt><dd>${e.aVencer}</dd>` : ''}</dl>${medidor(p)}<div class="medv">${vencidas > 0 ? fmtPct(p) : '—'}</div></div>`;
  };
  for (const grupo of fatias(d.experiencia, 3)) s.push(marinho(`<h1 class="esq branco">Acompanhamento do<br>Período de Experiência</h1>
    <div class="formula clara">Participação = <span class="fr"><i>Realizadas</i><i>Programadas</i></span> × 100</div>
    <div class="cardsm g${grupo.length}">${grupo.map(cardExp).join('')}</div>`));

  // Integração
  if (d.integracao) {
    const barra = (c: CumprimentoSede, grande = false) => `<div class="cardm integ${grande ? ' geral' : ''}"><div class="cabi">${esc(c.sede)}</div>
      <div class="pb"><span style="width:${c.total ? c.pct : 0}%"></span></div><div class="pbv">${c.total ? `${c.pct}%` : 'N/A'}</div>
      <p>Programados: ${c.total}<br>Realizados: ${c.ok}</p></div>`;
    s.push(marinho(`<h1 class="branco">Integração ${esc(mesNome)}</h1>
      <div class="integs">${barra(d.integracao.geral, true)}<div class="integs-sedes">${d.integracao.sedes.map(c => barra(c)).join('')}</div></div>`));
  }

  // Treinamento em destaque
  const dest = d.treinamentos.find(x => x.tema === t.destaque);
  if (dest) {
    const fotosDest = fotos.destaque.map(imagem).filter(Boolean);
    const p = pct(dest.presentes, dest.previstos);
    s.push(marinho(`<div class="dest${fotosDest.length ? '' : ' sem-foto'}"><div class="dest-txt"><h1 class="esq branco">${esc(dest.tema)}</h1>
      ${linhas(t.destaqueTexto).map(x => `<p>${esc(x)}</p>`).join('')}</div>
      <div class="cardm dest-num"><div class="medv topo">${fmtPct(p)}</div>${medidor(p)}
        <p><b>Previstos: ${dest.previstos}</b><br><b>Presentes: ${dest.presentes}</b><br><b>Ausentes: ${Math.max(0, dest.previstos - dest.presentes)}</b></p></div>
      ${fotosDest.length ? `<div class="dest-fotos">${fotosDest.map(f => `<img src="${f}" alt="">`).join('')}</div>` : ''}</div>`));
  }

  // Ações de R&S
  const acoes = linhas(t.acoes);
  if (acoes.length) s.push(marinho(`<h1 class="branco">Ações de R&amp;S</h1><ul class="acoes">${acoes.map(a => `<li>${esc(a)}</li>`).join('')}</ul>`));

  // Calendário do mês seguinte
  const datas = linhas(t.calendario);
  if (datas.length) {
    const mesSeg = r.mes === 12 ? 1 : r.mes + 1, anoSeg = r.mes === 12 ? r.ano + 1 : r.ano;
    const marcados = new Set(datas.map(l => /^(\d{1,2})(?:\/(\d{1,2}))?/.exec(l)).filter(m => m && (!m[2] || Number(m[2]) === mesSeg)).map(m => Number(m![1])));
    s.push(marinho(`<div class="calp"><div><h1 class="esq branco">Calendário<br>${esc(cap(MESES_LONGOS[mesSeg - 1]))}</h1>
      <ul class="datas">${datas.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>${calendario(anoSeg, mesSeg, marcados)}</div>`));
  }

  // Encerramento
  const equipe = imagem(fotos.equipe);
  s.push(`<section class="s marinho fim"${equipe ? ` style="background-image:linear-gradient(rgba(14,22,85,.55),rgba(14,22,85,.55)),url('${equipe}')"` : ''}>
    <h1>Obrigada!</h1><span class="pilula">Recursos Humanos</span></section>`);

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Indicadores ${esc(mesNome)} ${r.ano} — ${esc(unidade)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&display=swap" rel="stylesheet">
<style>
  @page { size: 297mm 167mm; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: Archivo, Arial, Helvetica, sans-serif; color: #12174A; background: #888; }
  .s { width: 297mm; height: 167mm; position: relative; overflow: hidden; padding: 9mm 12mm; page-break-after: always; display: flex; flex-direction: column; }
  .s:last-child { page-break-after: auto; }
  @media screen { .s { margin: 0 auto 6mm; box-shadow: 0 2px 12px rgba(0,0,0,.3); } }
  .creme { background: #FDF8E7; } .marinho { background: #0E1655; color: #fff; }
  .logo { position: absolute; top: 7mm; left: 9mm; height: 11mm; max-width: 50mm; object-fit: contain; }
  .creme .logo { left: auto; right: 9mm; }
  .branca { filter: brightness(0) invert(1); }
  .marinho .logo { left: auto; right: 9mm; opacity: .9; height: 9mm; }
  h1 { margin: 2mm 0 0; text-align: center; color: #EF8507; font-weight: 800; font-size: 12mm; line-height: 1.02; letter-spacing: -.02em; }
  h1.esq { text-align: left; } h1.branco { color: #fff; }
  .sub { margin: 1mm 0 0; text-align: center; color: #EF8507; font-style: italic; font-weight: 600; font-size: 6mm; }
  .pilula { display: inline-block; border: .4mm solid #fff; border-radius: 99mm; padding: 1.5mm 5mm; font-weight: 600; font-size: 4.6mm; }
  .capa { flex-direction: row; align-items: center; justify-content: center; gap: 12mm; }
  .capa h1 { text-align: left; color: #FDF8E7; font-size: 21mm; margin-top: 3mm; } .capa .ano { margin: 2mm 0 0; font-size: 6mm; opacity: .7; }
  .logo-capa { height: 40mm; max-width: 90mm; object-fit: contain; }
  .caixa { border: .5mm solid #12174A; border-radius: 9mm; }
  .tres { margin: auto 8mm; display: grid; grid-template-columns: repeat(3, 1fr); padding: 12mm 6mm; text-align: center; }
  .tres strong, .numeros strong, .total strong { display: block; font-size: 30mm; font-weight: 800; line-height: 1; color: #12174A; }
  .tres span, .numeros span, .total span { display: block; margin-top: 2mm; font-size: 5.2mm; font-weight: 600; color: #3B5689; }
  .grupos { flex: 1; display: grid; gap: 8mm; margin-top: 6mm; min-height: 0; }
  .grupos.g1 { grid-template-columns: minmax(0, 120mm); justify-content: center; } .grupos.g2 { grid-template-columns: repeat(2, minmax(0, 105mm)); justify-content: center; }
  .grupos.g3 { grid-template-columns: repeat(3, 1fr); }
  .card { border: .5mm solid #223A66; border-radius: 7mm; padding: 0 5mm 4mm; position: relative; display: flex; flex-direction: column; min-height: 0; background: #FDF8E7; }
  .cab { align-self: center; margin-top: -4mm; background: #223A66; color: #fff; border-radius: 99mm; padding: 1.8mm 9mm; font-weight: 700; font-size: 5mm; white-space: nowrap; }
  .vbar { height: 62mm; display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5mm; align-items: end; margin-top: 4mm; min-height: 38mm; border-bottom: .3mm solid #C9C3B0; }
  .vcol { height: 100%; display: flex; flex-direction: column; justify-content: flex-end; text-align: center; }
  .vb { background: #4F9FCB; border-radius: 1.2mm 1.2mm 0 0; min-height: .4mm; } .vval { font-weight: 700; font-size: 4mm; margin-bottom: 1mm; }
  .vrots { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5mm; text-align: center; font-size: 3mm; padding-top: 1mm; color: #3B5689; }
  .card ul { margin: 3mm 0 0; padding-left: 5mm; font-weight: 700; font-size: 3.8mm; line-height: 1.35; }
  .duas { flex: 1; display: grid; grid-template-columns: 1fr 1.25fr; gap: 9mm; margin-top: 6mm; min-height: 0; }
  .numeros { display: grid; grid-template-columns: 1fr 1fr; align-content: center; gap: 6mm 4mm; text-align: center; }
  .numeros .grande { grid-column: 1 / -1; } .numeros .n:not(.grande) strong { font-size: 14mm; }
  .lista { padding-top: 3mm; } .lista .cab { margin-top: -6mm; margin-bottom: 2mm; }
  .lista.largo { flex: 1; margin: 6mm 20mm 0; }
  .hbar { display: grid; grid-template-columns: max-content 1fr; gap: .9mm 3mm; align-items: center; font-size: 3.4mm; }
  .hl { text-align: right; font-weight: 700; white-space: nowrap; max-width: 75mm; overflow: hidden; text-overflow: ellipsis; }
  .ht { display: flex; align-items: center; gap: 1.5mm; } .hb { display: block; height: 3.4mm; background: #4F9FCB; border-radius: 0 1mm 1mm 0; min-width: .4mm; }
  .hv { font-weight: 700; white-space: nowrap; }
  .nota { margin: 2mm 0 0; font-size: 3mm; color: #3B5689; }
  .formula { align-self: center; margin-top: 4mm; border: .5mm solid #12174A; border-radius: 99mm; padding: 2mm 7mm; font-weight: 700; font-size: 4.6mm; display: flex; align-items: center; gap: 2mm; }
  .formula.clara { position: absolute; top: 24mm; right: 12mm; border-color: #fff; margin: 0; }
  .fr { display: inline-flex; flex-direction: column; text-align: center; font-size: 3.6mm; } .fr i { font-style: normal; } .fr i:first-child { border-bottom: .4mm solid currentColor; }
  .esq { padding-right: 70mm; }
  .cardsm { display: grid; gap: 10mm; margin: auto 0; padding-top: 6mm; align-items: start; }
  .cardsm.g1 { grid-template-columns: minmax(0, 85mm); justify-content: center; } .cardsm.g2 { grid-template-columns: repeat(2, minmax(0, 85mm)); justify-content: center; }
  .cardsm.g3 { grid-template-columns: repeat(3, 1fr); }
  .cardm { border: .5mm solid #fff; border-radius: 7mm; padding: 0 6mm 3mm; display: flex; flex-direction: column; position: relative; }
  .cabm { align-self: center; margin-top: -4.5mm; background: #fff; color: #EF6A07; border-radius: 99mm; padding: 1.5mm 9mm; font-weight: 800; font-size: 6mm; white-space: nowrap; }
  dl { display: grid; grid-template-columns: 1fr auto; gap: .6mm 3mm; margin: 4mm 0 0; font-weight: 600; font-size: 4mm; } dd { margin: 0; text-align: right; }
  .med { width: 42mm; align-self: center; margin-top: 5mm; } .medv { text-align: center; font-size: 5mm; } .medv.topo { margin-bottom: 2mm; }
  .integs { flex: 1; display: grid; align-content: center; gap: 6mm; margin-top: 5mm; min-height: 0; }
  .integs-sedes { align-items: start; display: grid; grid-template-columns: repeat(auto-fit, minmax(48mm, 1fr)); gap: 5mm; }
  .integ { padding: 3mm 5mm; } .integ.geral { justify-self: center; width: 110mm; }
  .cabi { text-align: center; font-weight: 800; font-size: 4.6mm; letter-spacing: .02em; text-transform: uppercase; }
  .pb { margin-top: 3mm; height: 6mm; border-radius: 99mm; background: #52688F; overflow: hidden; } .pb span { display: block; height: 100%; background: #EF8507; border-radius: 99mm; }
  .geral .pb { height: 10mm; } .pbv { text-align: right; color: #EF8507; font-weight: 800; font-size: 5mm; margin-top: 1mm; }
  .integ p { margin: 1mm 0 0; font-size: 3.8mm; opacity: .9; }
  .dest { flex: 1; display: grid; grid-template-columns: 1.1fr .8fr 1.2fr; gap: 7mm; align-items: center; min-height: 0; }
  .dest.sem-foto { grid-template-columns: 1.4fr .8fr; }
  .dest-txt p { font-size: 4.6mm; line-height: 1.35; margin: 3mm 0 0; } .dest-txt h1 { padding: 0; font-size: 10mm; color: #fff; }
  .dest-num { padding: 5mm; text-align: center; } .dest-num p { font-size: 4.4mm; margin: 2mm 0 0; }
  .dest-fotos { display: grid; gap: 3mm; height: 100%; padding: 4mm 0; } .dest-fotos img { width: 100%; height: 100%; object-fit: cover; border-radius: 3mm; min-height: 0; }
  .com { position: absolute; left: 40mm; right: 85mm; top: 38mm; bottom: 0; display: flex; gap: 5mm; justify-content: center; }
  .com img { height: 100%; max-width: 48%; object-fit: cover; object-position: top; }
  .total { position: absolute; top: 34mm; right: 10mm; width: 70mm; display: grid; grid-template-columns: 1fr 1fr; padding: 4mm; text-align: center; }
  .total b { grid-column: 1 / -1; letter-spacing: .15em; font-size: 5mm; } .total strong { font-size: 14mm; } .total span { font-size: 3.8mm; }
  .tempo { flex: 1; display: grid; grid-template-columns: repeat(6, 1fr); grid-template-rows: 1fr 1fr; gap: 4mm 4mm; margin-top: 6mm; min-height: 0; }
  .tm { text-align: center; font-size: 3.4mm; font-weight: 700; color: #3B5689; overflow: hidden; }
  .tmn { background: #0B4A80; color: #fff; border-radius: 2mm; padding: 2.4mm 0; font-size: 4.4mm; margin-bottom: 2mm; }
  .tm.atual .tmn { background: #EF8507; } .tm p { margin: 0; line-height: 1.25; } .tm i { display: block; font-style: normal; }
  .acoes { margin: auto 0; padding-left: 45mm; font-size: 7mm; line-height: 1.5; }
  .calp { flex: 1; display: grid; grid-template-columns: 1fr 100mm; gap: 10mm; align-items: center; }
  .calp h1 { padding: 0; color: #FDF8E7; font-size: 15mm; } .datas { font-size: 5.4mm; font-weight: 700; line-height: 1.7; padding-left: 5mm; }
  .cal { background: #fff; color: #12304F; padding: 7mm; } .calt { text-align: center; color: #0B5C93; font-size: 7mm; margin-bottom: 3mm; }
  .calg { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1mm; text-align: center; font-size: 5.2mm; }
  .calg b { color: #0B5C93; font-size: 4.4mm; } .calg span { padding: 1mm 0; border-radius: 99mm; } .calg span.mk { background: #0B5C93; color: #fff; font-weight: 800; }
  .fim { align-items: center; justify-content: center; background-size: cover; background-position: center; }
  .fim h1 { color: #fff; font-size: 34mm; margin-bottom: 6mm; }
</style></head><body>${s.join('\n')}</body></html>`;
}

/** Abre o relatório numa janela própria e manda imprimir quando a fonte e as imagens carregarem. */
export function imprimirRelatorio(r: EntradaDoRelatorio): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(htmlDoRelatorio(r));
  w.document.close();
  w.onload = () => { (w.document.fonts?.ready ?? Promise.resolve()).then(() => { w.focus(); w.print(); }); };
  return true;
}
