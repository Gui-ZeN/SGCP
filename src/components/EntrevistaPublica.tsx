import React, { useState, useEffect } from 'react';
import { db, isFirebaseEnabled, collection, addDoc, getDocs } from '../lib/firebase';
import { MOTIVOS_SAIDA } from '../constants/hr';
import { dataISOLocal, formatDateBR } from '../utils/date';
import { Star, CheckCircle2, Loader2, LogOut } from 'lucide-react';

/**
 * Entrevista de desligamento — formulário PÚBLICO (sem login), preenchido pelo
 * próprio colaborador que está saindo. Cai direto na aba Entrevistas do RH.
 *
 * Notas de projeto:
 * - `codigo` é derivado do instante do envio: quem não tem login não pode LER a
 *   coleção para calcular "o próximo número". Fica AAMMDDHHMM — único por minuto
 *   e ordena do mais novo para o mais antigo, como o resto da lista.
 * - `entrevistador` fica vazio de propósito: aqui é autoatendimento; o RH
 *   preenche depois, se quiser.
 * - A pessoa escolhe entre identificar-se ou responder ANÔNIMO. Identificada, o
 *   formulário deixa claro que o RH lê as respostas com o nome dela. Anônima,
 *   grava `colaborador: 'Anônimo'` e nada mais é pedido — nem função, que numa
 *   sede pequena já entrega quem respondeu.
 */

const NOTAS = [
  { campo: 'notaSalario', label: 'Satisfação com o salário' },
  { campo: 'notaTreinamento', label: 'Treinamentos recebidos' },
  { campo: 'notaCrescimento', label: 'Oportunidades de crescimento' },
  { campo: 'notaRelacionamentoColegas', label: 'Relacionamento com os colegas' },
  { campo: 'notaRelacionamentoChefia', label: 'Relacionamento com a chefia' },
  { campo: 'notaClimaOrg', label: 'Clima organizacional' },
] as const;

const inputCls = 'w-full text-sm px-3 py-2.5 border border-slate-200 rounded-xl outline-none bg-white font-medium focus:border-slate-800';
const labelCls = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1';

const Estrelas: React.FC<{ nota: number; onChange: (n: number) => void; label: string; id: string }> = ({ nota, onChange, label, id }) => (
  <div className="bg-white p-3 rounded-xl border border-slate-200">
    <span id={id} className="block text-[11px] text-slate-600 font-bold mb-2">{label}</span>
    <div className="flex items-center gap-1.5" role="radiogroup" aria-labelledby={id}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={nota === n}
          aria-label={`${n} de 5`}
          onClick={() => onChange(n)}
          className="cursor-pointer transition-transform hover:scale-110 active:scale-95"
        >
          <Star className={`w-6 h-6 ${n <= nota ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
        </button>
      ))}
      <span className="ml-2 text-[11px] font-bold text-slate-400">{nota ? `${nota}/5` : 'não respondido'}</span>
    </div>
  </div>
);

export const EntrevistaPublica: React.FC = () => {
  const [sedes, setSedes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [anonima, setAnonima] = useState(false);

  const [form, setForm] = useState({
    colaborador: '', funcao: '', unidade: '', admissao: '', desligamento: '',
    // Todos os campos de opinião começam VAZIOS de propósito: um default como
    // 'Sim' viraria resposta real de quem só clicou em enviar, e sujaria o
    // indicador de clima. Vazio = "não respondeu", e o RH sabe disso.
    motivoSaida: '',
    gostavaTrabalho: '',
    voltaria: '',
    oqMaisGostava: '', oqMenosGostava: '', sugestoes: '',
    notaSalario: 0, notaTreinamento: 0, notaCrescimento: 0,
    notaRelacionamentoColegas: 0, notaRelacionamentoChefia: 0, notaClimaOrg: 0,
  });
  const set = (k: keyof typeof form, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    (async () => {
      if (!isFirebaseEnabled || !db) return;
      try {
        const snap = await getDocs(collection(db, 'sedes')); // leitura pública
        const nomes: string[] = [];
        snap.forEach((d: any) => { const n = d.data()?.nome; if (n) nomes.push(n); });
        nomes.sort((a, b) => a.localeCompare(b, 'pt-BR'));
        setSedes(nomes);
      } catch (e) { /* sem lista: o campo vira texto livre */ }
    })();
  }, []);

  const enviar = async () => {
    setErro('');
    if (website.trim()) { setEnviado(true); return; } // bot: sucesso falso, nada gravado
    if (!anonima && (!form.colaborador.trim() || !form.funcao.trim())) {
      setErro('Preencha seu nome e a função que exercia — ou marque a opção de responder anonimamente.');
      return;
    }
    if (!isFirebaseEnabled || !db) { setErro('Serviço indisponível no momento.'); return; }
    setEnviando(true);
    try {
      const agora = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      const codigo = Number(
        `${String(agora.getFullYear()).slice(2)}${p(agora.getMonth() + 1)}${p(agora.getDate())}${p(agora.getHours())}${p(agora.getMinutes())}`
      );
      await addDoc(collection(db, 'entrevistas'), {
        ...form,
        // Anônima: o nome nunca sai do navegador, e a função vai junto só se a
        // pessoa tiver escolhido preenchê-la.
        anonima,
        colaborador: anonima ? 'Anônimo' : form.colaborador.trim(),
        funcao: form.funcao.trim(),
        unidade: form.unidade.trim(),
        admissao: form.admissao ? formatDateBR(form.admissao) : '',
        desligamento: form.desligamento ? formatDateBR(form.desligamento) : '',
        dataEntrevista: formatDateBR(dataISOLocal(agora)),
        entrevistador: '',
        codigo,
        origem: 'form-publico',
      });
      setEnviado(true);
    } catch (e: any) {
      setErro(`Não foi possível enviar. Tente novamente. (${e?.code || e?.message || 'erro'})`);
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-extrabold text-slate-800 mb-2">Obrigado por responder</h1>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            Suas respostas foram registradas e serão lidas pelo RH. Desejamos sucesso na sua próxima etapa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <header className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0">
            <LogOut className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 leading-tight">Entrevista de desligamento</h1>
            <p className="text-sm text-slate-500 font-medium">
              Sua opinião ajuda a melhorar o ambiente de trabalho. Leva cerca de 3 minutos.
            </p>
          </div>
        </header>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          {/* Honeypot anti-spam (invisível; humanos não preenchem) */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
            <label htmlFor="website">Não preencha este campo</label>
            <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
          </div>

          <section className="space-y-4">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">Sobre você</h2>

            <label className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={anonima}
                onChange={e => setAnonima(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-slate-900 cursor-pointer shrink-0"
              />
              <span>
                <span className="block text-[13px] font-bold text-slate-800">Quero responder anonimamente</span>
                <span className="block text-[11px] text-slate-500 font-medium">
                  Seu nome não será enviado nem gravado. Todo o resto passa a ser opcional.
                </span>
              </span>
            </label>

            <div className="grid sm:grid-cols-2 gap-4">
              {!anonima && (
                <div className="sm:col-span-2">
                  <label htmlFor="colaborador" className={labelCls}>Nome completo *</label>
                  <input id="colaborador" name="name" autoComplete="name" className={inputCls} value={form.colaborador} onChange={e => set('colaborador', e.target.value)} placeholder="Seu nome…" />
                </div>
              )}
              <div>
                <label htmlFor="funcao" className={labelCls}>Função que exercia {anonima ? '' : '*'}</label>
                <input id="funcao" autoComplete="off" className={inputCls} value={form.funcao} onChange={e => set('funcao', e.target.value)} placeholder={anonima ? 'Opcional…' : 'Ex.: Auxiliar Administrativo…'} />
              </div>
              <div>
                <label htmlFor="unidade" className={labelCls}>Unidade / Sede</label>
                {sedes.length > 0 ? (
                  <select id="unidade" className={inputCls} value={form.unidade} onChange={e => set('unidade', e.target.value)}>
                    <option value="">Selecione…</option>
                    {sedes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <input id="unidade" autoComplete="off" className={inputCls} value={form.unidade} onChange={e => set('unidade', e.target.value)} placeholder="Onde você trabalhava…" />
                )}
              </div>
              <div>
                <label htmlFor="admissao" className={labelCls}>Data de admissão</label>
                <input id="admissao" type="date" className={`${inputCls} cursor-pointer`} value={form.admissao} onChange={e => set('admissao', e.target.value)} />
              </div>
              <div>
                <label htmlFor="desligamento" className={labelCls}>Data de saída</label>
                <input id="desligamento" type="date" className={`${inputCls} cursor-pointer`} value={form.desligamento} onChange={e => set('desligamento', e.target.value)} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">Sua saída</h2>
            <div>
              <label htmlFor="motivoSaida" className={labelCls}>Principal motivo da saída</label>
              <select id="motivoSaida" className={inputCls} value={form.motivoSaida} onChange={e => set('motivoSaida', e.target.value)}>
                <option value="">Prefiro não responder</option>
                {MOTIVOS_SAIDA.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="gostavaTrabalho" className={labelCls}>Você gostava do seu trabalho?</label>
                <select id="gostavaTrabalho" className={inputCls} value={form.gostavaTrabalho} onChange={e => set('gostavaTrabalho', e.target.value)}>
                  <option value="">Prefiro não responder</option>
                  <option value="Sim">Sim</option>
                  <option value="Parcialmente">Parcialmente</option>
                  <option value="Não">Não</option>
                </select>
              </div>
              <div>
                <label htmlFor="voltaria" className={labelCls}>Voltaria a trabalhar conosco?</label>
                <select id="voltaria" className={inputCls} value={form.voltaria} onChange={e => set('voltaria', e.target.value)}>
                  <option value="">Prefiro não responder</option>
                  <option value="Sim">Sim</option>
                  <option value="Talvez">Talvez</option>
                  <option value="Não">Não</option>
                </select>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">Como foi sua experiência (1 a 5)</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {NOTAS.map(n => (
                <Estrelas
                  key={n.campo}
                  id={`rot-${n.campo}`}
                  label={n.label}
                  nota={form[n.campo] as number}
                  onChange={v => set(n.campo, v)}
                />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">Na sua opinião</h2>
            <div>
              <label htmlFor="oqMaisGostava" className={labelCls}>O que você mais gostava?</label>
              <textarea id="oqMaisGostava" rows={2} className={inputCls} value={form.oqMaisGostava} onChange={e => set('oqMaisGostava', e.target.value)} placeholder="O que funcionava bem…" />
            </div>
            <div>
              <label htmlFor="oqMenosGostava" className={labelCls}>O que você menos gostava?</label>
              <textarea id="oqMenosGostava" rows={2} className={inputCls} value={form.oqMenosGostava} onChange={e => set('oqMenosGostava', e.target.value)} placeholder="O que poderia ser melhor…" />
            </div>
            <div>
              <label htmlFor="sugestoes" className={labelCls}>Sugestões para a empresa</label>
              <textarea id="sugestoes" rows={3} className={inputCls} value={form.sugestoes} onChange={e => set('sugestoes', e.target.value)} placeholder="O que você mudaria…" />
            </div>
          </section>

          {erro && (
            <p role="alert" className="text-[12px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{erro}</p>
          )}

          <div className="flex justify-end pt-1">
            <button
              onClick={enviar}
              disabled={enviando}
              className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-slate-900/15 transition disabled:opacity-60"
            >
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Enviar respostas
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-400 font-semibold pb-6">SGPC · Grupo Christus</p>
      </div>
    </div>
  );
};
