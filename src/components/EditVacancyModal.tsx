import React, { useState, useEffect } from 'react';
import { Vaga } from '../types';
import { dateFromValue, toISOInput, formatDateBR, monthAbbrFromDate, dataISOLocal } from '../utils/date';
import { MOTIVOS_DESISTENCIA } from '../constants/hr';
import { normalizeEtapa, etapasDoEditar, statusDoEditar, encerrada } from '../utils/vaga';
import { Sede, Cargo, Setor } from '../hooks/useMetadata';
import { Modal } from './ui/Modal';

interface EditVacancyModalProps {
  vaga: Vaga;
  cargos?: Cargo[];
  sedes?: Sede[];
  setores?: Setor[];
  onClose: () => void;
  onSave: (id: string, updatedFields: Partial<Vaga>) => Promise<void>;
  /** Presente = a vaga tem seleção ligada e o funil vem dela (só leitura). */
  funilAutomatico?: { chamados: number; compareceram: number; aprovados: number; selecoes: number };
  /** Abre o Concluir com a vaga já salva (botão "Salvar e concluir a vaga"). */
  onConcluir?: (vaga: Vaga) => void;
}

export const EditVacancyModal: React.FC<EditVacancyModalProps> = ({ vaga, cargos, sedes, setores, funilAutomatico, onClose, onSave, onConcluir }) => {
  const [tempStatus, setTempStatus] = useState<Vaga['status']>('ABERTA');
  const [tempEtapa, setTempEtapa] = useState('');
  const [tempAprovado, setTempAprovado] = useState('');
  const [tempObservacoes, setTempObservacoes] = useState('');
  const [tempResponsavel, setTempResponsavel] = useState('');
  const [tempConclusao, setTempConclusao] = useState('');
  const [tempTempoProcesso, setTempTempoProcesso] = useState<number>(0);

  const [tempVagaName, setTempVagaName] = useState('');
  const [tempSede, setTempSede] = useState('');
  const [tempSetor, setTempSetor] = useState('');
  const [tempSexo, setTempSexo] = useState<Vaga['sexo']>('INDIFERENTE');
  const [tempSolicitacao, setTempSolicitacao] = useState('');
  const [tempSolicitante, setTempSolicitante] = useState('');
  const [tempMotivo, setTempMotivo] = useState('');
  const [tempMotivoOutro, setTempMotivoOutro] = useState('');
  const [tempFuncionarioSubstituido, setTempFuncionarioSubstituido] = useState('');

  // Funil de candidatos + motivo de desistência padronizado
  const [tempCandChamados, setTempCandChamados] = useState<number>(0);
  const [tempCandCompareceram, setTempCandCompareceram] = useState<number>(0);
  const [tempCandAprovados, setTempCandAprovados] = useState<number>(0);
  const [tempMotivoDesistencia, setTempMotivoDesistencia] = useState('');

  // Cancelada (27/10/2026): exige motivo e sai dos indicadores.
  const [tempMotivoCancelamento, setTempMotivoCancelamento] = useState('');
  const [faltaMotivo, setFaltaMotivo] = useState(false);

  const statusList = statusDoEditar(vaga.status);

  useEffect(() => {
    setTempStatus(vaga.status || 'ABERTA');
    setTempEtapa(normalizeEtapa(vaga));
    setTempAprovado(vaga.aprovado || '');
    setTempObservacoes(vaga.observacoes || '');
    setTempResponsavel(vaga.responsavel || '');
    setTempConclusao(vaga.conclusao || '');
    setTempTempoProcesso(vaga.tempoProcesso || 0);

    setTempVagaName(vaga.vaga || '');
    setTempSede(vaga.sede || '');
    setTempSetor(vaga.setor || '');
    setTempSexo(vaga.sexo || 'INDIFERENTE');

    setTempSolicitacao(toISOInput(vaga.solicitacao));

    setTempSolicitante(vaga.solicitante || '');
    
    if (vaga.motivo?.startsWith('Outros:')) {
      setTempMotivo('Outros');
      setTempMotivoOutro(vaga.motivo.replace('Outros:', '').trim());
    } else {
      setTempMotivo(vaga.motivo || '');
      setTempMotivoOutro('');
    }

    setTempFuncionarioSubstituido(vaga.funcionarioSubstituido || '');

    setTempCandChamados(vaga.candChamados || 0);
    setTempCandCompareceram(vaga.candCompareceram || 0);
    setTempCandAprovados(vaga.candAprovados || 0);
    setTempMotivoDesistencia(vaga.motivoDesistencia || '');
    setTempMotivoCancelamento(vaga.motivoCancelamento || '');
    setFaltaMotivo(false);
  }, [vaga]);

  /** `concluir`: depois de salvar, abre o Concluir com a vaga já atualizada. */
  const handleSave = async (concluir = false) => {
    const cancelando = tempStatus === 'CANCELADA';
    if (cancelando && !tempMotivoCancelamento.trim()) { setFaltaMotivo(true); return; }
    let finalSolicitacao = vaga.solicitacao;
    let finalMesSolicitacao = vaga.mesSolicitacao;
    if (tempSolicitacao && tempSolicitacao !== vaga.solicitacao) {
      const d = dateFromValue(tempSolicitacao);
      if (d) {
        finalSolicitacao = formatDateBR(d);
        finalMesSolicitacao = monthAbbrFromDate(d);
      }
    }

    // Automatically match months text based on completion date
    let rawMonthConclusao = vaga.mesConclusao;
    if (tempConclusao && tempConclusao !== vaga.conclusao) {
      const d = dateFromValue(tempConclusao);
      if (d) rawMonthConclusao = monthAbbrFromDate(d);
    }

    const finalMotivoVal = tempMotivo === 'Outros' && tempMotivoOutro.trim() 
      ? `Outros: ${tempMotivoOutro.trim()}`
      : tempMotivo;

    const campos: Partial<Vaga> = {
      vaga: tempVagaName,
      sede: tempSede,
      setor: tempSetor,
      sexo: tempSexo,
      solicitante: tempSolicitante,
      motivo: finalMotivoVal,
      funcionarioSubstituido: tempFuncionarioSubstituido,
      solicitacao: finalSolicitacao,
      mesSolicitacao: finalMesSolicitacao,
      status: tempStatus,
      // Etapa da lista do funil (27/10/2026; antes era texto livre). Só grava se
      // mudou: regravar "Triagem de currículos" como "Triagem" zeraria os dias
      // na etapa. O status não acompanha: cruzar a documentação é pelo Quadro
      // (etapasDoEditar nem oferece), que registra quem segue ou a desistência.
      ...(tempEtapa !== normalizeEtapa(vaga) ? { etapa: tempEtapa } : {}),
      aprovado: tempAprovado,
      observacoes: tempObservacoes,
      responsavel: tempResponsavel,
      conclusao: tempConclusao,
      tempoProcesso: Number(tempTempoProcesso) || 0,
      mesConclusao: rawMonthConclusao,
      categoriaMotivo: finalMotivoVal.includes('Aumento') ? 'Aumento de Quadro' : (finalMotivoVal.includes('Outro') ? 'Outros' : 'Substituição'),
      ...(funilAutomatico ? {} : {
        candChamados: Number(tempCandChamados) || 0,
        candCompareceram: Number(tempCandCompareceram) || 0,
        candAprovados: Number(tempCandAprovados) || 0,
      }),
      motivoDesistencia: tempMotivoDesistencia,
      // Reaberta depois de cancelada: o motivo antigo sai junto.
      ...(cancelando
        ? { motivoCancelamento: tempMotivoCancelamento.trim(), canceladaEm: vaga.status === 'CANCELADA' && vaga.canceladaEm ? vaga.canceladaEm : dataISOLocal() }
        : vaga.status === 'CANCELADA' ? { motivoCancelamento: '', canceladaEm: '' } : {}),
    };
    await onSave(vaga.id, campos);

    onClose();
    if (concluir) onConcluir?.({ ...vaga, ...campos });
  };

  // Preencher o aprovado NÃO fecha a vaga (21/10/2026: o RH da Universidade
  // preenchia, salvava e a vaga seguia em Documentação — "fechei e voltou").
  // Fechar é concluir: data de conclusão, Experiência, contratado na seleção.
  const aprovadoSemConcluir = !!onConcluir && !!tempAprovado.trim() && !encerrada(tempStatus) && !encerrada(vaga.status);

  return (
    <Modal
      largura="lg"
      aoFechar={onClose}
      antes={<span>Vaga nº {vaga.codigo}</span>}
      titulo={`Editar: ${vaga.vaga}`}
      rodape={<>
        <button type="button" className="btn" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn btn-primario" onClick={() => handleSave()}>Salvar alterações</button>
      </>}
    >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="modal-vaga" className="block text-[13px] font-semibold text-slate-700 mb-1">Cargo / Vaga *</label>
              <input
                id="modal-vaga"
                type="text"
                required
                list="modalCargoSuggestions"
                className="campo w-full"
                value={tempVagaName}
                onChange={(e) => setTempVagaName(e.target.value)}
              />
              <datalist id="modalCargoSuggestions">
                {[...(cargos || [])].sort((a,b) => (a.nome || '').localeCompare(b.nome || '')).map(c => (
                  <option key={c.id} value={c.nome} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="modal-solicitante" className="block text-[13px] font-semibold text-slate-700 mb-1">Gestor Solicitante *</label>
              <input
                id="modal-solicitante"
                type="text"
                required
                className="campo w-full"
                value={tempSolicitante}
                onChange={(e) => setTempSolicitante(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="modal-sede" className="block text-[12px] font-bold text-slate-500 mb-1">Sede / Posto</label>
              <select
                id="modal-sede"
                className="w-full px-2 py-2 text-xs bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl text-slate-750 font-medium cursor-pointer"
                value={tempSede}
                onChange={(e) => setTempSede(e.target.value)}
              >
                {(sedes && sedes.length > 0 ? [...sedes.map(s => s.nome)] : ["Granja", "Sede Administrativa", "Caucaia", "Maracanaú", "Eusébio", "Sobral", "Juazeiro do Norte"]).sort((a,b) => a.localeCompare(b)).map((opt, idx) => (
                  <option key={idx} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="modal-setor" className="block text-[12px] font-bold text-slate-500 mb-1">Setor / Área</label>
              <select
                id="modal-setor"
                className="w-full px-2 py-2 text-xs bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl text-slate-750 font-medium cursor-pointer"
                value={tempSetor}
                onChange={(e) => setTempSetor(e.target.value)}
              >
                {(setores && setores.length > 0 
                  ? [...setores.map(s => s.nome)]
                  : [
                      "Almoxarifado", "Almoxarifado geral", "Atendimento", "Cantina", "Compras", 
                      "Comunicação Digital", "Construtora", "Coordenação", "CPA", "D. Valéria", 
                      "Idiomas DT", "Infra", "Infraestrutura", "Jurídico", "Livros escolares", 
                      "Lojinha", "Marketing", "Metalurgica", "MKT", "Pedagógico", "Redes", 
                      "Secretaria", "Som", "TI"
                    ]
                ).sort((a,b) => a.localeCompare(b)).map((opt, idx) => (
                  <option key={idx} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="modal-sexo" className="block text-[12px] font-bold text-slate-500 mb-1">Sexo Prefer.</label>
              <select
                id="modal-sexo"
                className="w-full px-2 py-2 text-xs bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl text-slate-750 font-medium cursor-pointer"
                value={tempSexo}
                onChange={(e) => setTempSexo(e.target.value as Vaga['sexo'])}
              >
                <option value="INDIFERENTE">Indiferente</option>
                <option value="FEMININO">Feminino</option>
                <option value="MASCULINO">Masculino</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="modal-solicitacao" className="block text-[13px] font-semibold text-slate-700 mb-1">Data Solicitação *</label>
              <input
                id="modal-solicitacao"
                type="date"
                required
                className="campo w-full"
                value={tempSolicitacao}
                onChange={(e) => setTempSolicitacao(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="modal-motivo" className="block text-[13px] font-semibold text-slate-700 mb-1">Motivo Solicitação</label>
              <select
                id="modal-motivo"
                className="campo w-full"
                value={tempMotivo}
                onChange={(e) => setTempMotivo(e.target.value)}
              >
                {[
                  "Substituição", "Aumento de Quadro", "Aumento de Quadro (Temporário)",
                  "Substituição (Licença Maternidade)", "Substituição (Afastamento)", "Nova Filial", "Outros"
                ].sort((a,b) => a.localeCompare(b)).map((opt, idx) => (
                  <option key={idx} value={opt}>{opt}</option>
                ))}
              </select>
              {tempMotivo === 'Outros' && (
                <div className="mt-2">
                  <input aria-label="Especifique o motivo..."
                    type="text"
                    className="campo w-full"
                    placeholder="Especifique o motivo..."
                    value={tempMotivoOutro}
                    onChange={(e) => setTempMotivoOutro(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="modal-substituido" className="block text-[13px] font-semibold text-slate-700 mb-1">Substituído (Se houver)</label>
              <input
                id="modal-substituido"
                type="text"
                className="campo w-full"
                placeholder="Ex: João Ferreira da Silva"
                value={tempFuncionarioSubstituido}
                onChange={(e) => setTempFuncionarioSubstituido(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="modal-responsavel" className="block text-[13px] font-semibold text-slate-700 mb-1">Responsável RH</label>
              <input
                id="modal-responsavel"
                type="text"
                className="campo w-full"
                placeholder="Nome do recruiter"
                value={tempResponsavel}
                onChange={(e) => setTempResponsavel(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="modal-status" className="block text-[13px] font-semibold text-slate-700 mb-1">Status</label>
              <select
                id="modal-status"
                className="campo w-full"
                value={tempStatus}
                onChange={(e) => setTempStatus(e.target.value as Vaga['status'])}
              >
                {statusList.map((st, idx) => (
                  <option key={idx} value={st}>{st === 'FECHADA' ? 'CONCLUÍDA' : st}</option>
                ))}
              </select>
            </div>
            {tempStatus === 'CANCELADA' && (
              <div className="col-span-2">
                <label htmlFor="modal-motivo-cancelamento" className="block text-[13px] font-semibold text-slate-700 mb-1">Motivo do cancelamento <span className="text-orange-500">*</span></label>
                <textarea
                  id="modal-motivo-cancelamento"
                  rows={2}
                  className="campo w-full"
                  placeholder="Ex.: gestor desistiu da vaga, remanejamento interno"
                  value={tempMotivoCancelamento}
                  aria-invalid={faltaMotivo || undefined}
                  onChange={(e) => { setTempMotivoCancelamento(e.target.value); setFaltaMotivo(false); }}
                />
                <p className="text-[12.5px] mt-1" style={{ color: faltaMotivo ? 'var(--atraso)' : 'var(--tinta-3)' }} role={faltaMotivo ? 'alert' : undefined}>
                  {faltaMotivo ? 'Diga o motivo para cancelar a vaga.' : 'A vaga cancelada sai do quadro e dos indicadores; fica em "Canceladas".'}
                </p>
              </div>
            )}

            <div>
              <label htmlFor="modal-etapa" className="block text-[13px] font-semibold text-slate-700 mb-1">Etapa Atual</label>
              <select
                id="modal-etapa"
                className="campo w-full"
                value={tempEtapa}
                onChange={(e) => setTempEtapa(e.target.value)}
              >
                {etapasDoEditar(vaga.status, normalizeEtapa(vaga)).map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              {vaga.status !== 'DOCUMENTAÇÃO' && !encerrada(vaga.status) && (
                <p className="text-[12px] mt-1" style={{ color: 'var(--tinta-3)' }}>Para a documentação, use "Para Admissão" no quadro: ele registra quem segue.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label htmlFor="modal-aprovado" className="block text-[13px] font-semibold text-slate-700 mb-1">Candidato Aprovado</label>
              <input
                id="modal-aprovado"
                type="text"
                className="campo w-full"
                placeholder="Nome do selecionado"
                value={tempAprovado}
                onChange={(e) => setTempAprovado(e.target.value)}
              />
              {aprovadoSemConcluir && (
                <div role="status" className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-[13px] text-amber-900">
                    Preencher o aprovado <b>não fecha a vaga</b>: ela continua em {tempStatus === 'DOCUMENTAÇÃO' ? 'Documentação' : tempStatus.charAt(0) + tempStatus.slice(1).toLowerCase()}. Para fechar, conclua.
                  </p>
                  <button type="button" className="btn btn-sm btn-primario" onClick={() => handleSave(true)}>Salvar e concluir a vaga</button>
                </div>
              )}
            </div>
          </div>

          {/* Funil de candidatos + motivo de desistência (indicadores do processo) */}
          <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100 space-y-3">
            <p className="text-xs font-bold text-slate-500">Funil de candidatos</p>
            {funilAutomatico && (
              <p className="text-[12.5px] text-slate-600 font-semibold">
                Somado de {funilAutomatico.selecoes === 1 ? '1 seleção ligada' : `${funilAutomatico.selecoes} seleções ligadas`} — para mudar, lance no módulo Seleções.
              </p>
            )}
            <fieldset disabled={!!funilAutomatico} className="grid grid-cols-3 gap-3 disabled:opacity-80">
              <div>
                <label htmlFor="modal-chamados" className="block text-[12px] font-bold text-slate-400 mb-1">Chamados</label>
                <input
                  id="modal-chamados"
                  type="number"
                  min={0}
                  className="campo w-full"
                  value={funilAutomatico ? funilAutomatico.chamados : tempCandChamados}
                  onChange={(e) => setTempCandChamados(Number(e.target.value))}
                />
              </div>
              <div>
                <label htmlFor="modal-compareceram" className="block text-[12px] font-bold text-slate-400 mb-1">Compareceram</label>
                <input
                  id="modal-compareceram"
                  type="number"
                  min={0}
                  className="campo w-full"
                  value={funilAutomatico ? funilAutomatico.compareceram : tempCandCompareceram}
                  onChange={(e) => setTempCandCompareceram(Number(e.target.value))}
                />
              </div>
              <div>
                <label htmlFor="modal-aprovados" className="block text-[12px] font-bold text-slate-400 mb-1">Aprovados</label>
                <input
                  id="modal-aprovados"
                  type="number"
                  min={0}
                  className="campo w-full"
                  value={funilAutomatico ? funilAutomatico.aprovados : tempCandAprovados}
                  onChange={(e) => setTempCandAprovados(Number(e.target.value))}
                />
              </div>
            </fieldset>
            <div>
              <label htmlFor="modal-desistencia" className="block text-[12px] font-bold text-slate-400 mb-1">Motivo de desistência (se houve)</label>
              <select
                id="modal-desistencia"
                className="campo w-full"
                value={tempMotivoDesistencia}
                onChange={(e) => setTempMotivoDesistencia(e.target.value)}
              >
                <option value="">— Nenhum / não se aplica —</option>
                {MOTIVOS_DESISTENCIA.map((m, i) => (
                  <option key={i} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {tempStatus === 'FECHADA' && (
            <div className="grid grid-cols-2 gap-4 bg-orange-50/45 p-4 rounded-2xl border border-orange-100">
              <div>
                <label htmlFor="modal-conclusao" className="block text-xs font-bold text-orange-900 mb-1">Data Conclusão</label>
                <input
                  id="modal-conclusao"
                  type="text"
                  className="w-full px-2 py-1.5 text-sm bg-white border border-orange-200 rounded-lg text-orange-950 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  placeholder="DD/MM/YYYY"
                  value={tempConclusao}
                  onChange={(e) => setTempConclusao(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="modal-process-time" className="block text-xs font-bold text-orange-900 mb-1">Dias Processo (SLA)</label>
                <input
                  id="modal-process-time"
                  type="number"
                  className="w-full px-2 py-1.5 text-sm bg-white border border-orange-200 rounded-lg text-orange-950 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  placeholder="Número de dias"
                  value={tempTempoProcesso}
                  onChange={(e) => setTempTempoProcesso(Number(e.target.value))}
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="modal-observacoes" className="block text-[13px] font-semibold text-slate-700 mb-1">Observações do Processo</label>
            <textarea
              id="modal-observacoes"
              rows={3}
              className="campo w-full"
              placeholder="Informações adicionais da triagem, cancelamentos..."
              value={tempObservacoes}
              onChange={(e) => setTempObservacoes(e.target.value)}
            />
          </div>
        </div>

    </Modal>
  );
};
