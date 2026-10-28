/**
 * Quem participou de uma turma da Infra (28/10/2026). A lista vem do quadro do
 * Chromos (só ASG ativos da unidade de quem abre), filtrada pelas sedes
 * marcadas; quem participou e não está no quadro entra à mão, com a etiqueta
 * "fora do quadro". O Realizado da turma passa a ser a contagem desta lista.
 */
import { useEffect, useMemo, useState } from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import type { Participante, Treinamento } from '../../types';
import { Modal } from '../ui/Modal';
import { FiltroMultiplo } from '../ui/FiltroMultiplo';
import { lerQuadroDaInfra, lerPresenca, type PessoaDoQuadro } from '../../hooks/usePresencas';
import { alternar, mesmoParticipante, participanteDoQuadro, participanteManual, MAX_PARTICIPANTES } from '../../utils/presenca';
import { normalizarNome } from '../../utils/catalogo';

interface Props {
  turma: Treinamento;
  onSalvar: (participantes: Participante[]) => Promise<void>;
  aoFechar: () => void;
  /** Para testar a tela sem o banco nem o Chromos; por padrão, os reais. */
  carregarQuadro?: () => Promise<PessoaDoQuadro[]>;
  carregarPresenca?: (turma: Treinamento) => Promise<Participante[]>;
}

export function PresencaModal({ turma, onSalvar, aoFechar, carregarQuadro = lerQuadroDaInfra, carregarPresenca = lerPresenca }: Props) {
  const [quadro, setQuadro] = useState<PessoaDoQuadro[] | null>(null);
  const [erroQuadro, setErroQuadro] = useState('');
  const [lista, setLista] = useState<Participante[] | null>(null);
  const [sedesSel, setSedesSel] = useState<string[]>([]);
  const [busca, setBusca] = useState('');
  const [manual, setManual] = useState({ nome: '', matricula: '', sede: '' });
  const [erroManual, setErroManual] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [erroLista, setErroLista] = useState(false);

  useEffect(() => {
    // Só a unidade da turma: o Administrador recebe as duas, e não pode marcar
    // ASG da Universidade numa turma do Colégio.
    carregarQuadro().then(q => setQuadro(q.filter(p => !turma.escopo || p.unidade === turma.escopo)))
      .catch(e => { setQuadro([]); setErroQuadro(e?.message || String(e)); });
    // ⚠️ Erro na leitura NÃO é lista vazia: a lista fica desconhecida e o
    // Salvar trava — senão salvar apagaria a presença já gravada (28/10/2026).
    carregarPresenca(turma).then(setLista).catch(e => { setErroLista(true); setErro(`Não deu para ler a presença já marcada (${e?.message || e}). Feche e abra de novo; nada foi alterado.`); });
  }, [turma.id]);

  const sedes = useMemo(() => [...new Set((quadro || []).map(p => p.sede))].sort(), [quadro]);
  const visiveis = useMemo(() => {
    const q = normalizarNome(busca);
    return (quadro || []).filter(p =>
      (!sedesSel.length || sedesSel.includes(p.sede)) && (!q || normalizarNome(p.nome).includes(q) || p.matricula.includes(q)));
  }, [quadro, sedesSel, busca]);

  const marcada = (p: PessoaDoQuadro) => !!lista?.some(x => mesmoParticipante(x, p));
  const marcarVisiveis = () => setLista(l => visiveis.reduce((acc, p) => acc.some(x => mesmoParticipante(x, p)) ? acc : alternar(acc, participanteDoQuadro(p)), l || []));

  const adicionarManual = () => {
    const r = participanteManual(manual, lista || [], sedes);
    if ('erro' in r) { setErroManual(r.erro); return; }
    setLista(l => [...(l || []), r.participante]);
    setManual({ nome: '', matricula: '', sede: '' });
    setErroManual('');
  };

  const salvar = async () => {
    if (!lista || erroLista) return;
    setSalvando(true); setErro('');
    try { await onSalvar(lista); aoFechar(); }
    catch (e: any) { setErro(`Não foi possível salvar: ${e?.message || e}`); }
    finally { setSalvando(false); }
  };

  const carregando = quadro === null || (lista === null && !erroLista);
  const cheia = (lista?.length ?? 0) >= MAX_PARTICIPANTES;
  return (
    <Modal
      largura="lg"
      titulo="Quem participou"
      antes={<>nº {turma.codigo || 's/n'} · {turma.tema}</>}
      aoFechar={aoFechar}
      rodape={<>
        <button type="button" className="btn" onClick={aoFechar}>Cancelar</button>
        <button type="button" className="btn btn-primario" disabled={carregando || salvando || erroLista || lista === null} onClick={salvar}>
          {salvando ? 'Salvando…' : `Salvar presença (${lista?.length ?? 0})`}
        </button>
      </>}
    >
      <div className="space-y-5">
        {erro && <p role="alert" className="erro-form">{erro}</p>}

        <section aria-label="Quadro da Infra">
          <h3 className="text-[14px] font-bold" style={{ color: 'var(--tinta)' }}>Quadro da Infra (ASG, do Chromos)</h3>
          {erroQuadro ? (
            <p className="mt-2 text-[13px]" style={{ color: 'var(--atraso)' }}>{erroQuadro} Dá para lançar à mão abaixo.</p>
          ) : (
            <>
              <div className="filtros mt-2">
                <FiltroMultiplo rotulo="Sede" todos="todas" opcoes={sedes.map(s => ({ valor: s, rotulo: s }))} selecionados={sedesSel} onChange={setSedesSel} />
                <label className="campo-busca">
                  <Search aria-hidden="true" />
                  <input type="search" className="campo" aria-label="Buscar nome ou matrícula" placeholder="Buscar nome ou matrícula"
                    value={busca} onChange={e => setBusca(e.target.value)} />
                </label>
                {visiveis.length > 0 && (
                  <button type="button" className="btn-texto" onClick={marcarVisiveis}>{visiveis.length === 1 ? 'Marcar o mostrado' : `Marcar os ${visiveis.length} mostrados`}</button>
                )}
              </div>
              {carregando ? (
                <p className="mt-2 text-[13px]" style={{ color: 'var(--tinta-3)' }}>Lendo o quadro do Chromos…</p>
              ) : visiveis.length === 0 ? (
                <p className="mt-2 text-[13px]" style={{ color: 'var(--tinta-3)' }}>Ninguém do quadro com esses filtros.</p>
              ) : (
                <ul className="mt-2 max-h-72 overflow-y-auto">
                  {visiveis.map(p => (
                    <li key={`${p.matricula}|${p.nome}`} style={{ borderBottom: '1px solid var(--fio)' }}>
                      <label className="flex items-center gap-3 py-2 cursor-pointer text-[14px]">
                        <input type="checkbox" className="w-4 h-4 shrink-0" style={{ accentColor: 'var(--tinta)' }}
                          checked={marcada(p)} onChange={() => setLista(l => alternar(l || [], participanteDoQuadro(p)))} />
                        <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--tinta)' }}>{p.nome}</span>
                        <span className="text-[12.5px] tabular-nums shrink-0" style={{ color: 'var(--tinta-3)' }}>{p.sede} · {p.matricula}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <section aria-label="Lançar quem não está no quadro">
          <h3 className="text-[14px] font-bold" style={{ color: 'var(--tinta)' }}>Participou e não está no quadro?</h3>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-[1fr_9rem_8rem_auto] gap-2 items-start">
            <input className="campo w-full" aria-label="Nome" placeholder="Nome completo" maxLength={120}
              value={manual.nome} onChange={e => setManual(m => ({ ...m, nome: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarManual(); } }} />
            <input className="campo w-full tabular-nums" aria-label="Matrícula (opcional)" placeholder="Matrícula" inputMode="numeric" maxLength={12}
              value={manual.matricula} onChange={e => setManual(m => ({ ...m, matricula: e.target.value }))} />
            <select className="campo w-full" aria-label="Sede (opcional)" value={manual.sede} onChange={e => setManual(m => ({ ...m, sede: e.target.value }))}>
              <option value="">Sede</option>
              {sedes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="button" className="btn" onClick={adicionarManual}><UserPlus aria-hidden="true" />Adicionar</button>
          </div>
          {erroManual && <p role="alert" className="mt-1 text-[13px]" style={{ color: 'var(--atraso)' }}>{erroManual}</p>}
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--tinta-3)' }}>Fica marcado "fora do quadro": é o sinal de que o Chromos precisa ser atualizado.</p>
        </section>

        <section aria-label="Participaram">
          <h3 className="text-[14px] font-bold" style={{ color: 'var(--tinta)' }}>
            Participaram <span style={{ color: 'var(--tinta-3)' }}>{lista?.length ?? 0}</span>
          </h3>
          {cheia && <p className="mt-1 text-[13px]" style={{ color: 'var(--atraso)' }}>Chegou ao máximo de {MAX_PARTICIPANTES} participantes por turma.</p>}
          {lista && lista.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {lista.map(p => (
                <li key={`${p.matricula}|${p.nome}`} className="chip">
                  <span>{p.nome}</span>
                  {p.foraDoQuadro && <span className="etiqueta" style={{ color: 'var(--etapa-pausa)', background: 'var(--etapa-pausa-fundo)' }}>fora do quadro</span>}
                  <button type="button" aria-label={`Tirar ${p.nome}`} onClick={() => setLista(l => (l || []).filter(x => x !== p))}
                    className="inline-flex" style={{ color: 'var(--tinta-3)' }}><X className="w-3.5 h-3.5" aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13px]" style={{ color: 'var(--tinta-3)' }}>Ninguém marcado ainda.</p>
          )}
        </section>
      </div>
    </Modal>
  );
}
