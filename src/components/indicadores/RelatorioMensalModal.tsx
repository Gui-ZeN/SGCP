/**
 * Relatório mensal para exportar (29/10/2026), no modelo do deck "Indicadores
 * de Setembro" que a Universidade montava à mão no Canva. Os números saem do
 * sistema; o que ele não tem (linha do tempo, comunicação, ações, calendário,
 * fotos) o RH escreve aqui na hora.
 *
 * Os textos ficam como RASCUNHO no navegador (decisão do Guilherme): voltam
 * no mês seguinte naquele computador, sem coleção nova no banco. As fotos
 * entram só no PDF — não sobem para lugar nenhum.
 */
import { useEffect, useMemo, useState } from 'react';
import { Printer, AlertTriangle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import type { Vaga, Selecao, Experiencia, Integracao, Treinamento } from '../../types';
import type { Sede } from '../../hooks/useMetadata';
import { escopoDaSede, type Escopo } from '../../utils/unidade';
import { MESES_LONGOS } from '../../utils/filtroIndicadores';
import { dataISOLocal } from '../../utils/date';
import { dadosDoRelatorio } from '../../utils/relatorioMensal';
import { imprimirRelatorio, type TextosDoRelatorio } from '../../utils/relatorioMensalHtml';

interface Props {
  vagas: Vaga[]; selecoes: Selecao[]; experiencias: Experiencia[]; integracoes: Integracao[]; treinamentos: Treinamento[];
  sedes: Sede[];
  mostrarIntegracao: boolean;
  aoFechar: () => void;
}

const ROTULO: Record<Escopo, string> = { colegio: 'Colégio', universidade: 'Universidade' };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Cada texto guardado onde pertence (auditoria, 29/10/2026): linha do tempo por
// ano, comunicação e calendário por mês, o texto do destaque por TEMA — senão o
// parágrafo de setembro saía sob o treinamento de outubro sem ninguém notar.
// Só as ações de R&S passam de um mês para o outro.
interface DoMes { artes: string; emails: string; calendario: string }
const MES_VAZIO: DoMes = { artes: '', emails: '', calendario: '' };
interface Rascunho { linhaDoTempo: Record<number, string[]>; acoes: string; meses: Record<string, DoMes>; destaques: Record<string, string> }
const RASCUNHO_VAZIO: Rascunho = { linhaDoTempo: {}, acoes: '', meses: {}, destaques: {} };
const chave = (u: Escopo) => `sgpc.relatorioMensal.${u}`;
function lerRascunho(u: Escopo): Rascunho {
  try { return { ...RASCUNHO_VAZIO, ...JSON.parse(localStorage.getItem(chave(u)) || '{}') }; } catch { return RASCUNHO_VAZIO; }
}

// Os formatos que a folha embute (HEIC do iPhone, BMP, AVIF ficariam fora do PDF sem aviso).
const TIPOS_DE_FOTO = 'image/png,image/jpeg,image/webp,image/gif';

function lerFotos(arquivos: FileList | null, max: number): Promise<string[]> {
  return Promise.all([...(arquivos || [])].filter(f => TIPOS_DE_FOTO.split(',').includes(f.type)).slice(0, max).map(f => new Promise<string>(ok => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result || ''));
    r.onerror = () => ok('');
    r.readAsDataURL(f);
  }))).then(l => l.filter(Boolean));
}

export function RelatorioMensalModal({ vagas, selecoes, experiencias, integracoes, treinamentos, sedes, mostrarIntegracao, aoFechar }: Props) {
  const hoje = new Date();
  // Abre no mês que acabou de fechar: é o que se apresenta.
  const [ano, setAno] = useState(hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() === 0 ? 12 : hoje.getMonth());

  const unidadeDe = (r: { escopo?: Escopo }, sede?: string) => r.escopo || escopoDaSede(sedes, sede);
  const unidades = useMemo(() => [...new Set([...vagas.map(v => unidadeDe(v, v.sede)), ...selecoes.map(s => unidadeDe(s, s.sede))])].sort() as Escopo[],
    [vagas, selecoes, sedes]);
  const [escolhida, setEscolhida] = useState<Escopo | ''>('');
  const unidade: Escopo = escolhida || (unidades.includes('universidade') ? 'universidade' : unidades[0] || 'colegio');

  const [rascunho, setRascunho] = useState<Rascunho>(() => lerRascunho(unidade));
  const mudar = (f: (r: Rascunho) => Partial<Rascunho>) => setRascunho(r => {
    const novo = { ...r, ...f(r) };
    try { localStorage.setItem(chave(unidade), JSON.stringify(novo)); } catch { /* sem armazenamento: segue sem rascunho */ }
    return novo;
  });
  const linha = rascunho.linhaDoTempo[ano] || Array(12).fill('');
  const chaveMes = `${ano}-${mes}`;
  const doMes = { ...MES_VAZIO, ...rascunho.meses[chaveMes] };
  const mudarMes = (p: Partial<DoMes>) => mudar(r => ({ meses: { ...r.meses, [chaveMes]: { ...MES_VAZIO, ...r.meses[chaveMes], ...p } } }));

  const [destaque, setDestaque] = useState('');
  const [fotosCom, setFotosCom] = useState<string[]>([]);
  const [fotosDest, setFotosDest] = useState<string[]>([]);
  const [fotoEquipe, setFotoEquipe] = useState('');
  const [erro, setErro] = useState('');
  // Foto escolhida pertence à unidade, ao mês (artes) e ao tema (destaque): trocou, sai.
  useEffect(() => { setRascunho(lerRascunho(unidade)); setFotoEquipe(''); }, [unidade]);
  useEffect(() => { setFotosCom([]); }, [unidade, chaveMes]);
  useEffect(() => { setFotosDest([]); }, [unidade, destaque]);
  // Por mês E tema: o mesmo treinamento repetido no mês seguinte começa em branco.
  const chaveDestaque = `${chaveMes}|${destaque}`;
  const destaqueTexto = rascunho.destaques[chaveDestaque] || '';

  const dados = useMemo(() => {
    const daUnidade = <T extends { escopo?: Escopo }>(l: T[], sede: (x: T) => string | undefined) => l.filter(x => unidadeDe(x, sede(x)) === unidade);
    return dadosDoRelatorio({
      ano, mes,
      vagas: daUnidade(vagas, v => v.sede), selecoes: daUnidade(selecoes, s => s.sede), experiencias: daUnidade(experiencias, e => e.sede),
      integracoes: daUnidade(integracoes, i => i.sede), treinamentos: daUnidade(treinamentos, t => t.unidade),
      comIntegracao: mostrarIntegracao && unidade === 'universidade', hojeISO: dataISOLocal(),
    });
  }, [ano, mes, unidade, vagas, selecoes, experiencias, integracoes, treinamentos, mostrarIntegracao, sedes]);
  // O treinamento em destaque segue o mês: troca de mês, volta para o maior.
  useEffect(() => { setDestaque(d => (dados.treinamentos.some(t => t.tema === d) ? d : dados.treinamentos[0]?.tema || '')); }, [dados.treinamentos]);

  const anos = [hoje.getFullYear(), hoje.getFullYear() - 1];
  const mesSeguinte = MESES_LONGOS[mes % 12];

  const exportar = () => {
    const abriu = imprimirRelatorio({
      unidade, logo: `${window.location.origin}/logos/${unidade}.png`, ano, mes, dados,
      textos: { linhaDoTempo: linha, ...doMes, acoes: rascunho.acoes, destaque, destaqueTexto },
      fotos: { comunicacao: fotosCom, destaque: fotosDest, equipe: fotoEquipe },
    });
    setErro(abriu ? '' : 'O navegador bloqueou a janela do relatório. Libere pop-ups para o SGPC e tente de novo.');
  };

  const fotos = (rotulo: string, lista: string[], set: (l: string[]) => void, max: number) => (
    <label className="block">
      <span className="rotulo">{rotulo} {lista.length ? `(${lista.length})` : ''}</span>
      <input type="file" accept={TIPOS_DE_FOTO} multiple={max > 1} className="text-[13px]"
        // Esvazia o campo depois de ler: a contagem fica no rótulo, e a mesma foto pode ser escolhida de novo.
        onChange={e => { lerFotos(e.target.files, max).then(set); e.target.value = ''; }} />
    </label>
  );

  return (
    <Modal titulo="Relatório mensal" largura="lg" aoFechar={aoFechar}
      rodape={<>
        <button type="button" className="btn" onClick={aoFechar}>Fechar</button>
        <button type="button" className="btn btn-primario" onClick={exportar}><Printer aria-hidden="true" />Gerar PDF</button>
      </>}>
      <div className="space-y-5">
        {erro && <p role="alert" className="erro-form">{erro}</p>}
        <div className="filtros">
          {unidades.length > 1 && (
            <select className="campo" aria-label="Unidade" value={unidade} onChange={e => setEscolhida(e.target.value as Escopo)}>
              {unidades.map(u => <option key={u} value={u}>{ROTULO[u]}</option>)}
            </select>
          )}
          <select className="campo" aria-label="Mês" value={mes} onChange={e => setMes(Number(e.target.value))}>
            {MESES_LONGOS.map((m, i) => <option key={m} value={i + 1}>{cap(m)}</option>)}
          </select>
          <select className="campo" aria-label="Ano" value={ano} onChange={e => setAno(Number(e.target.value))}>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <p className="text-[13px]" style={{ color: 'var(--tinta-2)' }}>
          Vagas solicitadas: {dados.vagas.solicitadas} · fechadas: {dados.vagas.fechadas} · convocados: {dados.selecao.total.convocados} ·
          avaliações de experiência: {dados.experiencia.reduce((t, e) => t + e.programadas, 0)} · treinamentos: {dados.treinamentos.length}.
          Os números saem do sistema; os campos abaixo entram como você escrever (vazio = a página não sai).
        </p>

        {dados.avisos.length > 0 && (
          <div role="note" className="text-[13px] space-y-1" style={{ color: 'var(--atraso)' }}>
            <p className="font-semibold flex items-center gap-1.5"><AlertTriangle aria-hidden="true" className="w-4 h-4" />Falta lançar para o relatório bater:</p>
            <ul className="list-disc pl-5">{dados.avisos.map(a => <li key={a}>{a}</li>)}</ul>
          </div>
        )}

        <details>
          <summary className="text-[13px] font-semibold cursor-pointer py-1">Linha do tempo de {ano}</summary>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {MESES_LONGOS.map((m, i) => (
              <label key={m} className="block">
                <span className="text-[12px]" style={{ color: 'var(--tinta-2)' }}>{cap(m)}</span>
                <textarea className="campo w-full" rows={2} value={linha[i] || ''} placeholder="Um evento por linha"
                  onChange={e => { const v = e.target.value; mudar(r => ({ linhaDoTempo: { ...r.linhaDoTempo, [ano]: linha.map((x, j) => (j === i ? v : x || '')) } })); }} />
              </label>
            ))}
          </div>
        </details>

        <details>
          <summary className="text-[13px] font-semibold cursor-pointer py-1">Comunicação</summary>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <label className="block"><span className="rotulo">Artes criadas</span>
              <input className="campo w-full tabular-nums" inputMode="numeric" value={doMes.artes} onChange={e => mudarMes({ artes: e.target.value })} /></label>
            <label className="block"><span className="rotulo">E-mails enviados</span>
              <input className="campo w-full tabular-nums" inputMode="numeric" value={doMes.emails} onChange={e => mudarMes({ emails: e.target.value })} /></label>
          </div>
          <div className="mt-2">{fotos('Artes para mostrar (até 3)', fotosCom, setFotosCom, 3)}</div>
        </details>

        <details>
          <summary className="text-[13px] font-semibold cursor-pointer py-1">Treinamento em destaque</summary>
          {dados.treinamentos.length === 0
            ? <p className="text-[13px] mt-2" style={{ color: 'var(--tinta-3)' }}>Nenhum treinamento lançado neste mês.</p>
            : <div className="space-y-2 mt-2">
                <select className="campo w-full" aria-label="Treinamento em destaque" value={destaque} onChange={e => setDestaque(e.target.value)}>
                  <option value="">Sem página de destaque</option>
                  {dados.treinamentos.map(t => <option key={t.tema} value={t.tema}>{t.tema} · {t.presentes} de {t.previstos}</option>)}
                </select>
                <textarea className="campo w-full" rows={3} placeholder="O que foi feito (um parágrafo por linha)" value={destaqueTexto} disabled={!destaque}
                  onChange={e => { const v = e.target.value; mudar(r => ({ destaques: { ...r.destaques, [chaveDestaque]: v } })); }} />
                {fotos('Fotos (até 2)', fotosDest, setFotosDest, 2)}
              </div>}
        </details>

        <details>
          <summary className="text-[13px] font-semibold cursor-pointer py-1">Ações de R&amp;S</summary>
          <textarea className="campo w-full mt-2" rows={5} placeholder="Uma ação por linha" value={rascunho.acoes} onChange={e => { const v = e.target.value; mudar(() => ({ acoes: v })); }} />
        </details>

        <details>
          <summary className="text-[13px] font-semibold cursor-pointer py-1">Calendário de {mesSeguinte}</summary>
          <textarea className="campo w-full mt-2" rows={3} placeholder={'Uma data por linha, ex.: 12/10 - Dia das Crianças'} value={doMes.calendario}
            onChange={e => mudarMes({ calendario: e.target.value })} />
        </details>

        <details>
          <summary className="text-[13px] font-semibold cursor-pointer py-1">Foto da equipe (encerramento)</summary>
          <div className="mt-2">{fotos('Foto', fotoEquipe ? [fotoEquipe] : [], l => setFotoEquipe(l[0] || ''), 1)}</div>
        </details>
      </div>
    </Modal>
  );
}
