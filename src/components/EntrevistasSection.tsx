/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Entrevista } from '../types';
import { 
  HeartCrack, 
  Search, 
  User, 
  PlusCircle, 
  Star, 
  Calendar,
  Eye,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  MessageSquare
} from 'lucide-react';

const StarRatingInput = ({ value, onChange, label }: { value: number, onChange: (val: number) => void, label: string }) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue = hoverValue !== null ? hoverValue : value;

  return (
    <div className="flex flex-col bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm transition-all hover:border-slate-200">
      <label className="block text-[10px] text-slate-500 font-bold uppercase mb-2 tracking-wider">{label}</label>
      <div 
        className="flex items-center gap-1.5"
        onMouseLeave={() => setHoverValue(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const isFull = displayValue >= star;
          const isHalf = displayValue >= star - 0.5 && displayValue < star;
          
          return (
            <div
              key={star}
              className="relative cursor-pointer transition-transform ease-out hover:scale-110 active:scale-95"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const isLeftHalf = e.clientX - rect.left < rect.width / 2;
                setHoverValue(star - (isLeftHalf ? 0.5 : 0));
              }}
              onClick={() => {
                if (hoverValue !== null) {
                  onChange(hoverValue);
                }
              }}
            >
              <Star className="w-7 h-7 text-slate-200 fill-slate-100" />
              {(isFull || isHalf) && (
                <div 
                  className="absolute top-0 left-0 overflow-hidden pointer-events-none"
                  style={{ width: isHalf ? '50%' : '100%' }}
                >
                  <Star className="w-7 h-7 text-amber-400 fill-amber-400 drop-shadow-sm" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface EntrevistasSectionProps {
  entrevistas: Entrevista[];
  addEntrevista: (input: Omit<Entrevista, 'id' | 'codigo'>) => Promise<void>;
  deleteEntrevista: (id: string) => Promise<void>;
  confirmAction?: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
}

export const EntrevistasSection: React.FC<EntrevistasSectionProps> = ({
  entrevistas,
  addEntrevista,
  deleteEntrevista,
  confirmAction
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<Entrevista | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // New interview registration
  const [colaborador, setColaborador] = useState('');
  const [dataEntrevista, setDataEntrevista] = useState('');
  const [funcao, setFuncao] = useState('');
  const [unidade, setUnidade] = useState('DT');
  const [admissao, setAdmissao] = useState('');
  const [desligamento, setDesligamento] = useState('');
  const [motivoSaida, setMotivoSaida] = useState('Melhor proposta salarial no mercado');
  const [motivoSaidaOutro, setMotivoSaidaOutro] = useState('');
  const [gostavaTrabalho, setGostavaTrabalho] = useState<'Sim' | 'Não' | 'Parcialmente'>('Sim');
  const [oqMaisGostava, setOqMaisGostava] = useState('');
  const [oqMenosGostava, setOqMenosGostava] = useState('');
  const [notaSalario, setNotaSalario] = useState(3);
  const [notaTreinamento, setNotaTreinamento] = useState(3);
  const [notaCrescimento, setNotaCrescimento] = useState(3);
  const [notaRelacionamentoColegas, setNotaRelacionamentoColegas] = useState(4);
  const [notaRelacionamentoChefia, setNotaRelacionamentoChefia] = useState(4);
  const [notaClimaOrg, setNotaClimaOrg] = useState(4);
  const [voltaria, setVoltaria] = useState<'Sim' | 'Não' | 'Talvez'>('Sim');
  const [sugestoes, setSugestoes] = useState('');
  const [entrevistador, setEntrevistador] = useState('');

  // Stats
  const stats = useMemo(() => {
    let sumClima = 0;
    let sumSalario = 0;
    let sumCrescimento = 0;
    let totalSimVoltaria = 0;

    entrevistas.forEach(e => {
      sumClima += (e.notaClimaOrg || 0);
      sumSalario += (e.notaSalario || 0);
      sumCrescimento += (e.notaCrescimento || 0);
      if (e.voltaria === 'Sim') totalSimVoltaria++;
    });

    const count = entrevistas.length || 1;
    return {
      climaMedio: (sumClima / count).toFixed(1),
      salarioMedio: (sumSalario / count).toFixed(1),
      crescimentoMedio: (sumCrescimento / count).toFixed(1),
      retornoPct: Math.round((totalSimVoltaria / count) * 100),
      totalEntrevistadas: entrevistas.length
    };
  }, [entrevistas]);

  // Options
  const motivoOptions = [
    "Melhor proposta salarial no mercado",
    "Falta de oportunidade de crescimento",
    "Relacionamento com a chefia",
    "Relacionamento com os colegas",
    "Mudança de cidade/residência",
    "Estudos / Faculdade",
    "Problemas familiares",
    "Outros"
  ].sort((a,b) => a.localeCompare(b));

  // Filtered
  const filteredList = useMemo(() => {
    return entrevistas.filter(e => {
      return !searchTerm.trim() || 
        e.colaborador.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.funcao.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.motivoSaida.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [entrevistas, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!colaborador.trim() || !funcao.trim() || !dataEntrevista.trim()) {
      setErrorMsg("Por favor, preencha Colaborador, Função e Data da Entrevista.");
      return;
    }

    // Format dates if needed
    let formattedInterview = dataEntrevista;
    if (dataEntrevista.includes('-')) {
      const parts = dataEntrevista.split('-');
      formattedInterview = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    let formattedAdm = admissao;
    if (admissao && admissao.includes('-')) {
      const parts = admissao.split('-');
      formattedAdm = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    let formattedDes = desligamento;
    if (desligamento && desligamento.includes('-')) {
      const parts = desligamento.split('-');
      formattedDes = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    const finalMotivo = motivoSaida === 'Outros' && motivoSaidaOutro.trim() 
      ? `Outros: ${motivoSaidaOutro.trim()}`
      : motivoSaida;

    await addEntrevista({
      colaborador,
      dataEntrevista: formattedInterview,
      funcao,
      unidade,
      admissao: formattedAdm || undefined,
      desligamento: formattedDes || undefined,
      motivoSaida: finalMotivo,
      gostavaTrabalho,
      oqMaisGostava: oqMaisGostava || undefined,
      oqMenosGostava: oqMenosGostava || undefined,
      notaSalario,
      notaTreinamento,
      notaCrescimento,
      notaRelacionamentoColegas,
      notaRelacionamentoChefia,
      notaClimaOrg,
      voltaria,
      sugestoes: sugestoes || undefined,
      entrevistador: entrevistador || 'RH'
    });

    // Reset
    setColaborador('');
    setDataEntrevista('');
    setFuncao('');
    setOqMaisGostava('');
    setOqMenosGostava('');
    setSugestoes('');
    setEntrevistador('');
    setMotivoSaida('Melhor proposta salarial no mercado');
    setMotivoSaidaOutro('');
    setErrorMsg('');
    setShowAddForm(false);
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFull = rating >= star;
          const isHalf = rating >= star - 0.5 && rating < star;
          return (
            <div key={star} className="relative">
              <Star className="w-3.5 h-3.5 text-slate-200 fill-slate-100" />
              {(isFull || isHalf) && (
                <div 
                  className="absolute top-0 left-0 overflow-hidden pointer-events-none"
                  style={{ width: isHalf ? '50%' : '100%' }}
                >
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-850 flex items-center gap-2">
            <HeartCrack className="w-6 h-6 text-rose-500" />
            Entrevistas de Desligamento (Exit Interviews)
          </h2>
          <p className="text-slate-500 text-sm font-medium">Investigue motivos de saídas, colete sugestões e estude o nível de satisfação organizacional.</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-slate-900/15 transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          Registrar Entrevista
        </button>
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Média Clima Org.</div>
          <div className="text-md font-bold text-slate-800 flex items-center gap-1.5 mt-1">
            <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
            {stats.climaMedio} / 5
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Média Salários</div>
          <div className="text-md font-bold text-slate-800 flex items-center gap-1.5 mt-1">
            <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
            {stats.salarioMedio} / 5
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Média Crescimento</div>
          <div className="text-md font-bold text-slate-800 flex items-center gap-1.5 mt-1">
            <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
            {stats.crescimentoMedio} / 5
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Voltariam a Trabalhar (%)</div>
          <div className="text-md font-bold text-slate-800 mt-1 flex items-center gap-1.5">
            <ThumbsUp className="w-4 h-4 text-emerald-500" />
            {stats.retornoPct}% diriam Sim
          </div>
        </div>
      </div>

      {/* Research Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/10 focus:border-orange-500"
            placeholder="Pesquisar por Colaborador expulso, função ou motivo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Exit list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredList.length === 0 ? (
          <div className="col-span-2 bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 font-medium">
            Nenhuma entrevista de desligamento arquivada.
          </div>
        ) : (
          filteredList.map((e) => (
            <div key={e.id} className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-350 transition flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold">
                    #{e.codigo || 300}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> {e.dataEntrevista}
                  </span>
                </div>

                <h3 className="text-md font-bold text-slate-800 mt-2">{e.colaborador}</h3>
                <p className="text-xs text-slate-400 font-semibold">{e.funcao} • {e.unidade}</p>

                <div className="mt-3.5 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100 text-xs text-rose-800 font-medium">
                  <strong>Motivo de Saída:</strong> {e.motivoSaida}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span>Clima:</span>
                    {renderStars(e.notaClimaOrg)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Salário:</span>
                    {renderStars(e.notaSalario)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Carreira:</span>
                    {renderStars(e.notaCrescimento)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Liderança:</span>
                    {renderStars(e.notaRelacionamentoChefia)}
                  </div>
                </div>
              </div>

              <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Entrevistador: <strong>{e.entrevistador || 'RH'}</strong>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewingRecord(e)}
                    className="p-1 px-2.5 border border-slate-200 hover:bg-slate-50 hover:border-slate-350 text-xs font-bold rounded-lg text-slate-600 flex items-center gap-1 cursor-pointer transition"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    Ver Detalhes
                  </button>
                  <button
                    onClick={() => {
                      if (confirmAction) {
                        confirmAction(
                          "Excluir Entrevista de Desligamento",
                          `Deseja realmente remover definitivamente a ficha e as respostas de entrevista de desligamento do colaborador "${e.colaborador}"? Esta operação não pode ser revertida.`,
                          () => deleteEntrevista(e.id)
                        );
                      } else {
                        if (confirm(`Remover definitivamente o registro de entrevista de ${e.colaborador}?`)) {
                          deleteEntrevista(e.id);
                        }
                      }
                    }}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer transition"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Record details popup */}
      {viewingRecord && (
        <div className="fixed inset-0 bg-slate-900/65 flex items-center justify-center p-4 z-50 backdrop-blur-sm shadow-2xl">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 bg-slate-950 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase bg-rose-500 text-white px-2 py-0.5 rounded-md font-bold">
                  Exit Interview #{viewingRecord.codigo}
                </span>
                <h3 className="text-lg font-bold mt-1">{viewingRecord.colaborador}</h3>
              </div>
              <button 
                onClick={() => setViewingRecord(null)} 
                className="text-slate-400 hover:text-white font-bold text-2xl cursor-pointer leading-none"
              >
                &times;
              </button>
            </div>

            {/* Details report */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="block font-bold text-slate-400 uppercase">Período</span>
                  <span className="text-slate-800 font-medium">Admissão: {viewingRecord.admissao || 'Não inf.'} | Desligamento: {viewingRecord.desligamento || 'Não inf.'}</span>
                </div>
                <div>
                  <span className="block font-bold text-slate-400 uppercase">Unidade</span>
                  <span className="text-slate-800 font-semibold">{viewingRecord.unidade}</span>
                </div>
              </div>

              <div className="bg-rose-50 p-3.5 rounded-2xl border border-rose-150 text-slate-800">
                <span className="block text-[10px] uppercase font-bold text-rose-500 tracking-wider mb-0.5">Por quais motivos está saindo da empresa?</span>
                <p className="text-sm font-semibold">{viewingRecord.motivoSaida}</p>
              </div>

              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Avaliação de Atributos (1 a 5)</span>
                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-center"><span className="pr-2">Satisfeito com salário:</span> {renderStars(viewingRecord.notaSalario)}</div>
                  <div className="flex justify-between items-center"><span className="pr-2">Satisfeito com treinamentos:</span> {renderStars(viewingRecord.notaTreinamento)}</div>
                  <div className="flex justify-between items-center"><span className="pr-2">Oportunidades de crescimento:</span> {renderStars(viewingRecord.notaCrescimento)}</div>
                  <div className="flex justify-between items-center"><span className="pr-2">Relacionamento colegas:</span> {renderStars(viewingRecord.notaRelacionamentoColegas)}</div>
                  <div className="flex justify-between items-center"><span className="pr-2">Relacionamento chefia:</span> {renderStars(viewingRecord.notaRelacionamentoChefia)}</div>
                  <div className="flex justify-between items-center"><span className="pr-2">Clima da organização:</span> {renderStars(viewingRecord.notaClimaOrg)}</div>
                </div>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex items-center justify-between text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-bold">
                  <span>Você gostava de seu trabalho?</span>
                  <span className={`px-2.5 py-1 rounded bg-white text-[10px] uppercase tracking-wider ${
                    viewingRecord.gostavaTrabalho === 'Sim' ? 'text-emerald-600' :
                    viewingRecord.gostavaTrabalho === 'Não' ? 'text-rose-600' :
                    'text-amber-500'
                  }`}>
                    {viewingRecord.gostavaTrabalho}
                  </span>
                </div>

                <div>
                  <span className="block font-semibold text-slate-500 flex items-center gap-1.5">
                    <ThumbsUp className="w-3.5 h-3.5 text-slate-400" />
                    O que você mais gostava em seu trabalho?
                  </span>
                  <p className="bg-slate-50 p-2.5 rounded-xl text-slate-800 italic mt-1 leading-relaxed">
                    "{viewingRecord.oqMaisGostava || 'Nenhum ponto destacado.'}"
                  </p>
                </div>

                <div>
                  <span className="block font-semibold text-slate-500 flex items-center gap-1.5">
                    <ThumbsDown className="w-3.5 h-3.5 text-slate-400" />
                    O que você menos gostava em seu trabalho?
                  </span>
                  <p className="bg-slate-50 p-2.5 rounded-xl text-slate-800 italic mt-1 leading-relaxed">
                    "{viewingRecord.oqMenosGostava || 'Nenhum ponto destacado.'}"
                  </p>
                </div>

                {viewingRecord.sugestoes && (
                  <div>
                    <span className="block font-semibold text-slate-500 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                      Sugestões para o futuro:
                    </span>
                    <p className="bg-slate-50 p-2.5 rounded-xl text-slate-800 italic mt-1 leading-relaxed">
                      "{viewingRecord.sugestoes}"
                    </p>
                  </div>
                )}

                <div className="bg-slate-900 text-white p-3.5 rounded-2xl flex items-center justify-between text-xs font-bold">
                  <span>Voltaria a trabalhar conosco?</span>
                  <span className={`px-2.5 py-1 rounded bg-white font-bold uppercase tracking-wider ${
                    viewingRecord.voltaria === 'Sim' ? 'text-emerald-600' :
                    viewingRecord.voltaria === 'Não' ? 'text-rose-600' :
                    'text-blue-600'
                  }`}>
                    {viewingRecord.voltaria}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Registration popup */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/65 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 bg-slate-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartCrack className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-bold">Registrar Entrevista de Desligamento</h3>
              </div>
              <button 
                onClick={() => { setErrorMsg(''); setShowAddForm(false); }} 
                className="text-slate-400 hover:text-white font-bold text-2xl cursor-pointer leading-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-semibold border border-red-100 flex items-center gap-2">
                  <span className="w-5 h-5 flex items-center justify-center bg-red-100 rounded-full text-red-700 font-bold shrink-0">!</span>
                  {errorMsg}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo do Ex-Colaborador *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Daniela Souza Santos"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl font-medium"
                  value={colaborador}
                  onChange={(e) => setColaborador(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Função Desempenhada *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Analista Comercial"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                    value={funcao}
                    onChange={(e) => setFuncao(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unidade / Setor</label>
                  <input
                    type="text"
                    placeholder="Ex: TI / Comercial"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                    value={unidade}
                    onChange={(e) => setUnidade(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Admissão</label>
                  <input
                    type="date"
                    className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    value={admissao}
                    onChange={(e) => setAdmissao(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Desligamento</label>
                  <input
                    type="date"
                    className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    value={desligamento}
                    onChange={(e) => setDesligamento(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Entrevista *</label>
                  <input
                    type="date"
                    required
                    className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    value={dataEntrevista}
                    onChange={(e) => setDataEntrevista(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Por quais motivos está saindo da empresa?</label>
                <select
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                  value={motivoSaida}
                  onChange={(e) => setMotivoSaida(e.target.value)}
                >
                  {motivoOptions.map((opt, idx) => (
                    <option key={idx} value={opt}>{opt}</option>
                  ))}
                </select>
                {motivoSaida === 'Outros' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                      placeholder="Especifique o motivo..."
                      value={motivoSaidaOutro}
                      onChange={(e) => setMotivoSaidaOutro(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Avaliação de Satisfação (1 a 5, onde 5 é ótimo)</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-200">
                  <StarRatingInput label="Satisfação com salário" value={notaSalario} onChange={setNotaSalario} />
                  <StarRatingInput label="Satisfação com treinamentos" value={notaTreinamento} onChange={setNotaTreinamento} />
                  <StarRatingInput label="Oportunidades de crescimento" value={notaCrescimento} onChange={setNotaCrescimento} />
                  <StarRatingInput label="Relacionamento com colegas" value={notaRelacionamentoColegas} onChange={setNotaRelacionamentoColegas} />
                  <StarRatingInput label="Relacionamento com chefia" value={notaRelacionamentoChefia} onChange={setNotaRelacionamentoChefia} />
                  <StarRatingInput label="Clima da organização" value={notaClimaOrg} onChange={setNotaClimaOrg} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Você gostava de seu trabalho?</label>
                  <select
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                    value={gostavaTrabalho}
                    onChange={(e) => setGostavaTrabalho(e.target.value as 'Sim' | 'Não' | 'Parcialmente')}
                  >
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                    <option value="Parcialmente">Parcialmente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Voltaria a trabalhar conosco?</label>
                  <select
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                    value={voltaria}
                    onChange={(e) => setVoltaria(e.target.value as 'Sim' | 'Não' | 'Talvez')}
                  >
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                    <option value="Talvez">Talvez</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">O que você mais gostava no trabalho?</label>
                  <input
                    type="text"
                    placeholder="Ex: Liberdade do projeto"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                    value={oqMaisGostava}
                    onChange={(e) => setOqMaisGostava(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">O que você menos gostava no trabalho?</label>
                  <input
                    type="text"
                    placeholder="Ex: Salário defasado"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                    value={oqMenosGostava}
                    onChange={(e) => setOqMenosGostava(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sugestões de melhoria</label>
                  <textarea
                    rows={2}
                    placeholder="Sugestões de crescimento profissional..."
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                    value={sugestoes}
                    onChange={(e) => setSugestoes(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Entrevistador Responsável (RH)</label>
                  <input
                    type="text"
                    placeholder="Ex: Larissa Moura"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                    value={entrevistador}
                    onChange={(e) => setEntrevistador(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setErrorMsg(''); setShowAddForm(false); }}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-sm font-bold rounded-xl text-slate-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-sm font-bold rounded-xl text-white shadow-lg shadow-orange-500/20 cursor-pointer"
                >
                  Salvar Entrevista
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
