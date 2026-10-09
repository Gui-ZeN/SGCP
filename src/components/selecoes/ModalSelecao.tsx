/**
 * O formulário ÚNICO de seleção (09/10/2026). Antes eram três: "Nova seleção"
 * (Seleções), "Agendar seleção" (Resumo do Dia) e "Marcar a entrevista"
 * (Kanban), cada um com campos e ordem diferentes. Agora os três abrem este
 * modal, já preenchido com o que o lugar sabe: o dia (Resumo), a vaga (Kanban).
 *
 * A seleção nasce de uma vaga aberta (24/09/2026): cargo, setor, gestor e
 * planilha vêm dela, e ligar soma o funil da vaga sozinho. "Sem vaga" (banco de
 * talentos) continua possível. Ao criar uma AGENDADA dá para lançar os nomes
 * já aqui, um por campo; a realizada tem os resultados lançados por nome
 * depois, na lista de candidatos.
 */
import { useState, type ReactNode } from 'react';
import type { Selecao, Vaga } from '../../types';
import type { Sede } from '../../hooks/useMetadata';
import { camposDoFormulario, origemDoSetor, vagasSugeridas, type FormularioSelecao } from '../../utils/selecao';
import { formatDateBR, toISOInput } from '../../utils/date';
import { normalizarNome } from '../../utils/catalogo';
import { Modal } from '../ui/Modal';
import { ListaDeNomes, nomesPreenchidos } from '../ui/ListaDeNomes';

export interface SugestoesSelecao { cargos: string[]; gestores: string[]; setores: string[]; rh: string[] }

/** O que já foi digitado em outras seleções, para os campos livres sugerirem. */
export function sugestoesDeSelecoes(selecoes: Selecao[], setores: string[] = []): SugestoesSelecao {
  const u = (f: (s: Selecao) => string | undefined) =>
    [...new Set(selecoes.map(f).map(x => (x || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return {
    cargos: u(s => s.cargo),
    gestores: u(s => s.gestor),
    setores: [...new Set([...setores, ...u(s => s.setor)])].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    rh: u(s => s.responsavel),
  };
}

/** Formulário vazio, com o que o lugar já sabe por cima. */
export function formularioVazio(base: Partial<FormularioSelecao> = {}): FormularioSelecao {
  return {
    data: '', cargo: '', sede: '', origem: 'geral', setor: '', gestor: '', responsavel: '',
    convocados: 0, jaAconteceu: false, compareceram: 0, ausentes: 0, desistiram: 0, contratados: 0, vagaIds: [],
    ...base,
  };
}

/** O formulário já com a vaga marcada (Kanban, detalhes da vaga). */
export function formularioDaVaga(vaga: Vaga, base: Partial<FormularioSelecao> = {}): FormularioSelecao {
  return formularioVazio({
    cargo: vaga.vaga, sede: vaga.sede, setor: vaga.setor || '', gestor: vaga.solicitante || '',
    origem: origemDoSetor(vaga.setor || ''), vagaIds: [vaga.id], ...base,
  });
}

const rotulo = 'block text-[13px] font-semibold mb-1';
const nota = 'text-[12.5px] mt-1.5';

interface Props {
  titulo: string;
  antes?: ReactNode;
  inicial: FormularioSelecao;
  sedes: Sede[];
  vagas: Vaga[];
  sugestoes: SugestoesSelecao;
  /** Edição de seleção cujos números saem da lista de candidatos. */
  numerosDaLista?: boolean;
  /** Criando: mostra a lista de nomes (só para agendada). */
  comNomes?: boolean;
  /** Botão a mais, à esquerda do rodapé ("Só mover, marcar depois"). */
  acaoExtra?: { rotulo: string; acao: () => void | Promise<void> };
  rotuloSalvar?: string;
  onSalvar: (campos: Omit<Selecao, 'id'>, nomes: string[]) => Promise<void>;
  aoFechar: () => void;
}

export function ModalSelecao({ titulo, antes, inicial, sedes, vagas, sugestoes, numerosDaLista, comNomes, acaoExtra, rotuloSalvar = 'Salvar', onSalvar, aoFechar }: Props) {
  const [f, setF] = useState<FormularioSelecao>(inicial);
  const [lista, setLista] = useState<string[]>(['']);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const set = <K extends keyof FormularioSelecao>(k: K, v: FormularioSelecao[K]) => setF(x => ({ ...x, [k]: v }));
  // Seleção antiga sem vaga ligada abre com os campos livres; nova abre pedindo a vaga.
  const [semVaga, setSemVaga] = useState(!(inicial.vagaIds || []).length && !!inicial.cargo);
  const nomes = comNomes && !f.jaAconteceu ? nomesPreenchidos(lista) : [];

  const trocarSede = (sede: string) =>
    setF(x => semVaga ? { ...x, sede } : { ...x, sede, vagaIds: [], cargo: '', setor: '', gestor: '' });
  const marcarVaga = (v: Vaga) => setF(x => {
    const ligadas = x.vagaIds || [];
    if (ligadas.includes(v.id)) {
      const resto = ligadas.filter(id => id !== v.id);
      return resto.length ? { ...x, vagaIds: resto } : { ...x, vagaIds: [], cargo: '', setor: '', gestor: '' };
    }
    if (ligadas.length) return { ...x, vagaIds: [...ligadas, v.id] };
    return { ...x, vagaIds: [v.id], cargo: v.vaga, setor: v.setor || '', gestor: v.solicitante || '' };
  });
  const numeroCampo = (k: 'convocados' | 'compareceram' | 'ausentes' | 'desistiram' | 'contratados', r: string, valor = f[k]) => (
    <label className="block">
      <span className={rotulo}>{r}</span>
      <input type="number" min={0} inputMode="numeric" className="campo w-full tabular-nums"
        value={valor || ''} onChange={e => set(k, Number(e.target.value) || 0)} />
    </label>
  );

  const salvar = async () => {
    // Planilha pelo setor. Sem setor (histórico da aba pedagógica, que não tem
    // a coluna), fica a que já estava. Com nomes, convocados é pelo menos a lista.
    const g = { ...f, origem: f.setor ? origemDoSetor(f.setor) : f.origem, convocados: Math.max(f.convocados, nomes.length) };
    const { erros: e0, campos } = camposDoFormulario(numerosDaLista ? { ...g, convocados: Math.max(1, g.convocados) } : g);
    const e = !semVaga && !(f.vagaIds || []).length ? ['Escolha a vaga, ou use "Seleção sem vaga aberta".', ...e0.filter(x => !/cargo/i.test(x))] : e0;
    setErros(e);
    if (e.length) return;
    setSalvando(true);
    try {
      await onSalvar(campos, nomes);
      aoFechar();
    } catch (err: any) {
      setErros([`Não foi possível salvar: ${err?.message || err}`]);
    } finally {
      setSalvando(false);
    }
  };

  const ligadas = f.vagaIds || [];
  return (
    <Modal
      largura="lg"
      titulo={titulo}
      antes={antes}
      aoFechar={aoFechar}
      rodape={<>
        {acaoExtra && <button type="button" className="btn mr-auto" disabled={salvando} onClick={async () => { await acaoExtra.acao(); aoFechar(); }}>{acaoExtra.rotulo}</button>}
        <button type="button" className="btn" onClick={aoFechar}>Cancelar</button>
        <button type="button" className="btn btn-primario" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : rotuloSalvar}</button>
      </>}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="block">
            <span className={rotulo}>Dia *</span>
            <input type="date" className="campo w-full" value={toISOInput(f.data)} onChange={e => set('data', formatDateBR(e.target.value))} />
          </label>
          <label className="block md:col-span-2">
            <span className={rotulo}>Sede *</span>
            <select className="campo w-full" value={f.sede} onChange={e => trocarSede(e.target.value)}>
              <option value="">Escolha…</option>
              {f.sede && !sedes.some(s => s.nome === f.sede) && <option value={f.sede}>{f.sede}</option>}
              {sedes.map(s => <option key={s.nome} value={s.nome}>{s.sigla ? `${s.sigla} · ${s.nome}` : s.nome}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={rotulo}>Responsável no RH</span>
            <input className="campo w-full" list="ms-rh" value={f.responsavel} onChange={e => set('responsavel', e.target.value)} />
          </label>
        </div>

        {!semVaga ? (
          <fieldset>
            <legend className={rotulo}>Vaga *</legend>
            {(() => {
              if (!f.sede) return <p className="text-[13.5px]" style={{ color: 'var(--tinta-3)' }}>Escolha a sede para ver as vagas abertas dela.</p>;
              // Depois da primeira vaga, só as do mesmo cargo: uma seleção, um cargo.
              const opcoes = vagasSugeridas(vagas, sedes, f.sede, f.cargo, ligadas)
                .filter(v => !ligadas.length || ligadas.includes(v.id) || normalizarNome(v.vaga) === normalizarNome(f.cargo));
              if (!opcoes.length) return <p className="text-[13.5px]" style={{ color: 'var(--tinta-3)' }}>Nenhuma vaga aberta nesta sede.</p>;
              return (
                <div className="painel divide-y max-h-48 overflow-y-auto" style={{ borderColor: 'var(--fio)' }}>
                  {opcoes.map(v => (
                    <label key={v.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer text-[14px] hover:bg-[#F6F7F9]">
                      <input type="checkbox" className="w-4 h-4 shrink-0" style={{ accentColor: 'var(--tinta)' }} checked={ligadas.includes(v.id)} onChange={() => marcarVaga(v)} />
                      <span className="tabular-nums text-[12.5px] font-semibold shrink-0" style={{ color: 'var(--tinta-3)' }}>nº {v.codigo}</span>
                      <span className="font-semibold truncate">{v.vaga}</span>
                      <span className="ml-auto text-[12.5px] shrink-0" style={{ color: 'var(--tinta-3)' }}>{v.setor || ''}</span>
                    </label>
                  ))}
                </div>
              );
            })()}
            <p className={nota} style={{ color: 'var(--tinta-3)' }}>
              {ligadas.length > 0
                ? <><b style={{ color: 'var(--tinta)' }}>{f.cargo}</b>{f.setor && <> · {f.setor}</>}{f.gestor && <> · gestor {f.gestor}</>} · conta na planilha {origemDoSetor(f.setor) === 'pedagogico' ? 'Pedagógico' : 'Geral'}{ligadas.length > 1 && ` · ${ligadas.length} vagas no mesmo dia`}</>
                : 'Dá para marcar mais de uma: chamar 20 pessoas para as 2 vagas de ASG é uma seleção só.'}
            </p>
            <button type="button" className="atalho text-[13px] mt-2" onClick={() => { setSemVaga(true); setF(x => ({ ...x, vagaIds: [] })); }}>
              Seleção sem vaga aberta (banco de talentos)
            </button>
          </fieldset>
        ) : (
          <fieldset>
            <legend className={rotulo}>Seleção sem vaga aberta</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="block">
                <span className={rotulo}>Cargo *</span>
                <input className="campo w-full" list="ms-cargos" value={f.cargo} onChange={e => set('cargo', e.target.value)} />
              </label>
              <label className="block">
                <span className={rotulo}>Setor</span>
                <input className="campo w-full" list="ms-setores" value={f.setor} onChange={e => set('setor', e.target.value)} />
              </label>
              <label className="block">
                <span className={rotulo}>Gestor</span>
                <input className="campo w-full" list="ms-gestores" value={f.gestor} onChange={e => set('gestor', e.target.value)} />
              </label>
            </div>
            <button type="button" className="atalho text-[13px] mt-2" onClick={() => { setSemVaga(false); setF(x => ({ ...x, cargo: '', setor: '', gestor: '' })); }}>
              Escolher uma vaga aberta
            </button>
          </fieldset>
        )}

        <datalist id="ms-cargos">{sugestoes.cargos.map(x => <option key={x} value={x} />)}</datalist>
        <datalist id="ms-setores">{sugestoes.setores.map(x => <option key={x} value={x} />)}</datalist>
        <datalist id="ms-gestores">{sugestoes.gestores.map(x => <option key={x} value={x} />)}</datalist>
        <datalist id="ms-rh">{sugestoes.rh.map(x => <option key={x} value={x} />)}</datalist>

        <div className="secao" style={{ marginTop: 0, paddingTop: 16, borderTop: '1px solid #EEF0F3' }}>
          {numerosDaLista ? (
            <p className="text-[13.5px]" style={{ color: 'var(--tinta-2)' }}>
              Os números desta seleção vêm da <b>lista de candidatos</b>: mude o resultado de cada pessoa para mudá-los.
            </p>
          ) : (
            <>
              <label className="inline-flex items-center gap-2 text-[14px] font-semibold cursor-pointer">
                <input type="checkbox" className="w-4 h-4" style={{ accentColor: 'var(--tinta)' }} checked={f.jaAconteceu} onChange={e => set('jaAconteceu', e.target.checked)} />
                A seleção já aconteceu
              </label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
                {numeroCampo('convocados', 'Convocados *', Math.max(f.convocados, nomes.length))}
                {f.jaAconteceu && <>
                  {numeroCampo('compareceram', 'Compareceram')}
                  {numeroCampo('ausentes', 'Ausentes')}
                  {numeroCampo('desistiram', 'Desistiram')}
                  {(f.setor ? origemDoSetor(f.setor) : f.origem) === 'geral' && numeroCampo('contratados', 'Contratados')}
                </>}
              </div>
              {!f.jaAconteceu && <p className={nota} style={{ color: 'var(--tinta-3)' }}>Fica como agendada. O resultado é lançado depois, pela lista de candidatos.</p>}
            </>
          )}
        </div>

        {comNomes && !f.jaAconteceu && (
          <div>
            <span className={rotulo}>Quem foi chamado <span className="font-normal" style={{ color: 'var(--tinta-3)' }}>(opcional)</span></span>
            <ListaDeNomes nomes={lista} onChange={setLista} />
            <p className={nota} style={{ color: 'var(--tinta-3)' }}>
              {nomes.length ? `${nomes.length} ${nomes.length === 1 ? 'nome' : 'nomes'}. ` : ''}
              Com os nomes, a presença e os testes depois saem deles, sem contar à mão.
            </p>
          </div>
        )}

        {erros.length > 0 && (
          <ul role="alert" className="rounded-md px-3.5 py-2.5 text-[13.5px] font-semibold space-y-1" style={{ background: 'var(--atraso-fundo)', color: 'var(--atraso)' }}>
            {erros.map(e => <li key={e}>{e}</li>)}
          </ul>
        )}
      </div>
    </Modal>
  );
}
