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
 *
 * Desde 19/10/2026 a tela parte da BUSCA (ou de um filtro), não da lista de
 * todo mundo: listar todos exigia ler a coleção inteira, 12 mil documentos.
 * O nome busca pelo começo ("mar" acha Maria e Marcos, não "Ana Maria"). O
 * filtro "Faltou 2x ou mais" saiu (decisão do Guilherme) — a falta continua
 * no selo e na ficha de cada pessoa.
 */
import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useBanco } from '../../hooks/useBancoCandidatos';
import { FiltroMultiplo } from '../ui/FiltroMultiplo';
import { normalizarNome } from '../../utils/catalogo';
import { separarTelefone, formatarTelefone, normalizarTelefone, type Pessoa } from '../../utils/bancoCandidatos';
import { SeloBanco } from './SeloBanco';

const LOTE = 150;
type Filtro = 'banco' | 'nao_chamar' | 'contratada';
const FILTROS: [Filtro, string][] = [['banco', 'No banco'], ['nao_chamar', 'Não chamar'], ['contratada', 'Contratado(a)']];

const ordem = (d?: string) => { const m = String(d || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]) : 0; };

/** Uma pessoa da lista: pedir o histórico dela é o que completa os números. */
function LinhaPessoa({ p }: { p: Pessoa }) {
  const banco = useBanco()!;
  // pessoaDe pede ao banco o histórico inteiro do nome (a busca pelo começo
  // traz no máximo 300 convocações, e a última pessoa pode vir pela metade).
  const atual = banco.pessoaDe(p.nome, p.telefone) || p;
  const ult = atual.convocacoes[0];
  const marca = banco.marcaPara(atual.nome, atual.telefone);
  const incompleto = banco.falhouPara(atual.nome, atual.telefone);
  return (
    <tr className="cursor-pointer" onClick={() => banco.abrirFicha(atual.nome, atual.telefone)} title="Ver o histórico">
      <td data-rotulo="Pessoa">
        <span>
          <span className="font-semibold">{atual.nome}</span>
          <span className="sub">{atual.telefone ? formatarTelefone(atual.telefone) : 'sem telefone'}</span>
        </span>
      </td>
      <td className="num-col font-semibold" data-rotulo="Convocações">{atual.vezes}</td>
      <td className="num-col" data-rotulo="Faltou" style={atual.faltas >= 2 ? { color: 'var(--atraso)', fontWeight: 700 } : undefined}>{atual.faltas}</td>
      <td className="num-col" data-rotulo="Veio">{atual.vieram}</td>
      <td data-rotulo="Última vez"><span>{ult?.candidato.data}<span className="sub">{[ult?.cargo, ult?.sede].filter(Boolean).join(' · ')}</span></span></td>
      <td data-rotulo="Situação">
        <span className="flex flex-wrap gap-1">
          {marca && <span className="etiqueta etiqueta-atraso">Não chamar</span>}
          {incompleto && <span className="etiqueta" title="Não deu para ler o histórico inteiro agora; tenta de novo sozinho">Histórico incompleto</span>}
          {atual.contratada && <span className="etiqueta">Contratado(a)</span>}
          {atual.noBanco && <span className="etiqueta">No banco</span>}
        </span>
      </td>
    </tr>
  );
}

export function BancoCandidatos() {
  const banco = useBanco();
  const [busca, setBusca] = useState('');
  const [filtros, setFiltros] = useState<Filtro[]>([]);
  const [cargos, setCargos] = useState<string[]>([]);
  const [sedesSel, setSedesSel] = useState<string[]>([]);
  const [lote, setLote] = useState(LOTE);
  const [erro, setErro] = useState('');
  // A busca pelo começo do nome traz no máximo 300 convocações: bateu, avisa.
  const [cortada, setCortada] = useState(false);
  const pessoas = banco?.pessoas || [];

  // Colar vários nomes (um por linha) = conferir uma lista antes de ligar.
  const linhasColadas = busca.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const conferindo = linhasColadas.length > 1;
  const q = conferindo ? '' : normalizarNome(busca);
  const tel = conferindo ? '' : normalizarTelefone(busca);
  const buscandoTexto = !!tel || q.replace(/[^\p{L}]/gu, '').length >= 3;
  const ativo = buscandoTexto || filtros.length > 0;
  // A falha da busca vem do provedor, e não só do `erro` desta tela: digitar
  // apaga o `erro`, e com ele a tela dizia "Ninguém" para quem está no banco
  // (auditoria de 19/10/2026). Quando a espera de 30 s acaba, vira false e o
  // efeito abaixo busca de novo sozinho.
  const falhaDaBusca = !!banco && buscandoTexto && (tel ? banco.falhouPara('', tel) : banco.buscaFalhou(q));
  const erroVisivel = erro || (falhaDaBusca ? 'Não foi possível buscar agora. Tenta de novo sozinho em instantes.' : '');

  // Vai ao banco: o nome digitado (depois de parar de digitar) e cada filtro
  // escolhido. Tudo fica na sessão — voltar ao filtro não relê.
  useEffect(() => {
    if (!banco || conferindo || !buscandoTexto) return;
    const t = setTimeout(() => {
      setCortada(false);
      if (tel) banco.pessoaDe('', tel);
      else banco.procurar(q).then(completa => setCortada(!completa)).catch(() => setErro('Não foi possível buscar agora. Tente de novo.'));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Telefone: a falha só sai quando uma leitura dá certo — é a `tentativa`
    // (30 s depois) que faz buscar de novo sozinho, como o aviso promete.
  }, [q, tel, conferindo, falhaDaBusca, tel && falhaDaBusca ? banco?.tentativa : 0]);
  useEffect(() => {
    if (!banco) return;
    for (const f of filtros) {
      if (f === 'banco') banco.carregarSituacao('banco').catch(() => setErro('Não foi possível carregar quem está no banco.'));
      if (f === 'contratada') banco.carregarSituacao('sim').catch(() => setErro('Não foi possível carregar os contratados.'));
      // "Não chamar": as marcas já estão na tela; o histórico de cada uma vem pelo nome.
      if (f === 'nao_chamar') for (const m of banco.marcas) if (!m.desfeito) banco.pessoaDe(m.nome, m.telefone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.join(','), banco?.marcas]);

  const linhas = useMemo(() => {
    if (!banco || conferindo || !ativo) return [];
    const naoChamar = (p: Pessoa) => !!banco.marcaPara(p.nome, p.telefone);
    return pessoas
      .filter(p => !buscandoTexto || (tel ? p.telefone === tel : p.nomeNorm.startsWith(q)))
      .filter(p => !filtros.length || filtros.some(f =>
        f === 'banco' ? p.noBanco : f === 'contratada' ? p.contratada : naoChamar(p)))
      .filter(p => (!cargos.length || p.convocacoes.some(x => cargos.includes(x.cargo)))
        && (!sedesSel.length || p.convocacoes.some(x => sedesSel.includes(x.sede))))
      .sort((a, b) => ordem(b.convocacoes[0]?.candidato.data) - ordem(a.convocacoes[0]?.candidato.data) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [banco, pessoas, conferindo, ativo, buscandoTexto, tel, q, filtros, cargos, sedesSel]);

  // Cargo e sede: das pessoas que a busca/filtro trouxe.
  const opcoes = useMemo(() => {
    const c = new Set<string>(), s = new Set<string>();
    const base = pessoas.filter(p => !buscandoTexto || (tel ? p.telefone === tel : p.nomeNorm.startsWith(q)));
    for (const p of base) for (const x of p.convocacoes) { if (x.cargo) c.add(x.cargo); if (x.sede) s.add(x.sede); }
    const lista = (set: Set<string>) => [...set].sort((a, b) => a.localeCompare(b, 'pt-BR')).map(v => ({ valor: v, rotulo: v }));
    return { cargos: lista(c), sedes: lista(s) };
  }, [pessoas, buscandoTexto, tel, q]);

  if (!banco) return null;

  return (
    <div className="space-y-4">
      <p className="text-[14px]" style={{ color: 'var(--tinta-2)' }}>
        Busque pelo começo do nome ou pelo telefone, ou escolha um filtro.
        <span style={{ color: 'var(--tinta-3)' }}> Cole uma lista de nomes, um por linha, para conferir antes de ligar.</span>
      </p>

      <div className="filtros">
        <label className="campo-busca" style={{ flex: '1 1 320px' }}>
          <Search aria-hidden="true" />
          <textarea className="campo" rows={conferindo ? Math.min(linhasColadas.length, 8) : 1} value={busca}
            onChange={e => { setBusca(e.target.value); setLote(LOTE); setErro(''); }}
            aria-label="Buscar pessoa por nome ou telefone (ou colar uma lista)"
            placeholder="Nome ou telefone — ou cole uma lista, um por linha" style={{ resize: 'vertical' }} />
        </label>
        {!conferindo && (<>
          {FILTROS.map(([id, r]) => (
            <button key={id} type="button" className="chip" aria-pressed={filtros.includes(id)}
              onClick={() => { setErro(''); setFiltros(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id]); }}>{r}</button>
          ))}
          <FiltroMultiplo rotulo="Cargo" opcoes={opcoes.cargos} selecionados={cargos} onChange={setCargos} />
          <FiltroMultiplo rotulo="Sede" todos="todas" opcoes={opcoes.sedes} selecionados={sedesSel} onChange={setSedesSel} />
        </>)}
      </div>

      {erroVisivel && <p className="text-[13px]" role="alert" style={{ color: 'var(--atraso)' }}>{erroVisivel}</p>}
      {cortada && buscandoTexto && !conferindo && (
        <p className="text-[13px]" role="status" style={{ color: 'var(--tinta-3)' }}>
          Muitos nomes começam assim: a lista mostra só parte deles. Digite mais do nome para achar a pessoa.
        </p>
      )}

      <section className="painel overflow-hidden" aria-label="Banco de candidatos" aria-busy={banco.procurando}>
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
                        {/* Consulta que falhou: nem "nunca convocada" nem um número pela metade. */}
                        {banco.falhouPara(nome, telefone) ? <span style={{ color: 'var(--atraso)' }}>não deu para consultar</span>
                          : p ? `${p.vezes} ${p.vezes === 1 ? 'convocação' : 'convocações'} · faltou ${p.faltas}x`
                          : <span style={{ color: 'var(--tinta-3)' }}>{banco.procurando ? 'procurando…' : 'nunca convocada'}</span>}
                        <SeloBanco nome={nome} telefone={telefone} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : !ativo ? (
          <p className="text-[14px] text-center py-12" style={{ color: 'var(--tinta-3)' }}>
            Digite ao menos 3 letras do nome, um telefone com DDD, ou escolha um filtro.
          </p>
        ) : linhas.length === 0 ? (
          <p className="text-[14px] text-center py-12" style={{ color: 'var(--tinta-3)' }} role="status">
            {banco.procurando ? 'Procurando…' : erroVisivel ? 'Não deu para consultar o banco agora.' : 'Ninguém com esses filtros.'}
          </p>
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
              {linhas.slice(0, lote).map(p => <LinhaPessoa key={p.chave} p={p} />)}
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
