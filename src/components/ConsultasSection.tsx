import React, { useMemo, useState } from 'react';
import { Consulta } from '../types';
import { toISOInput, formatDateBR } from '../utils/date';
import { coerirAtendimento, validarConsulta, diasDeEspera, STATUS_CONSULTA, type ConsultaInput } from '../utils/consulta';
import { exportToXlsx } from '../utils/xlsxExporter';
import { dataISOLocal } from '../utils/date';
import { Search, Plus, Trash2, Download } from 'lucide-react';
import { Modal } from './ui/Modal';
import { FiltroMultiplo } from './ui/FiltroMultiplo';
import { Kpi } from './indicadores/ui';

/**
 * Módulo "Consultas" — solicitação e atendimento por especialidade.
 *
 * Registro simples de fila, com os cinco campos pedidos e nada além:
 * funcionário, especialidade solicitada, data da solicitação, status
 * (No aguardo / Atendido) e data do atendimento. Funcionário e especialidade
 * são texto livre — não há catálogo de especialidades no sistema.
 */
interface ConsultasSectionProps {
  consultas: Consulta[];
  notify?: (msg: string, type?: 'error' | 'success' | 'info' | 'warning') => void;
  addConsulta: (c: ConsultaInput) => Promise<void>;
  updateConsulta: (id: string, campos: Partial<Consulta>) => Promise<void>;
  deleteConsulta: (id: string) => Promise<void>;
  confirmAction?: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
  canManage?: boolean;
}

const FORM_VAZIO: ConsultaInput = {
  funcionario: '',
  especialidade: '',
  dataSolicitacao: '',
  status: 'No aguardo',
  dataAtendimento: ''
};

const hoje = () => formatDateBR(new Date());

export const ConsultasSection: React.FC<ConsultasSectionProps> = ({
  consultas, addConsulta, updateConsulta, deleteConsulta, confirmAction, notify, canManage = true
}) => {
  const [busca, setBusca] = useState('');
  // Múltipla escolha (regra de 08/10/2026); nada marcado = todos.
  const [statusSel, setStatusSel] = useState<string[]>([]);
  const [especialidadesSel, setEspecialidadesSel] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Consulta | null>(null);
  const [form, setForm] = useState<ConsultaInput>({ ...FORM_VAZIO });
  const [erros, setErros] = useState<string[]>([]);

  const set = (campo: keyof ConsultaInput, valor: string) =>
    setForm(f => coerirAtendimento({ ...f, [campo]: valor }));

  const filtradas = useMemo(() => consultas.filter(c => {
    const termo = busca.toLowerCase();
    const okBusca = !termo
      || c.funcionario.toLowerCase().includes(termo)
      || c.especialidade.toLowerCase().includes(termo);
    const okStatus = !statusSel.length || statusSel.includes(c.status);
    const okEspecialidade = !especialidadesSel.length || especialidadesSel.includes(c.especialidade);
    return okBusca && okStatus && okEspecialidade;
  }), [consultas, busca, statusSel, especialidadesSel]);

  const opcoesEspecialidade = useMemo(() => [...new Set(consultas.map(c => c.especialidade).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR')).map(e => ({ valor: e, rotulo: e })), [consultas]);

  const abrirNova = () => {
    setEditing(null);
    setErros([]);
    setForm({ ...FORM_VAZIO, dataSolicitacao: hoje() });
    setShowForm(true);
  };

  const abrirEdicao = (c: Consulta) => {
    setEditing(c);
    setErros([]);
    setForm({
      funcionario: c.funcionario,
      especialidade: c.especialidade,
      dataSolicitacao: c.dataSolicitacao,
      status: c.status,
      dataAtendimento: c.dataAtendimento || ''
    });
    setShowForm(true);
  };

  /** Atalho da tabela: abre a edição já marcada como Atendido, na data de hoje. */
  const abrirAtendimento = (c: Consulta) => {
    setEditing(c);
    setErros([]);
    setForm({
      funcionario: c.funcionario,
      especialidade: c.especialidade,
      dataSolicitacao: c.dataSolicitacao,
      status: 'Atendido',
      dataAtendimento: c.dataAtendimento || hoje()
    });
    setShowForm(true);
  };

  const salvar = async () => {
    const payload = coerirAtendimento({
      ...form,
      funcionario: form.funcionario.trim(),
      especialidade: form.especialidade.trim()
    });
    const problemas = validarConsulta(payload);
    setErros(problemas);
    if (problemas.length) return;

    if (editing) await updateConsulta(editing.id, payload);
    else await addConsulta(payload);
    setShowForm(false);
  };

  /** Exporta o que está na tela (lista filtrada), como nos demais módulos. */
  const exportar = async () => {
    if (!filtradas.length) { notify?.('Nada para exportar com os filtros atuais.', 'warning'); return; }
    const columns = [
      { title: 'Funcionário', width: 32 },
      { title: 'Especialidade solicitada', width: 28 },
      { title: 'Data da solicitação', width: 18 },
      { title: 'Status', width: 14 },
      { title: 'Data do atendimento', width: 18 },
      { title: 'Dias de espera', width: 14 },
    ];
    const rows = filtradas.map(c => [
      { type: String, value: c.funcionario },
      { type: String, value: c.especialidade },
      { type: String, value: c.dataSolicitacao || null },
      { type: String, value: c.status },
      { type: String, value: c.dataAtendimento || null },
      // Espera: até o atendimento, ou até hoje enquanto está na fila — é o
      // número que o RH quer ver na planilha e que a tabela não mostra.
      { type: Number, value: diasDeEspera(c) },
    ]);
    await exportToXlsx(`consultas_${dataISOLocal()}.xlsx`, columns, rows, { sheet: 'Consultas' });
  };

  const excluir = (c: Consulta) => {
    const acao = async () => { await deleteConsulta(c.id); };
    const mensagem = `Remover a consulta de "${c.funcionario}" (${c.especialidade})?`;
    if (confirmAction) confirmAction('Excluir consulta', mensagem, acao);
    else if (confirm(mensagem)) acao();
  };

  const naFila = consultas.filter(c => c.status === 'No aguardo');
  // Sem data válida a espera é null: fica fora da média e da linha.
  const esperas = naFila.map(c => diasDeEspera(c)).filter((d): d is number => d !== null);
  const esperaMedia = esperas.length ? Math.round(esperas.reduce((t, d) => t + d, 0) / esperas.length) : null;
  const esperaTexto = (c: Consulta) => {
    const d = diasDeEspera(c);
    if (d === null) return '';
    if (c.status === 'Atendido') return d === 0 ? 'atendida no mesmo dia' : `atendida em ${d} dia${d === 1 ? '' : 's'}`;
    return d === 0 ? 'na fila desde hoje' : `na fila há ${d} dia${d === 1 ? '' : 's'}`;
  };

  return (
    <div className="space-y-5">
      <header className="pagina-cab">
        <div className="min-w-0">
          <p className="pagina-trilha">Pessoas</p>
          <h1 className="pagina-titulo">Consultas</h1>
          <p className="inicio-sub">Especialidades pedidas pelos funcionários e o andamento do atendimento.</p>
        </div>
        <div className="pagina-acoes">
          <button type="button" className="btn" onClick={exportar}><Download aria-hidden="true" /> Exportar</button>
          {canManage && <button type="button" className="btn btn-primario" onClick={abrirNova}><Plus aria-hidden="true" /> Nova consulta</button>}
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi rotulo="No aguardo" valor={naFila.length} tom={naFila.length ? 'atencao' : 'neutro'} />
        <Kpi rotulo="Espera média na fila" valor={esperaMedia ?? '—'} unidade={esperaMedia !== null ? 'dias' : undefined} />
        <Kpi rotulo="Atendidas" valor={consultas.length - naFila.length} />
      </div>

      {/* Todo filtro é de múltipla escolha (regra de 08/10/2026). */}
      <div className="filtros">
        <FiltroMultiplo rotulo="Situação" todos="todas" selecionados={statusSel} onChange={setStatusSel}
          opcoes={STATUS_CONSULTA.map(s => ({ valor: s, rotulo: s }))} />
        {opcoesEspecialidade.length > 1 && (
          <FiltroMultiplo rotulo="Especialidade" todos="todas" selecionados={especialidadesSel} onChange={setEspecialidadesSel} opcoes={opcoesEspecialidade} />
        )}
        <label className="campo-busca">
          <Search aria-hidden="true" />
          <input type="search" className="campo" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar funcionário ou especialidade" aria-label="Buscar funcionário ou especialidade" />
        </label>
      </div>

      <section className="painel overflow-hidden" aria-label="Consultas">
        {filtradas.length === 0 ? (
          <p className="text-center py-12 text-[14px]" style={{ color: 'var(--tinta-3)' }}>
            {consultas.length === 0
              ? <>Nenhuma consulta registrada.{canManage && ' Cadastre a primeira solicitação.'}</>
              : <>Nenhuma consulta com esses filtros ({consultas.length} no total).</>}
          </p>
        ) : (
          // Sem rolagem de lado (regra de 08/10/2026): em tela estreita, cartão.
          <table className="tabela tabela-empilha">
            <thead>
              <tr>
                <th scope="col">Funcionário</th>
                <th scope="col">Especialidade</th>
                <th scope="col">Pedido em</th>
                <th scope="col">Situação</th>
                {canManage && <th scope="col"><span className="sr-only">Ações</span></th>}
              </tr>
            </thead>
            <tbody>
              {filtradas.map(c => (
                <tr key={c.id}>
                  <td><b>{c.funcionario}</b></td>
                  <td data-rotulo="Especialidade">{c.especialidade}</td>
                  <td className="whitespace-nowrap" data-rotulo="Pedido em">
                    <span>{c.dataSolicitacao || '—'}{esperaTexto(c) && <span className="sub">{esperaTexto(c)}</span>}</span>
                  </td>
                  <td className="whitespace-nowrap" data-rotulo="Situação">
                    <span>
                      <b style={{ color: c.status === 'Atendido' ? 'var(--etapa-admissao)' : 'var(--etapa-triagem)' }}>{c.status}</b>
                      {c.dataAtendimento && <span className="sub">em {c.dataAtendimento}</span>}
                    </span>
                  </td>
                  {canManage && (
                    <td className="text-right whitespace-nowrap">
                      <span className="inline-flex gap-1.5">
                        {c.status === 'No aguardo' && (
                          <button type="button" className="btn btn-sm btn-primario" onClick={() => abrirAtendimento(c)}>Marcar atendida</button>
                        )}
                        <button type="button" className="btn btn-sm" onClick={() => abrirEdicao(c)}>Editar</button>
                        <button type="button" className="btn btn-sm btn-perigo" onClick={() => excluir(c)} aria-label={`Excluir a consulta de ${c.funcionario}`}><Trash2 aria-hidden="true" /></button>
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {showForm && (
        <Modal
          titulo={editing ? 'Editar consulta' : 'Nova consulta'}
          antes={editing ? editing.funcionario : undefined}
          largura="sm"
          aoFechar={() => setShowForm(false)}
          rodape={<>
            <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
            <button type="button" className="btn btn-primario" onClick={salvar}>{editing ? 'Salvar alterações' : 'Cadastrar'}</button>
          </>}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="block col-span-2"><span className="rotulo">Funcionário *</span>
              <input className="campo w-full" value={form.funcionario} onChange={e => set('funcionario', e.target.value)} />
            </label>
            <label className="block col-span-2"><span className="rotulo">Especialidade *</span>
              <input className="campo w-full" list="cons-especialidades" value={form.especialidade} onChange={e => set('especialidade', e.target.value)} />
              {/* Sugere as já usadas: "Cardiologia" e "cardiologista" viravam duas no filtro. */}
              <datalist id="cons-especialidades">{opcoesEspecialidade.map(o => <option key={o.valor} value={o.valor} />)}</datalist>
            </label>
            <label className="block"><span className="rotulo">Pedido em *</span>
              <input type="date" className="campo w-full" value={toISOInput(form.dataSolicitacao)} onChange={e => set('dataSolicitacao', e.target.value ? formatDateBR(e.target.value) : '')} />
            </label>
            <label className="block"><span className="rotulo">Situação *</span>
              <select className="campo w-full" value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUS_CONSULTA.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="block col-span-2"><span className="rotulo">Atendida em {form.status === 'Atendido' ? '*' : ''}</span>
              <input type="date" disabled={form.status !== 'Atendido'} className="campo campo-sel w-full" value={toISOInput(form.dataAtendimento)}
                onChange={e => set('dataAtendimento', e.target.value ? formatDateBR(e.target.value) : '')} />
              {form.status !== 'Atendido' && <span className="ajuda block">Libera quando a situação for Atendido.</span>}
            </label>
            {erros.length > 0 && (
              <ul role="alert" className="erro-form col-span-2 space-y-1">{erros.map(erro => <li key={erro}>{erro}</li>)}</ul>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
