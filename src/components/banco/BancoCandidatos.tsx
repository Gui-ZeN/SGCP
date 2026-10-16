/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Banco de candidatos (16/10/2026): uma linha por PESSOA, com quantas vezes
 * foi chamada e como foi. Dois usos (análise de operação):
 *  - conferir antes de ligar: colar a lista de nomes na busca e ver os
 *    avisos de cada um, inclusive de quem nunca foi chamado;
 *  - "preciso de auxiliar de cantina, quem está no banco?": o filtro No banco
 *    com cargo e sede.
 * Clicar na pessoa abre a ficha (histórico + Nunca mais chamar).
 */
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useBanco } from '../../hooks/useBancoCandidatos';
import { FiltroMultiplo } from '../ui/FiltroMultiplo';
import { normalizarNome } from '../../utils/catalogo';
import { separarTelefone, formatarTelefone, type Pessoa } from '../../utils/bancoCandidatos';
import { SeloBanco } from './SeloBanco';

const LOTE = 150;
type Filtro = 'banco' | 'faltas' | 'nao_chamar' | 'contratada';
const FILTROS: [Filtro, string][] = [['banco', 'No banco'], ['faltas', 'Faltou 2x ou mais'], ['nao_chamar', 'Não chamar'], ['contratada', 'Contratado(a)']];

const ordem = (d?: string) => { const m = String(d || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]) : 0; };

export function BancoCandidatos() {
  const banco = useBanco();
  const [busca, setBusca] = useState('');
  const [filtros, setFiltros] = useState<Filtro[]>([]);
  const [cargos, setCargos] = useState<string[]>([]);
  const [sedesSel, setSedesSel] = useState<string[]>([]);
  const [lote, setLote] = useState(LOTE);
  const pessoas = banco?.pessoas || [];

  const opcoes = useMemo(() => {
    const c = new Set<string>(), s = new Set<string>();
    for (const p of pessoas) for (const x of p.convocacoes) { if (x.cargo) c.add(x.cargo); if (x.sede) s.add(x.sede); }
    const lista = (set: Set<string>) => [...set].sort((a, b) => a.localeCompare(b, 'pt-BR')).map(v => ({ valor: v, rotulo: v }));
    return { cargos: lista(c), sedes: lista(s) };
  }, [pessoas]);

  // Colar vários nomes (um por linha) = conferir uma lista antes de ligar.
  const linhasColadas = busca.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const conferindo = linhasColadas.length > 1;

  const linhas = useMemo(() => {
    if (!banco || conferindo) return [];
    const q = normalizarNome(busca);
    const naoChamar = (p: Pessoa) => !!banco.marcaPara(p.nome, p.telefone);
    return pessoas
      .filter(p => !q || p.nomeNorm.includes(q) || (p.telefone && p.telefone.includes(q.replace(/\D/g, '') || '§')))
      .filter(p => !filtros.length || filtros.some(f =>
        f === 'banco' ? p.noBanco : f === 'faltas' ? p.faltas >= 2 : f === 'contratada' ? p.contratada : naoChamar(p)))
      .filter(p => (!cargos.length || p.convocacoes.some(x => cargos.includes(x.cargo)))
        && (!sedesSel.length || p.convocacoes.some(x => sedesSel.includes(x.sede))))
      .sort((a, b) => ordem(b.convocacoes[0]?.candidato.data) - ordem(a.convocacoes[0]?.candidato.data) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [banco, pessoas, busca, conferindo, filtros, cargos, sedesSel]);

  if (!banco) return null;
  const chamadas2x = pessoas.filter(p => p.vezes >= 2).length;

  return (
    <div className="space-y-4">
      <p className="text-[14px]" style={{ color: 'var(--tinta-2)' }}>
        {pessoas.length.toLocaleString('pt-BR')} pessoas já convocadas · {chamadas2x.toLocaleString('pt-BR')} {chamadas2x === 1 ? 'convocada' : 'convocadas'} 2 vezes ou mais.
        <span style={{ color: 'var(--tinta-3)' }}> Cole uma lista de nomes na busca para conferir antes de ligar.</span>
      </p>

      <div className="filtros">
        <label className="campo-busca" style={{ flex: '1 1 320px' }}>
          <Search aria-hidden="true" />
          <textarea className="campo" rows={conferindo ? Math.min(linhasColadas.length, 8) : 1} value={busca}
            onChange={e => { setBusca(e.target.value); setLote(LOTE); }}
            aria-label="Buscar pessoa por nome ou telefone (ou colar uma lista)"
            placeholder="Nome ou telefone — ou cole uma lista, um por linha" style={{ resize: 'vertical' }} />
        </label>
        {!conferindo && (<>
          {FILTROS.map(([id, r]) => (
            <button key={id} type="button" className="chip" aria-pressed={filtros.includes(id)}
              onClick={() => setFiltros(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id])}>{r}</button>
          ))}
          <FiltroMultiplo rotulo="Cargo" opcoes={opcoes.cargos} selecionados={cargos} onChange={setCargos} />
          <FiltroMultiplo rotulo="Sede" todos="todas" opcoes={opcoes.sedes} selecionados={sedesSel} onChange={setSedesSel} />
        </>)}
      </div>

      <section className="painel overflow-hidden" aria-label="Banco de candidatos">
        {conferindo ? (
          // Conferência de uma lista: cada linha colada, ache-se ou não alguém.
          <table className="tabela tabela-empilha">
            <thead><tr><th scope="col">Nome colado</th><th scope="col">No banco</th></tr></thead>
            <tbody>
              {linhasColadas.map((linha, i) => {
                const { nome, telefone } = separarTelefone(linha);
                const p = banco.pessoaDe(nome, telefone);
                return (
                  <tr key={i} className="cursor-pointer" onClick={() => banco.abrirFicha(nome, telefone)}>
                    <td data-rotulo="Nome colado" className="font-semibold">{nome}{telefone && <span className="sub">{formatarTelefone(telefone)}</span>}</td>
                    <td data-rotulo="No banco">
                      <span>
                        {p ? `${p.vezes} ${p.vezes === 1 ? 'convocação' : 'convocações'} · faltou ${p.faltas}x` : <span style={{ color: 'var(--tinta-3)' }}>nunca convocada</span>}
                        <SeloBanco nome={nome} telefone={telefone} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : linhas.length === 0 ? (
          <p className="text-[14px] text-center py-12" style={{ color: 'var(--tinta-3)' }}>Ninguém com esses filtros.</p>
        ) : (
          <table className="tabela tabela-empilha">
            <thead>
              <tr>
                <th scope="col">Pessoa</th>
                <th scope="col" className="num-col">Convocações</th>
                <th scope="col" className="num-col">Faltou</th>
                <th scope="col" className="num-col">Veio</th>
                <th scope="col">Última vez</th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.slice(0, lote).map(p => {
                const ult = p.convocacoes[0];
                const marca = banco.marcaPara(p.nome, p.telefone);
                return (
                  <tr key={p.chave} className="cursor-pointer" onClick={() => banco.abrirFicha(p.nome, p.telefone)} title="Ver o histórico">
                    <td data-rotulo="Pessoa">
                      <span>
                        <span className="font-semibold">{p.nome}</span>
                        <span className="sub">{p.telefone ? formatarTelefone(p.telefone) : 'sem telefone'}</span>
                      </span>
                    </td>
                    <td className="num-col font-semibold" data-rotulo="Convocações">{p.vezes}</td>
                    <td className="num-col" data-rotulo="Faltou" style={p.faltas >= 2 ? { color: 'var(--atraso)', fontWeight: 700 } : undefined}>{p.faltas}</td>
                    <td className="num-col" data-rotulo="Veio">{p.vieram}</td>
                    <td data-rotulo="Última vez"><span>{ult?.candidato.data}<span className="sub">{[ult?.cargo, ult?.sede].filter(Boolean).join(' · ')}</span></span></td>
                    <td data-rotulo="Situação">
                      <span className="flex flex-wrap gap-1">
                        {marca && <span className="etiqueta etiqueta-atraso">Não chamar</span>}
                        {p.contratada && <span className="etiqueta">Contratado(a)</span>}
                        {p.noBanco && <span className="etiqueta">No banco</span>}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      {!conferindo && linhas.length > lote && (
        <div className="text-center">
          <button type="button" className="btn btn-sm" onClick={() => setLote(n => n + LOTE * 2)}>
            Mostrar mais {Math.min(linhas.length - lote, LOTE * 2)} de {linhas.length.toLocaleString('pt-BR')}
          </button>
        </div>
      )}
    </div>
  );
}
