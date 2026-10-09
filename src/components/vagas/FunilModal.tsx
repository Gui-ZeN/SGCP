import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import type { Candidato, Selecao, Vaga } from '../../types';
import { Modal } from '../ui/Modal';
import { ListaDeNomes, nomesPreenchidos } from '../ui/ListaDeNomes';
import { RESULTADOS } from '../../utils/candidatos';
import { ehRealizada, type FunilEfetivo } from '../../utils/selecao';
import { formatDateBR, dataISOLocal } from '../../utils/date';
import { listaParaDocumentacao, listaParaTestes, veio, type CandidatoNaVaga } from '../../utils/funilCandidatos';

/**
 * O Kanban conduzindo os candidatos (pedido do Guilherme, 08/10/2026):
 *  - Triagem → Entrevista: marca a entrevista (uma seleção já ligada à vaga) e,
 *    se quiser, os nomes;
 *  - → Testes: quem veio e quem vai para os testes;
 *  - → Documentação: o resultado do teste e quem segue, e PARA QUAL vaga.
 * Nomes são opcionais: sem eles, avisa, mostra os números e deixa lançar ali.
 * Pular etapa pode, com aviso.
 */
type Alteracao = { candidato: Candidato; campos: Partial<Candidato> };

interface Props {
  vaga: Vaga;
  de: string;
  para: 'Entrevista' | 'Testes' | 'Documentação';
  /** Candidatos das seleções ligadas à vaga. */
  lista: CandidatoNaVaga[];
  selecoesLigadas: Selecao[];
  /** Vagas que uma seleção atende (para escolher a vaga de quem segue). */
  vagasDaSelecao: (s: Selecao) => Vaga[];
  funil: FunilEfetivo;
  aoFechar: () => void;
  /** "Marcar outra": fecha este passo e abre o formulário único de seleção, com a vaga marcada. */
  marcarOutra: () => void;
  registrarNomes: (selecao: Selecao, nomes: string[]) => Promise<void>;
  atualizar: (alteracoes: Alteracao[], resumo: string) => Promise<void>;
  /** Move a vaga para `para` (sincroniza o status). */
  mover: () => Promise<void>;
  /**
   * Registra, aqui mesmo, a entrevista que já aconteceu (data + nomes), para a
   * vaga que chegou à Entrevista sem nenhuma ligada (vaga antiga, ou movida
   * antes do funil existir). Os nomes caem na tabela logo abaixo.
   */
  registrarEntrevista?: (dataBR: string, nomes: string[]) => Promise<void>;
}

const rotulo = 'block text-[13px] font-semibold mb-1';

export function FunilModal(p: Props) {
  const titulo = p.para === 'Entrevista' ? 'Esta vaga já tem entrevista marcada'
    : p.para === 'Testes' ? 'Quem vai para os testes?'
    : 'Quem segue para a documentação?';
  return (
    <Modal largura="lg" aoFechar={p.aoFechar} antes={<span>Vaga nº {p.vaga.codigo} · {p.vaga.vaga} · {p.de} <ChevronRight className="inline w-3.5 h-3.5" /> {p.para}</span>} titulo={titulo}
      rodape={null}>
      {p.para === 'Entrevista' ? <PassoEntrevista {...p} /> : <PassoCandidatos {...p} />}
    </Modal>
  );
}

/* ── Triagem → Entrevista, quando a vaga JÁ tem entrevista agendada ───────
   Sem agendada, o Kanban abre direto o formulário único de seleção. Aqui é só
   escolher: usar a que existe (e, se quiser, lançar os nomes) ou marcar outra. */
function PassoEntrevista(p: Props) {
  const agendadas = p.selecoesLigadas.filter(s => !ehRealizada(s));
  const [usar, setUsar] = useState<string>(agendadas[0]?.id || '');
  const [lista, setLista] = useState<string[]>(['']);
  const [salvando, setSalvando] = useState(false);
  const nomes = nomesPreenchidos(lista);
  const existente = agendadas.find(s => s.id === usar);
  const jaTemNomes = existente ? p.lista.filter(c => c.selecaoId === existente.id).length : 0;

  const confirmar = async () => {
    setSalvando(true);
    try {
      if (existente && nomes.length) await p.registrarNomes(existente, nomes);
      await p.mover();
      p.aoFechar();
    } finally { setSalvando(false); }
  };

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        {agendadas.map(s => (
          <label key={s.id} className="flex items-center gap-2.5 text-[14px] cursor-pointer">
            <input type="radio" name="usar" checked={usar === s.id} onChange={() => setUsar(s.id)} />
            Usar a de <b>{s.data}</b> · {s.convocados} convocados
          </label>
        ))}
      </fieldset>
      {existente && (
        <div>
          <span className={rotulo}>
            Lançar nomes nela <span className="font-normal" style={{ color: 'var(--tinta-3)' }}>({jaTemNomes ? `já tem ${jaTemNomes}; estes entram junto` : 'opcional'})</span>
          </span>
          <ListaDeNomes nomes={lista} onChange={setLista} />
        </div>
      )}
      <Rodape>
        <button type="button" className="btn mr-auto" onClick={p.marcarOutra}>Marcar outra entrevista</button>
        <button type="button" className="btn" onClick={p.aoFechar}>Cancelar</button>
        <button type="button" className="btn btn-primario" disabled={salvando || !existente} onClick={confirmar}>
          {nomes.length ? 'Lançar os nomes e mover' : 'Mover para Entrevista'}
        </button>
      </Rodape>
    </div>
  );
}

/* ── → Testes / → Documentação ────────────────────────────────────────── */
function PassoCandidatos(p: Props) {
  const testes = p.para === 'Testes';
  const pulando = !testes && p.de !== 'Testes';
  const base = useMemo(
    () => testes ? listaParaTestes(p.lista, p.vaga.id) : listaParaDocumentacao(p.lista, p.vaga.id, pulando),
    [p.lista, p.vaga.id, testes, pulando]
  );
  // Estado da tela, por candidato: presença/resultado, se segue, e para qual vaga.
  const [resultado, setResultado] = useState<Record<string, Candidato['resultado']>>(() => Object.fromEntries(base.map(c => [c.id, c.resultado])));
  const [segue, setSegue] = useState<Record<string, boolean>>(() => Object.fromEntries(base.map(c => [c.id, testes ? c.etapa === 'testes' : c.etapa === 'documentacao' && c.vagaId === p.vaga.id])));
  const [vagaDe, setVagaDe] = useState<Record<string, string>>(() => Object.fromEntries(base.map(c => [c.id, c.vagaId || p.vaga.id])));
  const [novos, setNovos] = useState<string[]>(['']);
  const [dataEntrevista, setDataEntrevista] = useState(dataISOLocal());
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const ultimaSelecao = p.selecoesLigadas[0];

  const presentes = base.filter(c => veio({ resultado: resultado[c.id] ?? c.resultado }));
  const marcados = base.filter(c => segue[c.id]);

  const confirmar = async () => {
    setSalvando(true);
    try {
      const alteracoes: Alteracao[] = [];
      for (const c of base) {
        const campos: Partial<Candidato> = {};
        if (resultado[c.id] && resultado[c.id] !== c.resultado) campos.resultado = resultado[c.id];
        if (testes) {
          if (segue[c.id] && c.etapa !== 'testes') campos.etapa = 'testes';
          if (!segue[c.id] && c.etapa === 'testes') campos.etapa = null;
        } else {
          const destino = vagaDe[c.id] || p.vaga.id;
          if (segue[c.id] && (c.etapa !== 'documentacao' || c.vagaId !== destino)) { campos.etapa = 'documentacao'; campos.vagaId = destino; }
          // Desmarcou quem estava na documentação desta vaga: volta para os testes.
          if (!segue[c.id] && c.etapa === 'documentacao' && c.vagaId === p.vaga.id) { campos.etapa = 'testes'; campos.vagaId = null; }
        }
        if (Object.keys(campos).length) alteracoes.push({ candidato: c, campos });
      }
      const resumo = testes
        ? `Vaga #${p.vaga.codigo} foi para Testes: ${presentes.length} de ${base.length} vieram, ${marcados.length} vão para os testes.`
        : `Vaga #${p.vaga.codigo} foi para Documentação: ${marcados.length} seguem (${marcados.map(c => c.nome).join(', ') || 'ninguém'}).`;
      await p.atualizar(alteracoes, resumo);
      await p.mover();
      p.aoFechar();
    } finally { setSalvando(false); }
  };

  const lancarNomes = async () => {
    if (!ultimaSelecao || !nomesPreenchidos(novos).length) return;
    setSalvando(true);
    try { await p.registrarNomes(ultimaSelecao, nomesPreenchidos(novos)); setNovos(['']); } finally { setSalvando(false); }
  };

  // ⚠️ Antes, sem entrevista ligada, o modal mandava VOLTAR e passar por
  // Triagem → Entrevista (relato do RH em 09/10/2026: "pede para ela adicionar
  // os nomes nesse modal"). Agora registra a entrevista aqui e segue.
  const registrarEntrevista = async () => {
    const nomes = nomesPreenchidos(novos);
    if (!p.registrarEntrevista || !nomes.length) return;
    setSalvando(true); setErro('');
    try {
      await p.registrarEntrevista(formatDateBR(dataEntrevista), nomes);
      setNovos(['']);
    } catch (e: any) {
      setErro(e?.message || 'Não deu para registrar a entrevista.');
    } finally { setSalvando(false); }
  };

  // Sem nomes: avisa, mostra os números que existem e deixa lançar ali mesmo.
  if (base.length === 0) {
    const naoVieram = Math.max(0, p.funil.chamados - p.funil.compareceram);
    return (
      <div className="space-y-4">
        <Aviso>
          {testes || !pulando && p.lista.length === 0
            ? 'Esta vaga ainda não tem nomes lançados. Dá para seguir só com os números, ou lançar os nomes agora.'
            : 'Ninguém está nos testes desta vaga. Volte e marque quem foi para os testes, ou siga mesmo assim.'}
        </Aviso>
        {/* Sem entrevista nenhuma, os números são 0/0/0 e não dizem nada. */}
        {ultimaSelecao && <dl className="ficha" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <div><dt>Convocados</dt><dd className="text-[22px] tabular-nums">{p.funil.chamados}</dd></div>
          <div><dt>Compareceram</dt><dd className="text-[22px] tabular-nums">{p.funil.compareceram}</dd></div>
          <div><dt>Não compareceram</dt><dd className="text-[22px] tabular-nums">{naoVieram}</dd></div>
        </dl>}
        {p.lista.length === 0 && (ultimaSelecao ? (
          <div>
            <span className={rotulo}>Lançar os nomes agora <span className="font-normal" style={{ color: 'var(--tinta-3)' }}>(seleção de {ultimaSelecao.data})</span></span>
            <ListaDeNomes nomes={novos} onChange={setNovos} />
            <button type="button" className="btn btn-primario mt-3" disabled={salvando || !nomesPreenchidos(novos).length} onClick={lancarNomes}>
              Lançar {nomesPreenchidos(novos).length || ''} {nomesPreenchidos(novos).length === 1 ? 'nome' : 'nomes'}
            </button>
          </div>
        ) : p.registrarEntrevista && testes ? (
          <div className="space-y-3">
            <p className="text-[13.5px]" style={{ color: 'var(--tinta-2)' }}>
              Esta vaga ainda não tem a entrevista registrada. Registre aqui quem foi chamado: depois é só marcar, na lista, quem veio e quem vai para os testes.
            </p>
            <label className="block max-w-[220px]">
              <span className={rotulo}>Dia da entrevista</span>
              <input type="date" className="campo w-full" value={dataEntrevista} onChange={e => setDataEntrevista(e.target.value)} />
            </label>
            <div>
              <span className={rotulo}>Quem foi chamado</span>
              <ListaDeNomes nomes={novos} onChange={setNovos} />
            </div>
            {erro && <p role="alert" className="erro-form">{erro}</p>}
            <button type="button" className="btn btn-primario" disabled={salvando || !dataEntrevista || !nomesPreenchidos(novos).length} onClick={registrarEntrevista}>
              {salvando ? 'Registrando…' : !nomesPreenchidos(novos).length ? 'Registrar a entrevista' : `Registrar a entrevista com ${nomesPreenchidos(novos).length} ${nomesPreenchidos(novos).length === 1 ? 'nome' : 'nomes'}`}
            </button>
          </div>
        ) : (
          <p className="text-[13.5px]" style={{ color: 'var(--tinta-3)' }}>Nenhuma entrevista ligada a esta vaga.</p>
        ))}
        <Rodape>
          <button type="button" className="btn" onClick={p.aoFechar}>Cancelar</button>
          <button type="button" className="btn btn-primario" disabled={salvando} onClick={async () => { await p.mover(); p.aoFechar(); }}>Mover sem nomes</button>
        </Rodape>
      </div>
    );
  }

  const resultadosTeste = RESULTADOS.filter(r => r.id !== 'convocado' && r.id !== 'ausente');
  return (
    <div className="space-y-4">
      {pulando && <Aviso>Pulando os testes: aparecem todos que vieram à entrevista e continuam no processo.</Aviso>}
      {/* Sem rolagem de lado (regra de 08/10/2026): em tela estreita, cartão. */}
      <div>
        <table className="tabela tabela-empilha">
          <thead>
            <tr>
              <th>Nome</th>
              <th>{testes ? 'Veio à entrevista?' : 'Resultado do teste'}</th>
              <th>{testes ? 'Vai para os testes' : 'Segue para a documentação'}</th>
              {!testes && <th>Para a vaga</th>}
            </tr>
          </thead>
          <tbody>
            {base.map(c => {
              const r = resultado[c.id] ?? c.resultado;
              const vagasDela = p.vagasDaSelecao(c.selecao);
              const podeSeguir = testes ? veio({ resultado: r }) : true;
              return (
                <tr key={c.id}>
                  <td className="font-semibold"><span>{c.nome}<span className="sub">seleção de {c.selecao.data}</span></span></td>
                  <td data-rotulo={testes ? 'Veio?' : 'Resultado'}>
                    {testes ? (
                      <div className="seg" role="group" aria-label={`${c.nome} veio?`}>
                        <button type="button" aria-pressed={veio({ resultado: r })}
                          onClick={() => setResultado(x => ({ ...x, [c.id]: veio({ resultado: c.resultado }) ? c.resultado : 'compareceu' }))}>Veio</button>
                        <button type="button" aria-pressed={r === 'ausente'}
                          onClick={() => { setResultado(x => ({ ...x, [c.id]: 'ausente' })); setSegue(x => ({ ...x, [c.id]: false })); }}>Não veio</button>
                      </div>
                    ) : (
                      <select className="campo" value={r} onChange={e => setResultado(x => ({ ...x, [c.id]: e.target.value as Candidato['resultado'] }))} aria-label={`Resultado do teste de ${c.nome}`}>
                        {resultadosTeste.map(o => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
                      </select>
                    )}
                  </td>
                  <td data-rotulo={testes ? 'Vai p/ testes' : 'Segue'}>
                    <label className="inline-flex items-center gap-2 cursor-pointer text-[14px]" style={{ opacity: podeSeguir ? 1 : 0.4 }}>
                      <input type="checkbox" className="w-4 h-4" style={{ accentColor: 'var(--tinta)' }} disabled={!podeSeguir}
                        checked={!!segue[c.id]} onChange={e => setSegue(x => ({ ...x, [c.id]: e.target.checked }))} />
                      {segue[c.id] ? 'Sim' : 'Não'}
                    </label>
                  </td>
                  {!testes && (
                    <td data-rotulo="Para a vaga">
                      {vagasDela.length > 1 ? (
                        <select className="campo" value={vagaDe[c.id]} onChange={e => setVagaDe(x => ({ ...x, [c.id]: e.target.value }))} aria-label={`Vaga de ${c.nome}`}>
                          {vagasDela.map(v => <option key={v.id} value={v.id}>nº {v.codigo} · {v.sede}</option>)}
                        </select>
                      ) : <span style={{ color: 'var(--tinta-3)' }}>esta vaga</span>}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[13.5px]" style={{ color: 'var(--tinta-2)' }}>
        {testes
          ? <>{presentes.length} de {base.length} vieram · <b>{marcados.length} vão para os testes</b></>
          : <><b>{marcados.length} {marcados.length === 1 ? 'segue' : 'seguem'} para a documentação</b>{marcados.length > 1 && ' (cada vaga contrata uma pessoa; as outras ficam como alternativas)'}</>}
      </p>
      <Rodape>
        <button type="button" className="btn" onClick={p.aoFechar}>Cancelar</button>
        <button type="button" className="btn btn-primario" disabled={salvando} onClick={confirmar}>Salvar e mover para {p.para}</button>
      </Rodape>
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-[13.5px] rounded-md px-3 py-2.5" style={{ background: '#FDF3DC', color: '#7A4E0B' }}>
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** As ações do passo, no rodapé fixo do modal (o corpo rola por cima). */
function Rodape({ children }: { children: React.ReactNode }) {
  return <div className="modal-rodape -mx-5 -mb-[18px] mt-2 sticky bottom-[-18px]">{children}</div>;
}
