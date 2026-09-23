/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Vaga } from '../types';
import { toISOInput, formatDateBR, monthAbbrFromDate, yearFromDate } from '../utils/date';
import { PlusCircle, FileText, CheckCircle, X } from 'lucide-react';
import { Sede, Cargo, Setor } from '../hooks/useMetadata';
import { sugestoesDeCargo, setorExistente } from '../utils/catalogo';

interface AddVacancyFormProps {
  /** `quantidade` abre N posições iguais de uma vez — ver `addVagas` em useVagas. */
  addVaga: (vaga: Omit<Vaga, 'id' | 'codigo'>, quantidade?: number) => Promise<void>;
  onSuccess: () => void;
  sedes?: Sede[];
  cargos?: Cargo[];
  setores?: Setor[];
  userSede?: string;
  /** Nomes já usados em vagas — entram nas sugestões junto com o cadastro. */
  nomesUsados?: string[];
  /** Cadastra um setor novo. Ausente = sem o "+ Novo setor". */
  criarSetor?: (nome: string) => Promise<void>;
}

export const AddVacancyForm: React.FC<AddVacancyFormProps> = ({ addVaga, onSuccess, sedes, cargos, setores, userSede, nomesUsados = [], criarSetor }) => {
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

  const getTodayISO = () => toISOInput(new Date());
  const [solicitacao, setSolicitacao] = useState(getTodayISO());

  // Texto, não número: <input type="number"> controlado com estado numérico não
  // deixa a pessoa apagar para redigitar (o campo volta a 1 no meio da edição).
  const [quantidade, setQuantidade] = useState('1');
  const quantas = Math.max(1, Math.min(200, Math.floor(Number(quantidade)) || 1));

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

    // Data de solicitação (input ISO) -> BR + mês abreviado, com fallback para hoje.
    const formattedDate = formatDateBR(solicitacao) || formatDateBR(new Date());
    const monthText = monthAbbrFromDate(solicitacao) || monthAbbrFromDate(new Date());
    const inputYear = yearFromDate(solicitacao);

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
      }, quantas);

      setDone(true);
      setTimeout(() => {
        setDone(false);
        // Reset state
        setVagaName('');
        setSolicitante('');
        setMotivoOutro('');
        setFuncionarioSubstituido('');
        setObservacoes('');
        // Volta para 1: um lote de 30 é exceção, e deixar o 30 ali faria a
        // próxima abertura distraída virar mais 30 vagas.
        setQuantidade('1');
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
  const sectorOptions = useMemo(() => {
    if (setores && setores.length > 0) {
      return [...setores.map(s => s.nome)].sort((a,b) => a.localeCompare(b));
    }
    return [
      "Almoxarifado", "Almoxarifado geral", "Atendimento", "Cantina", "Compras", 
      "Comunicação Digital", "Construtora", "Coordenação", "CPA", "D. Valéria", 
      "Idiomas DT", "Infra", "Infraestrutura", "Jurídico", "Livros escolares", 
      "Lojinha", "Marketing", "Metalurgica", "MKT", "Pedagógico", "Redes", 
      "Secretaria", "Som", "TI"
    ].sort((a,b) => a.localeCompare(b));
  }, [setores]);

  // Setor recém-criado aqui: vale na hora, antes de o cadastro devolvê-lo na
  // lista — senão o efeito abaixo o trocaria pelo primeiro da lista.
  const [setorCriado, setSetorCriado] = useState('');
  const opcoesDeSetor = setorCriado && !sectorOptions.includes(setorCriado)
    ? [...sectorOptions, setorCriado].sort((a, b) => a.localeCompare(b))
    : sectorOptions;

  useEffect(() => {
    if (sectorOptions && sectorOptions.length > 0 && !sectorOptions.includes(setor) && setor !== setorCriado) {
      setSetor(sectorOptions[0]);
    }
  }, [sectorOptions, setor, setorCriado]);

  const [novoSetor, setNovoSetor] = useState<string | null>(null);
  const [avisoSetor, setAvisoSetor] = useState('');
  const [criandoSetor, setCriandoSetor] = useState(false);
  const criarSetorAgora = async () => {
    const nome = (novoSetor || '').trim().replace(/\s+/g, ' ');
    if (!nome || !criarSetor) return;
    // Nome que já existe (ignorando caixa e acento) reaproveita o cadastrado:
    // "pedagogico" não pode virar um segundo "Pedagógico".
    const existente = setorExistente(sectorOptions, nome);
    if (existente) {
      setSetor(existente);
      setNovoSetor(null);
      setAvisoSetor(`"${existente}" já existia e foi selecionado.`);
      return;
    }
    setCriandoSetor(true);
    try {
      await criarSetor(nome);
      setSetorCriado(nome);
      setSetor(nome);
      setNovoSetor(null);
      setAvisoSetor(`Setor "${nome}" criado.`);
    } finally {
      setCriandoSetor(false);
    }
  };

  const sugestoes = useMemo(
    () => sugestoesDeCargo((cargos || []).map(c => c.nome), nomesUsados),
    [cargos, nomesUsados]
  );

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
                aria-describedby="form-vaga-ajuda"
              />
              {/* Sugestão, não trava: um cargo que ninguém abriu ainda precisa
                  poder ser digitado. */}
              <datalist id="cargoSuggestions">
                {sugestoes.map(nome => <option key={nome} value={nome} />)}
              </datalist>
              <p id="form-vaga-ajuda" className="text-[11px] text-slate-500 font-medium mt-1.5 ml-1 leading-relaxed">
                Comece a digitar para ver os cargos já usados.
              </p>

              {/* Quantidade mora colada ao Cargo porque é "quantas DESTE cargo",
                  e não um atributo solto da vaga. Cada posição continua virando
                  um registro próprio — o campo poupa digitação, não altera o
                  significado de nada no painel. */}
              <div className="mt-3">
                <label htmlFor="form-quantidade" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                  Quantidade de vagas
                </label>
                <input
                  id="form-quantidade"
                  type="number"
                  min={1}
                  max={200}
                  inputMode="numeric"
                  className="w-full px-4 py-2.5 text-sm bg-slate-50/50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl text-slate-700 font-medium transition-colors"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  aria-describedby="form-quantidade-ajuda"
                />
                <p id="form-quantidade-ajuda" className="text-[11px] text-slate-500 font-medium mt-1.5 ml-1 leading-relaxed">
                  {quantas > 1
                    ? `Abre ${quantas} vagas iguais, cada uma com seu código e seu acompanhamento.`
                    : 'Deixe 1 para uma vaga. Para um lote (ex.: temporários), informe quantas.'}
                </p>
              </div>
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
              <div className="flex items-baseline justify-between gap-2 mb-1.5 ml-1">
                <label htmlFor={novoSetor !== null ? 'form-setor-novo' : 'form-setor'} className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Setor / Área</label>
                {criarSetor && novoSetor === null && (
                  <button
                    type="button"
                    onClick={() => { setNovoSetor(''); setAvisoSetor(''); }}
                    className="text-[11px] font-bold text-orange-700 hover:text-orange-800 cursor-pointer"
                  >
                    + Novo setor
                  </button>
                )}
              </div>
              {novoSetor !== null ? (
                <div className="flex gap-1.5">
                  <input
                    id="form-setor-novo"
                    type="text"
                    autoFocus
                    maxLength={60}
                    placeholder="Nome do setor"
                    className="w-full min-w-0 px-3 py-2.5 text-sm bg-white border border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none rounded-xl text-slate-700 font-medium placeholder:text-slate-400"
                    value={novoSetor}
                    onChange={(e) => setNovoSetor(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter aqui cria o setor, não envia a vaga pela metade.
                      if (e.key === 'Enter') { e.preventDefault(); criarSetorAgora(); }
                      if (e.key === 'Escape') { e.preventDefault(); setNovoSetor(null); }
                    }}
                  />
                  <button
                    type="button"
                    onClick={criarSetorAgora}
                    disabled={criandoSetor || !novoSetor.trim()}
                    className="shrink-0 px-3 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-default"
                  >
                    {criandoSetor ? '...' : 'Criar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNovoSetor(null)}
                    aria-label="Cancelar novo setor"
                    className="shrink-0 px-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-sm font-bold cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <select
                  id="form-setor"
                  className="w-full px-4 py-2.5 text-sm bg-slate-50/50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl text-slate-700 font-medium transition-colors placeholder:text-slate-400"
                  value={setor}
                  onChange={(e) => { setSetor(e.target.value); setAvisoSetor(''); }}
                >
                  {opcoesDeSetor.map((opt, idx) => (
                    <option key={idx} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
              {avisoSetor && (
                <p role="status" className="text-[11px] text-emerald-700 font-semibold mt-1.5 ml-1">{avisoSetor}</p>
              )}
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
                  <input aria-label="Especifique o motivo..."
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
              className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-55 text-white text-sm font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-orange-500/25 cursor-pointer transition active:scale-[0.98]"
            >
              <PlusCircle className="w-4.5 h-4.5" />
              {/* O botão diz o número: "Abrir Vaga" com 30 no campo esconderia
                  que o clique cria trinta registros. */}
              {busy ? 'Salvando...' : quantas > 1 ? `Abrir ${quantas} Vagas` : 'Abrir Vaga'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
