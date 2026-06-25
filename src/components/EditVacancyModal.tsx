import React, { useState, useEffect } from 'react';
import { Vaga } from '../types';
import { dateFromValue, toISOInput, formatDateBR, monthAbbrFromDate } from '../utils/date';
import { MOTIVOS_DESISTENCIA } from '../constants/hr';
import { Sede, Cargo, Setor } from '../hooks/useMetadata';
import { Edit2 } from 'lucide-react';

interface EditVacancyModalProps {
  vaga: Vaga;
  cargos?: Cargo[];
  sedes?: Sede[];
  setores?: Setor[];
  onClose: () => void;
  onSave: (id: string, updatedFields: Partial<Vaga>) => Promise<void>;
}

export const EditVacancyModal: React.FC<EditVacancyModalProps> = ({ vaga, cargos, sedes, setores, onClose, onSave }) => {
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

  const statusList = ['ABERTA', 'REABERTA', 'DOCUMENTAÇÃO', 'SUSPENSA', 'PAUSADA', 'FECHADA'];

  useEffect(() => {
    setTempStatus(vaga.status || 'ABERTA');
    setTempEtapa(vaga.etapa || '');
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
  }, [vaga]);

  const handleSave = async () => {
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

    await onSave(vaga.id, {
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
      etapa: tempEtapa,
      aprovado: tempAprovado,
      observacoes: tempObservacoes,
      responsavel: tempResponsavel,
      conclusao: tempConclusao,
      tempoProcesso: Number(tempTempoProcesso) || 0,
      mesConclusao: rawMonthConclusao,
      categoriaMotivo: finalMotivoVal.includes('Aumento') ? 'Aumento de Quadro' : (finalMotivoVal.includes('Outro') ? 'Outros' : 'Substituição'),
      candChamados: Number(tempCandChamados) || 0,
      candCompareceram: Number(tempCandCompareceram) || 0,
      candAprovados: Number(tempCandAprovados) || 0,
      motivoDesistencia: tempMotivoDesistencia
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full transform transition duration-250 border border-slate-200 shadow-2xl flex flex-col scale-100 relative max-h-[90vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 flex items-center bg-slate-50 justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-50 text-orange-500 rounded-2xl shadow-sm">
              <Edit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Alterar Registro de Processo Seletivo</h3>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Vaga #{vaga.codigo} - {vaga.vaga}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 text-xl font-semibold leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Modal Form Content */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="modal-vaga" className="block text-xs font-bold text-slate-500 uppercase mb-1">Cargo / Vaga *</label>
              <input
                id="modal-vaga"
                type="text"
                required
                list="modalCargoSuggestions"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl text-slate-750 font-medium"
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
              <label htmlFor="modal-solicitante" className="block text-xs font-bold text-slate-500 uppercase mb-1">Gestor Solicitante *</label>
              <input
                id="modal-solicitante"
                type="text"
                required
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl text-slate-750 font-medium"
                value={tempSolicitante}
                onChange={(e) => setTempSolicitante(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="modal-sede" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sede / Posto</label>
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
              <label htmlFor="modal-setor" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Setor / Área</label>
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
              <label htmlFor="modal-sexo" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sexo Prefer.</label>
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
              <label htmlFor="modal-solicitacao" className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Solicitação *</label>
              <input
                id="modal-solicitacao"
                type="date"
                required
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl text-slate-750 font-medium"
                value={tempSolicitacao}
                onChange={(e) => setTempSolicitacao(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="modal-motivo" className="block text-xs font-bold text-slate-500 uppercase mb-1">Motivo Solicitação</label>
              <select
                id="modal-motivo"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl text-slate-750 font-medium cursor-pointer"
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
                  <input
                    type="text"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl text-slate-750 font-medium"
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
              <label htmlFor="modal-substituido" className="block text-xs font-bold text-slate-500 uppercase mb-1">Substituído (Se houver)</label>
              <input
                id="modal-substituido"
                type="text"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl text-slate-750 font-medium"
                placeholder="Ex: João Ferreira da Silva"
                value={tempFuncionarioSubstituido}
                onChange={(e) => setTempFuncionarioSubstituido(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="modal-responsavel" className="block text-xs font-bold text-slate-500 uppercase mb-1">Responsável RH</label>
              <input
                id="modal-responsavel"
                type="text"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                placeholder="Nome do recruiter"
                value={tempResponsavel}
                onChange={(e) => setTempResponsavel(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="modal-status" className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
              <select
                id="modal-status"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl cursor-pointer"
                value={tempStatus}
                onChange={(e) => setTempStatus(e.target.value as Vaga['status'])}
              >
                {statusList.map((st, idx) => (
                  <option key={idx} value={st}>{st === 'FECHADA' ? 'CONCLUÍDA' : st}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="modal-etapa" className="block text-xs font-bold text-slate-500 uppercase mb-1">Etapa Atual</label>
              <input
                id="modal-etapa"
                type="text"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                placeholder="Ex: Entrevista, Triagem, etc."
                value={tempEtapa}
                onChange={(e) => setTempEtapa(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label htmlFor="modal-aprovado" className="block text-xs font-bold text-slate-500 uppercase mb-1">Candidato Aprovado</label>
              <input
                id="modal-aprovado"
                type="text"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                placeholder="Nome do selecionado"
                value={tempAprovado}
                onChange={(e) => setTempAprovado(e.target.value)}
              />
            </div>
          </div>

          {/* Funil de candidatos + motivo de desistência (indicadores do processo) */}
          <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase">Funil de candidatos</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="modal-chamados" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Chamados</label>
                <input
                  id="modal-chamados"
                  type="number"
                  min={0}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                  value={tempCandChamados}
                  onChange={(e) => setTempCandChamados(Number(e.target.value))}
                />
              </div>
              <div>
                <label htmlFor="modal-compareceram" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Compareceram</label>
                <input
                  id="modal-compareceram"
                  type="number"
                  min={0}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                  value={tempCandCompareceram}
                  onChange={(e) => setTempCandCompareceram(Number(e.target.value))}
                />
              </div>
              <div>
                <label htmlFor="modal-aprovados" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Aprovados</label>
                <input
                  id="modal-aprovados"
                  type="number"
                  min={0}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                  value={tempCandAprovados}
                  onChange={(e) => setTempCandAprovados(Number(e.target.value))}
                />
              </div>
            </div>
            <div>
              <label htmlFor="modal-desistencia" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Motivo de desistência (se houve)</label>
              <select
                id="modal-desistencia"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl cursor-pointer"
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
                <label htmlFor="modal-conclusao" className="block text-xs font-bold text-orange-900 uppercase mb-1">Data Conclusão</label>
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
                <label htmlFor="modal-process-time" className="block text-xs font-bold text-orange-900 uppercase mb-1">Dias Processo (SLA)</label>
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
            <label htmlFor="modal-observacoes" className="block text-xs font-bold text-slate-500 uppercase mb-1">Observações do Processo</label>
            <textarea
              id="modal-observacoes"
              rows={3}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
              placeholder="Informações adicionais da triagem, cancelamentos..."
              value={tempObservacoes}
              onChange={(e) => setTempObservacoes(e.target.value)}
            />
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-sm font-bold rounded-xl text-slate-600 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-sm font-bold rounded-xl text-white shadow-lg shadow-orange-500/20 cursor-pointer"
          >
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
};
