/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Módulo Seleções — a planilha de Seleções dentro do sistema (23/09/2026:
 * "daqui para frente elas lançam só no sistema").
 *
 * Um dia de seleção por linha, como a aba QUANTI, com a linha de TOTAL; ao
 * clicar, os dados da seleção (editáveis) e os candidatos, como a aba nominal.
 * O Resumo do Dia continua sendo a visão "de hoje" — os dois usam `selecoes`.
 */
import React, { useMemo, useState } from 'react';
import type { Selecao, Candidato, Vaga } from '../types';
import type { Sede } from '../hooks/useMetadata';
import { ehRealizada, codigosDasVagas } from '../utils/selecao';
import { formatDateBR, toISOInput, dataISOLocal } from '../utils/date';
import {
  opcoesDeSede, naSede, siglaDaSede, anoMes, anosDosDados, MESES_LONGOS,
} from '../utils/filtroIndicadores';
import { normalizarNome } from '../utils/catalogo';
import { CandidatosPlanilha } from './CandidatosPlanilha';
import { ModalSelecao, formularioDaVaga, formularioVazio, sugestoesDeSelecoes } from './selecoes/ModalSelecao';
import { Plus, Search } from 'lucide-react';
import { FiltroMultiplo } from './ui/FiltroMultiplo';
import { Atalho, LinkVaga } from './ui/Atalhos';

type Dados = Pick<Candidato, 'nome' | 'resultado' | 'contratado' | 'motivo' | 'observacao'>;

interface Props {
  selecoes: Selecao[];
  sedes: Sede[];
  /** O Quadro de Vagas — para ligar a seleção às vagas que ela atende. */
  vagas?: Vaga[];
  /** Abrir esta seleção já filtrada nos candidatos (vindo do Quadro de Vagas). */
  foco?: { id: string; token: number } | null;
  /** Abrir o formulário de nova seleção já com esta vaga marcada (vindo dos detalhes da vaga). */
  novaParaVaga?: { vagaId: string; token: number } | null;
  setores?: string[];
  sedePadrao?: string;
  responsavelPadrao?: string;
  /** Ausente = somente leitura (Visualizador). */
  salvarSelecao?: (campos: Omit<Selecao, 'id'>, id?: string) => Promise<void>;
  /** Criar seleção pelo formulário único (com os nomes, se vierem). */
  criarSelecao?: (campos: Omit<Selecao, 'id'>, nomes: string[]) => Promise<void>;
  candidatos?: Candidato[];
  salvarCandidato?: (selecao: Selecao, dados: Dados, id?: string) => Promise<void>;
  registrarCandidatos?: (selecao: Selecao, nomes: string[]) => Promise<void>;
  removerCandidato?: (selecao: Selecao, id: string) => Promise<void>;
  confirmAction?: (titulo: string, mensagem: string, onConfirm: () => void | Promise<void>) => void;
  /** Excluir uma seleção AGENDADA (só Administrador e Coordenador recebem). */
  excluirSelecao?: (selecao: Selecao) => void;
}

const ordem = (d: string) => { const am = anoMes(d); return am ? am[0] * 10000 + am[1] * 100 + Number(d.slice(0, 2)) : 0; };

export const SelecoesModulo: React.FC<Props> = ({
  selecoes, sedes, vagas = [], foco, novaParaVaga, setores = [], sedePadrao = '', responsavelPadrao = '', salvarSelecao, criarSelecao,
  candidatos, salvarCandidato, registrarCandidatos, removerCandidato, confirmAction, excluirSelecao,
}) => {
  // ── filtros ──
  const anos = useMemo(() => anosDosDados(selecoes.map(s => s.data)), [selecoes]);
  const anoAtual = new Date().getFullYear();
  // Todo filtro é de múltipla escolha (regra de 08/10/2026). Lista vazia = todos.
  const [anosSel, setAnosSel] = useState<string[]>([String(anoAtual)]);
  const [mesesSel, setMesesSel] = useState<string[]>([]);
  const [sedesSel, setSedesSel] = useState<string[]>([]);
  const [origens, setOrigens] = useState<Selecao['origem'][]>([]);
  const [busca, setBusca] = useState('');
  // As duas abas da planilha: QUANTI (um dia por linha) e a nominal (uma
  // pessoa por linha).
  const [visao, setVisao] = useState<'selecoes' | 'candidatos'>('selecoes');
  const opcoes = useMemo(() => opcoesDeSede(sedes, selecoes.map(s => s.sede)), [sedes, selecoes]);
  const daSede = useMemo(() => {
    const testes = sedesSel.map(v => naSede(sedes, v));
    return (rotulo?: string) => !testes.length || testes.some(t => t(rotulo));
  }, [sedes, sedesSel]);
  const noPeriodo = (data: string) => {
    if (!anosSel.length && !mesesSel.length) return true;
    const am = anoMes(data);
    if (!am) return false;
    return (!anosSel.length || anosSel.includes(String(am[0]))) && (!mesesSel.length || mesesSel.includes(String(am[1])));
  };

  const filtradas = useMemo(
    () => selecoes.filter(s => noPeriodo(s.data) && daSede(s.sede) && (!origens.length || origens.includes(s.origem))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selecoes, anosSel, mesesSel, daSede, origens]
  );
  const linhas = useMemo(() => {
    const q = normalizarNome(busca);
    return filtradas
      .filter(s => !q || normalizarNome([s.cargo, s.setor, s.gestor, s.responsavel, s.sede].join(' ')).includes(q))
      .sort((a, b) => ordem(b.data) - ordem(a.data) || a.cargo.localeCompare(b.cargo, 'pt-BR'));
  }, [filtradas, busca]);

  // Total só das REALIZADAS — o mesmo recorte do painel de Indicadores. Somar
  // convocados de agendada e presença só de realizada daria dois números
  // diferentes para o mesmo mês em duas telas.
  const total = useMemo(() => {
    const feitas = linhas.filter(ehRealizada);
    const soma = (k: 'convocados' | 'compareceram' | 'ausentes' | 'desistiram' | 'contratados') => feitas.reduce((t, s) => t + (Number(s[k]) || 0), 0);
    return { feitas: feitas.length, agendadas: linhas.length - feitas.length,
      convocados: soma('convocados'), compareceram: soma('compareceram'), ausentes: soma('ausentes'), desistiram: soma('desistiram'), contratados: soma('contratados') };
  }, [linhas]);

  const porSelecao = useMemo(() => {
    const m = new Map<string, Candidato[]>();
    for (const c of candidatos || []) (m.get(c.selecaoId) || m.set(c.selecaoId, []).get(c.selecaoId)!).push(c);
    return m;
  }, [candidatos]);

  // ── edição ──
  const [aberta, setAberta] = useState<'nova' | null>(null);
  // Clicar numa seleção leva aos CANDIDATOS dela (a aba de nomes filtrada) —
  // é para lá que se vai quase sempre: lançar nomes e resultados.
  const [filtroSel, setFiltroSel] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const selFiltrada = filtroSel ? selecoes.find(s => s.id === filtroSel) : undefined;
  const abrirCandidatos = (id: string) => {
    setFiltroSel(id); setEditando(false); setVisao('candidatos');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  // Veio do Quadro de Vagas ("Ver candidatos" numa seleção da vaga).
  React.useEffect(() => { if (foco?.id) abrirCandidatos(foco.id); }, [foco?.token]);
  // "Nova seleção para esta vaga": o formulário já abre com sede, cargo, setor,
  // gestor e a vaga marcada — o RH não redigita o que o sistema já sabe.
  const [vagaDaNova, setVagaDaNova] = useState<Vaga | null>(null);
  React.useEffect(() => {
    if (!novaParaVaga?.vagaId || !criarSelecao) return;
    const v = vagas.find(x => x.id === novaParaVaga.vagaId);
    if (!v) return;
    setVagaDaNova(v); setAberta('nova'); setVisao('selecoes'); setFiltroSel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novaParaVaga?.token, vagas.length]);

  /** Salvar com os CÓDIGOS das vagas junto dos ids — o Quadro também casa por código. */
  const comCodigos = (campos: Omit<Selecao, 'id'>) => ({
    ...campos,
    vagaCodigos: (campos.vagaIds || []).map(id => Number(vagas.find(v => v.id === id)?.codigo)).filter(n => Number.isFinite(n)),
  });

  const sugestoes = useMemo(() => sugestoesDeSelecoes(selecoes, setores), [selecoes, setores]);

  return (
    <div className="space-y-5">
      <header className="pagina-cab">
        <div>
          <p className="pagina-trilha">Recrutamento › Seleções</p>
          <h2 className="pagina-titulo">Seleções</h2>
        </div>
        <div className="pagina-acoes">
          <div className="seg" role="group" aria-label="O que mostrar">
            {([['selecoes', 'Um dia por linha'], ['candidatos', 'Candidatos']] as const).map(([id, r]) => (
              <button key={id} type="button" aria-pressed={visao === id} onClick={() => { setVisao(id); setFiltroSel(null); }}>{r}</button>
            ))}
          </div>
          {criarSelecao && (
            <button type="button" className="btn btn-primario" onClick={() => { setVagaDaNova(null); setAberta('nova'); }}><Plus />Nova seleção</button>
          )}
        </div>
      </header>

      {aberta === 'nova' && criarSelecao && (
        <ModalSelecao
          key={vagaDaNova?.id || 'nova'}
          titulo={vagaDaNova ? `Nova seleção para a vaga nº ${vagaDaNova.codigo}` : 'Nova seleção'}
          inicial={vagaDaNova
            ? formularioDaVaga(vagaDaNova, { data: formatDateBR(dataISOLocal()), responsavel: responsavelPadrao })
            : formularioVazio({ data: formatDateBR(dataISOLocal()), sede: sedePadrao, responsavel: responsavelPadrao })}
          sedes={sedes} vagas={vagas} sugestoes={sugestoes}
          comNomes
          onSalvar={criarSelecao}
          aoFechar={() => { setAberta(null); setVagaDaNova(null); }}
        />
      )}

      <div className="filtros">
        <FiltroMultiplo
          rotulo="Ano"
          opcoes={[...new Set([anoAtual, ...anos])].sort((a, b) => b - a).map(a => ({ valor: String(a), rotulo: String(a) }))}
          selecionados={anosSel}
          onChange={setAnosSel}
        />
        <FiltroMultiplo
          rotulo="Mês"
          opcoes={MESES_LONGOS.map((m, i) => ({ valor: String(i + 1), rotulo: m.charAt(0).toUpperCase() + m.slice(1) }))}
          selecionados={mesesSel}
          onChange={setMesesSel}
        />
        <FiltroMultiplo rotulo="Sede" todos="todas" opcoes={opcoes} selecionados={sedesSel} onChange={setSedesSel} />
        {([['geral', 'Geral'], ['pedagogico', 'Pedagógico']] as const).map(([id, r]) => (
          <button key={id} type="button" className="chip" aria-pressed={origens.includes(id)}
            title={`Planilha ${r}`}
            onClick={() => setOrigens(o => o.includes(id) ? o.filter(x => x !== id) : [...o, id])}>
            {r}
          </button>
        ))}
        <label className="campo-busca">
          <Search aria-hidden="true" />
          <input type="search" className="campo" value={busca} onChange={e => setBusca(e.target.value)}
            aria-label="Buscar"
            placeholder={visao === 'candidatos' ? 'Nome, cargo, setor, gestor, RH' : 'Cargo, setor, gestor, responsável'} />
        </label>
      </div>

      {visao === 'candidatos' ? (<>
        {selFiltrada && (
          <div className="painel px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px]" style={{ color: 'var(--tinta-3)' }}>Candidatos da seleção</p>
              <p className="text-[15px] font-bold" style={{ color: 'var(--tinta)' }}>
                {selFiltrada.data} · {selFiltrada.cargo} · {siglaDaSede(sedes, selFiltrada.sede) || 'sem sede'}
                <span className="font-medium" style={{ color: 'var(--tinta-3)' }}> · {selFiltrada.origem === 'pedagogico' ? 'Pedagógico' : 'Geral'}{selFiltrada.gestor ? ` · gestor ${selFiltrada.gestor}` : ''}</span>
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                {codigosDasVagas(selFiltrada).length > 0 && (
                  <span className="links-vaga" aria-label="Vagas que esta seleção atende">
                    {codigosDasVagas(selFiltrada).map(c => <LinkVaga key={c} codigo={c} />)}
                  </span>
                )}
                <Atalho para="selecoes" params={{ dia: toISOInput(selFiltrada.data) }}>Ver o dia no Resumo do Dia</Atalho>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {salvarSelecao && (
                <button type="button" className="btn" onClick={() => setEditando(v => !v)} aria-expanded={editando}>
                  {editando ? 'Fechar dados' : 'Editar dados da seleção'}
                </button>
              )}
              <button type="button" className="btn" onClick={() => { setFiltroSel(null); setEditando(false); }}>
                Ver todos os candidatos
              </button>
              {excluirSelecao && !ehRealizada(selFiltrada) && (
                <button type="button" className="btn btn-perigo" onClick={() => excluirSelecao(selFiltrada)}>
                  Excluir seleção
                </button>
              )}
            </div>
          </div>
        )}
        {selFiltrada && editando && salvarSelecao && (
          <ModalSelecao
            key={`form-${selFiltrada.id}`}
            titulo="Dados da seleção"
            antes={<span>{selFiltrada.cargo} · {selFiltrada.data}</span>}
            numerosDaLista={!!selFiltrada.numerosPelaLista}
            inicial={formularioVazio({
              data: selFiltrada.data, cargo: selFiltrada.cargo, sede: selFiltrada.sede, origem: selFiltrada.origem,
              setor: selFiltrada.setor || '', gestor: selFiltrada.gestor || '', responsavel: selFiltrada.responsavel || '',
              convocados: selFiltrada.convocados, jaAconteceu: ehRealizada(selFiltrada),
              compareceram: selFiltrada.compareceram, ausentes: selFiltrada.ausentes, desistiram: selFiltrada.desistiram, contratados: selFiltrada.contratados,
              vagaIds: selFiltrada.vagaIds || (selFiltrada.vagaId ? [selFiltrada.vagaId] : []),
            })}
            sedes={sedes} vagas={vagas} sugestoes={sugestoes}
            onSalvar={async campos => {
              // Seleção com lista: os números são da lista — o formulário só
              // mexe nos dados da linha, nunca sobrescreve a contagem.
              const { convocados, compareceram, ausentes, desistiram, contratados, status, ...dados } = campos;
              await salvarSelecao(comCodigos(selFiltrada.numerosPelaLista ? dados as any : campos), selFiltrada.id);
            }}
            aoFechar={() => setEditando(false)}
          />
        )}
        <CandidatosPlanilha
          // Chave com prefixo: o formulário ao lado usa o mesmo id da seleção, e
          // duas irmãs com a mesma chave fazem o React deixar o formulário velho
          // na tela (visto no teste: "Ver todos" não fechava os dados).
          key={`lista-${filtroSel || 'todos'}`}
          selecoes={selFiltrada ? [selFiltrada] : filtradas} busca={busca} candidatos={candidatos || []} sedes={sedes}
          soPedagogico={selFiltrada ? selFiltrada.origem === 'pedagogico' : origens.length === 1 && origens[0] === 'pedagogico'}
          onSalvar={salvarCandidato} onRegistrar={registrarCandidatos} onRemover={removerCandidato}
          onNovaSelecao={criarSelecao ? () => { setVagaDaNova(null); setAberta('nova'); } : undefined}
          confirmAction={confirmAction}
        />
      </>) : (<>
      <section className="painel overflow-hidden" aria-label="Seleções">
        {linhas.length === 0 ? (
          <p className="text-[14px] text-center py-12" style={{ color: 'var(--tinta-3)' }}>Nenhuma seleção com esses filtros.</p>
        ) : (
          // Sem rolagem de lado (regra de 08/10/2026): sede, setor, gestor e RH
          // viram a 2ª linha do cargo; em tela estreita cada linha vira cartão.
          <table className="tabela tabela-empilha">
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Cargo</th>
                <th scope="col">Vaga</th>
                <th scope="col" className="num-col">Convocados</th>
                <th scope="col" className="num-col">Vieram</th>
                <th scope="col" className="num-col">Faltaram</th>
                <th scope="col" className="num-col">Desistiram</th>
                <th scope="col" className="num-col">Contratados</th>
                <th scope="col" className="num-col">Nomes</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(s => {
                const feita = ehRealizada(s);
                const n = porSelecao.get(s.id)?.length || 0;
                const numero = (v: number) => (feita ? v : '—');
                const codigos = codigosDasVagas(s);
                const detalhe = [siglaDaSede(sedes, s.sede), s.setor, s.gestor && `gestor ${s.gestor}`, s.responsavel && `RH ${s.responsavel}`].filter(Boolean).join(' · ');
                return (
                  <tr key={s.id} onClick={() => abrirCandidatos(s.id)} title="Ver os candidatos desta seleção" className="cursor-pointer">
                    <td className="whitespace-nowrap" data-rotulo="Data">
                      <span>
                        <button type="button" className="font-semibold hover:underline"
                          onClick={e => { e.stopPropagation(); abrirCandidatos(s.id); }} aria-label={`Candidatos da seleção de ${s.cargo}, ${s.data}`}>
                          {s.data}
                        </button>
                        {!feita && <span className="etiqueta ml-2">Agendada</span>}
                      </span>
                    </td>
                    <td data-rotulo="Cargo">
                      <span>
                        <span className="font-semibold">{s.cargo}</span>
                        {s.origem === 'pedagogico' && <span className="etiqueta ml-2">Pedagógico</span>}
                        {detalhe && <span className="sub">{detalhe}</span>}
                      </span>
                    </td>
                    <td data-rotulo="Vaga">{codigos.length ? <span className="links-vaga">{codigos.map(c => <LinkVaga key={c} codigo={c} />)}</span> : <span style={{ color: 'var(--tinta-3)' }}>sem vaga</span>}</td>
                    <td className="num-col font-semibold" data-rotulo="Convocados">{s.convocados}</td>
                    <td className="num-col" data-rotulo="Vieram">{numero(s.compareceram)}</td>
                    <td className="num-col" data-rotulo="Faltaram">{numero(s.ausentes)}</td>
                    <td className="num-col" data-rotulo="Desistiram">{numero(s.desistiram)}</td>
                    <td className="num-col" data-rotulo="Contratados">{s.origem === 'pedagogico' && !s.numerosPelaLista ? '—' : numero(s.contratados)}</td>
                    <td className="num-col" data-rotulo="Nomes" style={{ color: 'var(--tinta-3)' }}>{n || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-bold" style={{ background: '#FAFAFB' }}>
                <th scope="row" colSpan={3} className="text-left" style={{ padding: '10px 14px', color: 'var(--tinta)', fontSize: 13.5 }}>
                  Total · {total.feitas} realizada{total.feitas === 1 ? '' : 's'}
                  {total.agendadas > 0 && <span className="font-medium" style={{ color: 'var(--tinta-3)' }}> · {total.agendadas} agendada{total.agendadas === 1 ? '' : 's'} fora da soma</span>}
                </th>
                <td className="num-col" data-rotulo="Convocados">{total.convocados.toLocaleString('pt-BR')}</td>
                <td className="num-col" data-rotulo="Vieram">{total.compareceram.toLocaleString('pt-BR')}</td>
                <td className="num-col" data-rotulo="Faltaram">{total.ausentes.toLocaleString('pt-BR')}</td>
                <td className="num-col" data-rotulo="Desistiram">{total.desistiram.toLocaleString('pt-BR')}</td>
                <td className="num-col" data-rotulo="Contratados">{total.contratados.toLocaleString('pt-BR')}</td>
                <td className="vazia-no-cartao" />
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      </>)}
    </div>
  );
};
