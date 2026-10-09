import React, { useMemo, useRef, useState } from 'react';
import { Integracao } from '../types';
import { Sede } from '../hooks/useMetadata';
import { parseIntegracoes, ImportableIntegracao } from '../lib/integracaoImport';
import { listarAbas, ehAbaDeDados, parseIntegracoesColegio } from '../lib/integracaoColegioImport';
import { toISOInput, formatDateBR } from '../utils/date';
import { exportToXlsx } from '../utils/xlsxExporter';
import { Search, Plus, Trash2, Upload, Download, Loader2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { FiltroMultiplo } from './ui/FiltroMultiplo';
import { Kpi } from './indicadores/ui';

/**
 * Módulo "Integração" (treinamento de integração / onboarding).
 *
 * Nasceu exclusivo da Universidade; o Colégio passou a fazer integração
 * também, então atende as duas unidades — a lista que chega já vem escopada
 * pelo App, e as sedes oferecidas são as da unidade do usuário.
 *
 * As duas planilhas têm formatos diferentes e o importador decide sozinho:
 *  - UNIVERSIDADE: uma aba por campus, com nomes fixos → lê todas de uma vez.
 *  - COLÉGIO: abas por ano ("2026 Geral", "2025 pedagógico"…) → o usuário
 *    escolhe a aba, porque a lista muda a cada ano.
 */
interface IntegracoesSectionProps {
  integracoes: Integracao[];
  sedes: Sede[]; // sedes da unidade do usuário (o App já filtra)
  addIntegracao: (i: ImportableIntegracao) => Promise<void>;
  updateIntegracao: (id: string, f: Partial<Integracao>) => Promise<void>;
  deleteIntegracao: (id: string) => Promise<void>;
  importIntegracoes: (list: ImportableIntegracao[]) => Promise<{ adicionadas: number; puladas: number }>;
  confirmAction?: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
  notify?: (msg: string, type?: 'error' | 'success' | 'info' | 'warning') => void;
  canManage?: boolean;
  // Mudança rápida de status pela tabela (sem abrir o modal). Se ausente, usa updateIntegracao.
  onChangeStatus?: (id: string, status: Integracao['status']) => void;
}

/** Cor da situação (tokens de ui.css): feita, pendente, saiu. */
const COR_STATUS: Record<Integracao['status'], string> = {
  'Realizado': 'var(--etapa-admissao)',
  'Não realizado': 'var(--etapa-triagem)',
  'Desligado': 'var(--tinta-3)',
};

const STATUS_OPCOES: Integracao['status'][] = ['Realizado', 'Não realizado', 'Desligado'];

const FORM_VAZIO = { nome: '', funcao: '', setor: '', sede: '', admissao: '', supervisor: '', status: 'Não realizado' as Integracao['status'], dataIntegracao: '', responsavel: '', contato: '', observacao: '' };

export const IntegracoesSection: React.FC<IntegracoesSectionProps> = ({
  integracoes, sedes, addIntegracao, updateIntegracao, deleteIntegracao, importIntegracoes,
  confirmAction, notify, canManage = true, onChangeStatus
}) => {
  // Fluxo da planilha do Colégio: precisa de escolha de aba, então o arquivo
  // fica retido até o usuário decidir. `null` = nenhum arquivo desse tipo.
  const [arquivoColegio, setArquivoColegio] = useState<{ file: File; abas: string[] } | null>(null);
  // Mudança inline de status (leve): usa o handler dedicado se houver, senão o update comum.
  const mudarStatus = (i: Integracao, novo: Integracao['status']) => {
    if (novo === i.status) return;
    if (onChangeStatus) onChangeStatus(i.id, novo);
    else updateIntegracao(i.id, { status: novo });
  };
  const [busca, setBusca] = useState('');
  // Múltipla escolha (regra de 08/10/2026); nada marcado = todos.
  const [sedesSel, setSedesSel] = useState<string[]>([]);
  const [statusSel, setStatusSel] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Integracao | null>(null);
  const [form, setForm] = useState({ ...FORM_VAZIO });
  const [importando, setImportando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof FORM_VAZIO, v: string) => setForm(f => ({ ...f, [k]: v }));

  const filtradas = useMemo(() => integracoes.filter(i => {
    const t = busca.toLowerCase();
    const okBusca = !t || i.nome.toLowerCase().includes(t) || (i.funcao || '').toLowerCase().includes(t) || (i.supervisor || '').toLowerCase().includes(t);
    const okSede = !sedesSel.length || sedesSel.includes(i.sede);
    const okStatus = !statusSel.length || statusSel.includes(i.status);
    return okBusca && okSede && okStatus;
  }), [integracoes, busca, sedesSel, statusSel]);

  const kpi = useMemo(() => {
    const ativos = integracoes.filter(i => i.status !== 'Desligado');
    const realizados = integracoes.filter(i => i.status === 'Realizado').length;
    const pendentes = integracoes.filter(i => i.status === 'Não realizado').length;
    const taxa = ativos.length ? Math.round((realizados / ativos.length) * 100) : 0;
    return { total: integracoes.length, realizados, pendentes, taxa };
  }, [integracoes]);

  const abrirNovo = () => { setEditing(null); setForm({ ...FORM_VAZIO, sede: sedes[0]?.nome || '' }); setShowForm(true); };
  const abrirEdicao = (i: Integracao) => {
    setEditing(i);
    setForm({ nome: i.nome, funcao: i.funcao || '', setor: i.setor || '', sede: i.sede, admissao: i.admissao || '', supervisor: i.supervisor || '', status: i.status, dataIntegracao: i.dataIntegracao || '', responsavel: i.responsavel || '', contato: i.contato || '', observacao: i.observacao || '' });
    setShowForm(true);
  };

  const salvar = async () => {
    if (!form.nome.trim() || !form.sede) { notify?.('Preencha pelo menos Nome e Campus.', 'warning'); return; }
    const payload = { ...form, nome: form.nome.trim() };
    if (editing) await updateIntegracao(editing.id, payload);
    else await addIntegracao(payload);
    setShowForm(false);
  };

  const excluir = (i: Integracao) => {
    const acao = async () => { await deleteIntegracao(i.id); };
    if (confirmAction) confirmAction('Excluir registro', `Remover a integração de "${i.nome}"?`, acao);
    else if (confirm(`Remover a integração de "${i.nome}"?`)) acao();
  };

  /** Aplica o resultado de um parser à coleção, com o mesmo aviso ao usuário. */
  const gravar = async (lidas: ImportableIntegracao[], avisos: string[], rotulo: string) => {
    if (!lidas.length) { notify?.(`Nenhum registro reconhecido em ${rotulo}.`, 'warning'); return; }
    const { adicionadas, puladas } = await importIntegracoes(lidas);
    notify?.(`Importação concluída: ${adicionadas} adicionada(s), ${puladas} duplicada(s) pulada(s).${avisos.length ? ` (${avisos.length} aviso(s) no console)` : ''}`, 'success');
    if (avisos.length) console.warn('Avisos do import de integrações:', avisos);
  };

  const importarAbaColegio = async (aba: string) => {
    if (!arquivoColegio || !aba) return;
    setImportando(true);
    try {
      const { integracoes: lidas, ignoradas } = await parseIntegracoesColegio(arquivoColegio.file, aba);
      await gravar(lidas, ignoradas, `na aba "${aba}"`);
      setArquivoColegio(null);
    } catch (e: any) {
      notify?.(`Erro ao importar: ${e?.message || e}`, 'error');
    } finally {
      setImportando(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const importar = async (file: File) => {
    setImportando(true);
    try {
      // A planilha do Colégio tem abas por ano; a da Universidade, por campus.
      // Se houver aba de dados que NÃO é campus conhecido, é a do Colégio e
      // precisamos perguntar qual ano importar.
      const abas = (await listarAbas(file)).filter(ehAbaDeDados);
      const { integracoes: lidas, warnings } = await parseIntegracoes(file);
      if (!lidas.length && abas.length) {
        setArquivoColegio({ file, abas });
        notify?.('Planilha do Colégio: escolha a aba (ano) que quer importar.', 'info');
        return;
      }
      await gravar(lidas, warnings, 'na planilha');
    } catch (e: any) {
      notify?.(`Erro ao importar: ${e?.message || e}`, 'error');
    } finally {
      setImportando(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const exportar = async () => {
    if (!filtradas.length) { notify?.('Nada para exportar com os filtros atuais.', 'warning'); return; }
    const columns = [
      { title: 'Nome', width: 32 }, { title: 'Função', width: 24 }, { title: 'Setor', width: 16 },
      { title: 'Campus', width: 22 }, { title: 'Admissão', width: 12 }, { title: 'Supervisor', width: 20 },
      { title: 'Integração', width: 14 }, { title: 'Data', width: 16 }, { title: 'Responsável', width: 16 },
      { title: 'Contato', width: 16 }, { title: 'Observação', width: 30 }
    ];
    const rows = filtradas.map(i => [
      { type: String, value: i.nome }, { type: String, value: i.funcao || null }, { type: String, value: i.setor || null },
      { type: String, value: i.sede }, { type: String, value: i.admissao || null }, { type: String, value: i.supervisor || null },
      { type: String, value: i.status }, { type: String, value: i.dataIntegracao || null }, { type: String, value: i.responsavel || null },
      { type: String, value: i.contato || null }, { type: String, value: i.observacao || null }
    ]);
    await exportToXlsx(`integracoes_${new Date().toISOString().slice(0, 10)}.xlsx`, columns, rows, { sheet: 'Integrações' });
  };

  return (
    <div className="space-y-5">
      <header className="pagina-cab">
        <div className="min-w-0">
          <p className="pagina-trilha">Pessoas</p>
          <h1 className="pagina-titulo">Integração</h1>
          <p className="inicio-sub">Treinamento de integração dos novos colaboradores, por campus.</p>
        </div>
        <div className="pagina-acoes">
          <button type="button" className="btn" onClick={exportar}><Download aria-hidden="true" /> Exportar</button>
          {canManage && (
            <>
              <input ref={fileRef} type="file" accept=".xlsx" className="hidden" aria-label="Planilha de integração" onChange={e => { const f = e.target.files?.[0]; if (f) importar(f); }} />
              <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={importando}>
                {importando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />} Importar planilha
              </button>
              <button type="button" className="btn btn-primario" onClick={abrirNovo}><Plus aria-hidden="true" /> Nova integração</button>
            </>
          )}
        </div>
      </header>

      {/* Escolha da aba — só aparece para a planilha do Colégio, que é por ano */}
      {arquivoColegio && (
        <div className="painel p-4 flex flex-col sm:flex-row sm:items-end gap-3">
          <label className="block flex-1">
            <span className="rotulo">Aba a importar de "{arquivoColegio.file.name}"</span>
            <select className="campo w-full" defaultValue="" disabled={importando} onChange={e => importarAbaColegio(e.target.value)}>
              <option value="">Escolha o ano…</option>
              {arquivoColegio.abas.map(aba => <option key={aba} value={aba}>{aba}</option>)}
            </select>
          </label>
          <button type="button" className="btn" onClick={() => { setArquivoColegio(null); if (fileRef.current) fileRef.current.value = ''; }}>Cancelar</button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi rotulo="Registros" valor={kpi.total} />
        <Kpi rotulo="Realizadas" valor={kpi.realizados} tom={kpi.realizados ? 'bom' : 'neutro'} />
        <Kpi rotulo="Pendentes" valor={kpi.pendentes} tom={kpi.pendentes ? 'atencao' : 'neutro'} />
        <Kpi rotulo="Taxa de realização" valor={`${kpi.taxa}%`} detalhe="entre quem segue na empresa" />
      </div>

      {/* Todo filtro é de múltipla escolha (regra de 08/10/2026). */}
      <div className="filtros">
        <FiltroMultiplo rotulo="Campus" todos="todos" selecionados={sedesSel} onChange={setSedesSel}
          opcoes={sedes.map(s => ({ valor: s.nome, rotulo: s.nome }))} />
        <FiltroMultiplo rotulo="Situação" todos="todas" selecionados={statusSel} onChange={setStatusSel}
          opcoes={STATUS_OPCOES.map(s => ({ valor: s, rotulo: s }))} />
        <label className="campo-busca">
          <Search aria-hidden="true" />
          <input type="search" className="campo" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar nome, função ou supervisor" aria-label="Buscar nome, função ou supervisor" />
        </label>
      </div>

      <section className="painel overflow-hidden" aria-label="Integrações">
        {filtradas.length === 0 ? (
          <p className="text-center py-12 text-[14px]" style={{ color: 'var(--tinta-3)' }}>
            Nenhuma integração com esses filtros.{canManage && !integracoes.length && ' Importe a planilha ou cadastre a primeira.'}
          </p>
        ) : (
          // Sem rolagem de lado (regra de 08/10/2026): em tela estreita, cartão.
          <table className="tabela tabela-empilha">
            <thead>
              <tr>
                <th scope="col">Colaborador</th>
                <th scope="col">Campus</th>
                <th scope="col">Admissão</th>
                <th scope="col">Integração</th>
                <th scope="col">Quando</th>
                {canManage && <th scope="col"><span className="sr-only">Ações</span></th>}
              </tr>
            </thead>
            <tbody>
              {filtradas.map(i => (
                <tr key={i.id}>
                  <td>
                    <span>
                      <b>{i.nome}</b>
                      <span className="sub">{[i.funcao, i.setor, i.supervisor && `sup. ${i.supervisor}`].filter(Boolean).join(' · ') || '—'}</span>
                    </span>
                  </td>
                  <td data-rotulo="Campus">{i.sede}</td>
                  <td className="whitespace-nowrap" data-rotulo="Admissão">{i.admissao || '—'}</td>
                  <td data-rotulo="Integração">
                    {canManage ? (
                      // Troca rápida, sem abrir o formulário.
                      <select className="campo campo-sel font-semibold" style={{ color: COR_STATUS[i.status] }} value={i.status}
                        onChange={e => mudarStatus(i, e.target.value as Integracao['status'])} aria-label={`Integração de ${i.nome}`}>
                        {STATUS_OPCOES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <b style={{ color: COR_STATUS[i.status] }}>{i.status}</b>
                    )}
                  </td>
                  <td data-rotulo="Quando">
                    <span>{i.dataIntegracao || '—'}{i.responsavel && <span className="sub">{i.responsavel}</span>}</span>
                  </td>
                  {canManage && (
                    <td className="text-right whitespace-nowrap">
                      <span className="inline-flex gap-1.5">
                        <button type="button" className="btn btn-sm" onClick={() => abrirEdicao(i)}>Editar</button>
                        <button type="button" className="btn btn-sm btn-perigo" onClick={() => excluir(i)} aria-label={`Excluir integração de ${i.nome}`}><Trash2 aria-hidden="true" /></button>
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
          titulo={editing ? 'Editar integração' : 'Nova integração'}
          antes={editing ? editing.nome : undefined}
          aoFechar={() => setShowForm(false)}
          rodape={<>
            <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
            <button type="button" className="btn btn-primario" onClick={salvar}>{editing ? 'Salvar alterações' : 'Cadastrar'}</button>
          </>}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block sm:col-span-2"><span className="rotulo">Nome *</span><input className="campo w-full" value={form.nome} onChange={e => set('nome', e.target.value)} /></label>
            <label className="block"><span className="rotulo">Função</span><input className="campo w-full" value={form.funcao} onChange={e => set('funcao', e.target.value)} /></label>
            <label className="block"><span className="rotulo">Setor</span><input className="campo w-full" value={form.setor} onChange={e => set('setor', e.target.value)} /></label>
            <label className="block"><span className="rotulo">Campus *</span>
              <select className="campo w-full" value={form.sede} onChange={e => set('sede', e.target.value)}>
                <option value="">Escolha…</option>
                {sedes.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
              </select>
            </label>
            <label className="block"><span className="rotulo">Admissão</span><input type="date" className="campo w-full" value={toISOInput(form.admissao)} onChange={e => set('admissao', e.target.value ? formatDateBR(e.target.value) : '')} /></label>
            <label className="block"><span className="rotulo">Supervisor</span><input className="campo w-full" value={form.supervisor} onChange={e => set('supervisor', e.target.value)} /></label>
            <label className="block"><span className="rotulo">Integração</span>
              <select className="campo w-full" value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUS_OPCOES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="block"><span className="rotulo">Quando foi (ou será)</span><input className="campo w-full" value={form.dataIntegracao} onChange={e => set('dataIntegracao', e.target.value)} placeholder="Ex.: 19/08 às 14h" /></label>
            <label className="block"><span className="rotulo">Responsável</span><input className="campo w-full" value={form.responsavel} onChange={e => set('responsavel', e.target.value)} /></label>
            <label className="block"><span className="rotulo">Contato</span><input className="campo w-full" value={form.contato} onChange={e => set('contato', e.target.value)} /></label>
            <label className="block sm:col-span-2"><span className="rotulo">Observação</span><textarea rows={2} className="campo w-full" value={form.observacao} onChange={e => set('observacao', e.target.value)} /></label>
          </div>
        </Modal>
      )}
    </div>
  );
};
