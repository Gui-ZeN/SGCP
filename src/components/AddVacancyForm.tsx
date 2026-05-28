/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Vaga } from '../types';
import { PlusCircle, FileText, CheckCircle } from 'lucide-react';
import { Sede, Cargo } from '../hooks/useMetadata';

interface AddVacancyFormProps {
  addVaga: (vaga: Omit<Vaga, 'id' | 'codigo'>) => Promise<void>;
  onSuccess: () => void;
  sedes?: Sede[];
  cargos?: Cargo[];
  userSede?: string;
}

export const AddVacancyForm: React.FC<AddVacancyFormProps> = ({ addVaga, onSuccess, sedes, cargos, userSede }) => {
  const [vagaName, setVagaName] = useState('');
  const [sede, setSede] = useState(userSede || 'DT');

  // Sync sede when userSede changes
  useEffect(() => {
    if (userSede) {
      setSede(userSede);
    }
  }, [userSede]);
  const [setor, setSetor] = useState('Infra');
  const [solicitante, setSolicitante] = useState('');
  const [motivo, setMotivo] = useState('Substituição por desligamento');
  const [motivoOutro, setMotivoOutro] = useState('');
  const [funcionarioSubstituido, setFuncionarioSubstituido] = useState('');
  const [responsavel, setResponsavel] = useState('RH');
  const [sexo, setSexo] = useState<Vaga['sexo']>('INDIFERENTE');
  const [observacoes, setObservacoes] = useState('');

  const getTodayISO = () => {
    const todayDate = new Date();
    const yyyy = todayDate.getFullYear();
    const mm = String(todayDate.getMonth() + 1).padStart(2, '0');
    const dd = String(todayDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const [solicitacao, setSolicitacao] = useState(getTodayISO());

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!vagaName.trim() || !solicitante.trim()) {
      setErrorMsg("Por favor, preencha o Cargo e o nome do Gestor Solicitante.");
      return;
    }

    setBusy(true);

    const todayDate = new Date();
    let formattedDate = '';
    let monthText = '';
    let inputYear = todayDate.getFullYear();

    if (solicitacao) {
      const parts = solicitacao.split('-'); // ["YYYY", "MM", "DD"]
      if (parts.length === 3) {
        formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        const monthNum = parseInt(parts[1], 10);
        const monthsAbr = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
        if (monthNum >= 1 && monthNum <= 12) {
          monthText = monthsAbr[monthNum - 1];
        }
        inputYear = parseInt(parts[0], 10) || todayDate.getFullYear();
      }
    }

    if (!formattedDate) {
      formattedDate = `${String(todayDate.getDate()).padStart(2, '0')}/${String(todayDate.getMonth() + 1).padStart(2, '0')}/${todayDate.getFullYear()}`;
      const monthsAbr = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
      monthText = monthsAbr[todayDate.getMonth()];
    }

    try {
      const finalMotivo = motivo === 'Outros' && motivoOutro.trim() 
        ? `Outros: ${motivoOutro.trim()}`
        : motivo;

      await addVaga({
        vaga: vagaName,
        sede,
        setor,
        solicitante,
        motivo: finalMotivo,
        status: 'ABERTA',
        sexo,
        solicitacao: formattedDate,
        mesSolicitacao: monthText,
        responsavel,
        observacoes,
        etapa: 'Triagem de currículos',
        funcionarioSubstituido: funcionarioSubstituido.trim(),
        ano: inputYear,
        categoria: 'Seleções Gerais',
        categoriaMotivo: finalMotivo.includes('Aumento') ? 'Aumento de Quadro' : (finalMotivo.includes('Outros') ? 'Outros' : 'Substituição')
      });

      setDone(true);
      setTimeout(() => {
        setDone(false);
        // Reset state
        setVagaName('');
        setSolicitante('');
        setMotivoOutro('');
        setFuncionarioSubstituido('');
        setObservacoes('');
        onSuccess();
      }, 1500);
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar vaga.");
    } finally {
      setBusy(false);
    }
  };

  const getSedeLabel = (nome: string) => {
    const matched = sedes?.find(s => s.nome.toLowerCase() === nome.toLowerCase());
    return matched && matched.sigla ? `${matched.nome} (${matched.sigla})` : nome;
  };

  const getSedeSigla = (nome: string) => {
    const matched = sedes?.find(s => s.nome.toLowerCase() === nome.toLowerCase());
    return matched && matched.sigla ? matched.sigla : nome;
  };

  const sedeOptions = useMemo(() => {
    let list = sedes && sedes.length > 0 
      ? [...sedes.map(s => s.nome)]
      : ["DT", "Construtora", "BENFICA", "BS", "SUL", "Sul 2", "Sul 3", "PQL 1", "PQL 2", "PQL 3", "SP", "OFICINA", "EQUIPE D.VALERIA"];
    
    list.sort((a, b) => {
      if (userSede) {
        if (a.toLowerCase() === userSede.toLowerCase()) return -1;
        if (b.toLowerCase() === userSede.toLowerCase()) return 1;
      }
      return a.localeCompare(b);
    });
    return list;
  }, [sedes, userSede]);
  const sectorOptions = ["TI", "Jurídico", "Idiomas DT", "Pedagógico", "Infra", "Coordenação", "Lojinha", "Secretaria", "Cantina", "CPA", "SOM", "D. Valéria"].sort((a,b) => a.localeCompare(b));
  const motivoOptions = [
    "Substituição por desligamento", 
    "Substituição por demissão", 
    "Substituição por promoção", 
    "Substituição por transferência",
    "Aumento de Quadro", 
    "Temporário", 
    "Cota PCD",
    "Outros"
  ].sort((a,b) => a.localeCompare(b));

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/40 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 border-b border-slate-100 pb-5 mb-6">
        <div className="p-3 bg-gradient-to-br from-orange-50 to-orange-100/50 text-orange-500 rounded-2xl shadow-sm border border-orange-100/50">
          <FileText className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Nova Requisição de Vaga</h2>
          <p className="text-sm text-slate-500 font-medium mt-0.5">Insira as informações do processo seletivo para registrar no sistema.</p>
        </div>
      </div>

      {done ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center text-orange-500 animate-bounce">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Processo Iniciado!</h3>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Vaga adicionada com sucesso ao banco cadastral.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-semibold border border-red-100 flex items-center gap-2">
              <span className="w-5 h-5 flex items-center justify-center bg-red-100 rounded-full text-red-700 font-bold shrink-0">!</span>
              {errorMsg}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Vacancy name */}
            <div className="md:col-span-1">
              <label htmlFor="form-vaga" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Cargo / Vaga <span className="text-orange-500">*</span></label>
              <input
                id="form-vaga"
                type="text"
                required
                list="cargoSuggestions"
                className="w-full px-4 py-2.5 text-sm bg-slate-50/50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl text-slate-700 font-medium transition-colors placeholder:text-slate-400"
                placeholder="Ex: Auxiliar Administrativo"
                value={vagaName}
                onChange={(e) => setVagaName(e.target.value)}
              />
              <datalist id="cargoSuggestions">
                {[...(cargos || [])].sort((a,b) => (a.nome || '').localeCompare(b.nome || '')).map(c => (
                  <option key={c.id} value={c.nome} />
                ))}
              </datalist>
            </div>

            {/* Requester Solicitor */}
            <div>
              <label htmlFor="form-solicitante" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Gestor Solicitante <span className="text-orange-500">*</span></label>
              <input
                id="form-solicitante"
                type="text"
                required
                className="w-full px-4 py-2.5 text-sm bg-slate-50/50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl text-slate-700 font-medium transition-colors placeholder:text-slate-400"
                placeholder="Ex: Eveline Santiago"
                value={solicitante}
                onChange={(e) => setSolicitante(e.target.value)}
              />
            </div>

            {/* Requesting Date option */}
            <div>
              <label htmlFor="form-solicitacao" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Data Solicitação <span className="text-orange-500">*</span></label>
              <input
                id="form-solicitacao"
                type="date"
                required
                className="w-full px-4 py-2.5 text-sm bg-slate-50/50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl text-slate-700 font-medium transition-colors placeholder:text-slate-400"
                value={solicitacao}
                onChange={(e) => setSolicitacao(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {/* Sede Dropdown */}
            <div>
              <label htmlFor="form-sede" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Sede / Posto</label>
              <select
                id="form-sede"
                className="w-full px-4 py-2.5 text-sm bg-slate-50/50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl text-slate-700 font-medium transition-colors placeholder:text-slate-400"
                value={sede}
                onChange={(e) => setSede(e.target.value)}
              >
                {sedeOptions.map((opt, idx) => (
                  <option key={idx} value={opt}>{getSedeSigla(opt)}</option>
                ))}
              </select>
            </div>

            {/* Setor Dropdown */}
            <div>
              <label htmlFor="form-setor" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Setor / Área</label>
              <select
                id="form-setor"
                className="w-full px-4 py-2.5 text-sm bg-slate-50/50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl text-slate-700 font-medium transition-colors placeholder:text-slate-400"
                value={setor}
                onChange={(e) => setSetor(e.target.value)}
              >
                {sectorOptions.map((opt, idx) => (
                  <option key={idx} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Sexo check */}
            <div className="col-span-2 md:col-span-1">
              <label htmlFor="form-sexo" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Sexo Preferencial</label>
              <select
                id="form-sexo"
                className="w-full px-4 py-2.5 text-sm bg-slate-50/50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl text-slate-700 font-medium transition-colors placeholder:text-slate-400"
                value={sexo}
                onChange={(e) => setSexo(e.target.value as Vaga['sexo'])}
              >
                <option value="INDIFERENTE">Indiferente</option>
                <option value="FEMININO">Feminino</option>
                <option value="MASCULINO">Masculino</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Motivo select */}
            <div>
              <label htmlFor="form-motivo" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Motivo Solicitação</label>
              <select
                id="form-motivo"
                className="w-full px-4 py-2.5 text-sm bg-slate-50/50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl text-slate-700 font-medium transition-colors placeholder:text-slate-400"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              >
                {motivoOptions.map((opt, idx) => (
                  <option key={idx} value={opt}>{opt}</option>
                ))}
              </select>
              {motivo === 'Outros' && (
                <div className="mt-2">
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 text-sm bg-slate-50/50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl text-slate-700 font-medium transition-colors placeholder:text-slate-400"
                    placeholder="Especifique o motivo..."
                    value={motivoOutro}
                    onChange={(e) => setMotivoOutro(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>

            {/* Funcionário Substituído input */}
            <div>
              <label htmlFor="form-substituto" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Substituído (Se houver)</label>
              <input
                id="form-substituto"
                type="text"
                className="w-full px-4 py-2.5 text-sm bg-slate-50/50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl text-slate-700 font-medium transition-colors placeholder:text-slate-400"
                placeholder="Ex: João Ferreira da Silva"
                value={funcionarioSubstituido}
                onChange={(e) => setFuncionarioSubstituido(e.target.value)}
              />
            </div>

            {/* Responsavel input */}
            <div>
              <label htmlFor="form-responsavel" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Recruiter Resp. (RH)</label>
              <input
                id="form-responsavel"
                type="text"
                className="w-full px-4 py-2.5 text-sm bg-slate-50/50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl text-slate-700 font-medium transition-colors placeholder:text-slate-400"
                placeholder="Ex: Arlana / Larissa"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
              />
            </div>
          </div>

          {/* Observacoes */}
          <div>
            <label htmlFor="form-observacoes" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Observações / Requisitos</label>
            <textarea
              id="form-observacoes"
              rows={3}
              className="w-full px-4 py-3 text-sm bg-slate-50/50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl text-slate-700 font-medium transition-colors placeholder:text-slate-400 resize-none selection:bg-orange-100 selection:text-orange-900"
              placeholder="Descreva observações, requisitos para admissão ou particularidades da vaga..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setVagaName(''); setSolicitante(''); setFuncionarioSubstituido(''); setObservacoes(''); setMotivoOutro(''); setSede('DT'); setSetor('Infra'); setMotivo('Substituição por desligamento'); setSexo('INDIFERENTE'); setResponsavel('RH');
              }}
              className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-800 text-slate-600 text-sm font-bold rounded-xl cursor-pointer transition-colors"
            >
              Limpar
            </button>
            <button
              id="submit-vaga-btn"
              type="submit"
              disabled={busy}
              className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-55 text-white text-sm font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-orange-500/25 cursor-pointer transition-all active:scale-[0.98]"
            >
              <PlusCircle className="w-4.5 h-4.5" />
              {busy ? "Salvando..." : "Abrir Vaga"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
