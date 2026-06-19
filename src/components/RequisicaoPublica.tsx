import React, { useEffect, useState } from 'react';
import { db, isFirebaseEnabled, collection, addDoc, getDocs } from '../lib/firebase';
import { CheckCircle2, Send, ClipboardSignature, Loader2 } from 'lucide-react';

/**
 * Formulário PÚBLICO de Requisição de Abertura de Vaga (o gestor preenche sem login).
 * Renderizado fora do app (rota /requisicao) — visual próprio, não parece o sistema.
 * Ao enviar, cria um doc em `requisicoes` com status "pendente" para o RH aceitar.
 */

const TIPOS_CONTRATACAO = [
  'Substituição por Demissão',
  'Substituição por Pedido de Desligamento',
  'Substituição por Transferência/Promoção',
  'Substituição por Fim de Contrato',
  'Substituição por Licença-maternidade',
  'Substituição por Licença-saúde',
  'Ampliação do Quadro de Pessoal',
  'Contratação Temporária',
  'Mudança de Temporário para Permanente',
];

const inputCls = 'w-full text-sm px-3.5 py-2.5 border border-slate-300 rounded-lg outline-none bg-white focus:border-slate-800 focus:ring-2 focus:ring-slate-900/10 transition';
const labelCls = 'block text-xs font-bold text-slate-600 mb-1.5';

export const RequisicaoPublica: React.FC = () => {
  const [sedes, setSedes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  const [form, setForm] = useState({
    cargo: '', sede: '', setor: '', selecao: 'Externa' as 'Interna' | 'Externa' | 'Mista',
    tipoContratacao: TIPOS_CONTRATACAO[0], justificativa: '', jornada: '', idade: '',
    experiencia: '', salarioBeneficios: '', hardSkills: '', softSkills: '',
    responsabilidades: '', gestorSolicitante: '', gestorEmail: ''
  });
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    (async () => {
      if (!isFirebaseEnabled || !db) return;
      try {
        const snap = await getDocs(collection(db, 'sedes'));
        const nomes: string[] = [];
        snap.forEach((d: any) => { const n = d.data()?.nome; if (n) nomes.push(n); });
        nomes.sort((a, b) => a.localeCompare(b, 'pt-BR'));
        setSedes(nomes);
      } catch (e) {
        // sem acesso à lista — o usuário digita a sede livremente
      }
    })();
  }, []);

  const enviar = async () => {
    setErro('');
    if (!form.cargo.trim() || !form.sede.trim() || !form.gestorSolicitante.trim()) {
      setErro('Preencha pelo menos Cargo, Sede e Gestor solicitante.');
      return;
    }
    if (!isFirebaseEnabled || !db) { setErro('Serviço indisponível no momento.'); return; }
    setEnviando(true);
    try {
      await addDoc(collection(db, 'requisicoes'), {
        ...form,
        cargo: form.cargo.trim(),
        sede: form.sede.trim(),
        gestorSolicitante: form.gestorSolicitante.trim(),
        status: 'pendente',
        criadaEm: new Date().toISOString()
      });
      setEnviado(true);
    } catch (e: any) {
      setErro('Não foi possível enviar. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold text-slate-800 mb-1">Requisição enviada!</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Recebemos seu pedido de abertura de vaga para <b className="text-slate-700">{form.cargo}</b>. O RH vai analisar e dar retorno.
          </p>
          <button onClick={() => { setEnviado(false); setForm(f => ({ ...f, cargo: '', setor: '', justificativa: '', responsabilidades: '' })); }} className="mt-6 text-xs font-bold text-slate-500 hover:text-slate-800 underline">
            Enviar outra requisição
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
            <ClipboardSignature className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight leading-none">Requisição de Abertura de Vaga</h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">Preencha os dados abaixo para solicitar a abertura de uma nova vaga.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          {/* Identificação */}
          <section className="space-y-4">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">Identificação</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className={labelCls}>Cargo *</label><input className={inputCls} value={form.cargo} onChange={e => set('cargo', e.target.value)} placeholder="Ex.: Auxiliar Administrativo" /></div>
              <div>
                <label className={labelCls}>Sede *</label>
                {sedes.length > 0 ? (
                  <select className={inputCls} value={form.sede} onChange={e => set('sede', e.target.value)}>
                    <option value="">Selecione…</option>
                    {sedes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <input className={inputCls} value={form.sede} onChange={e => set('sede', e.target.value)} placeholder="Nome da sede/unidade" />
                )}
              </div>
              <div><label className={labelCls}>Setor</label><input className={inputCls} value={form.setor} onChange={e => set('setor', e.target.value)} placeholder="Ex.: Financeiro" /></div>
              <div>
                <label className={labelCls}>Tipo de seleção</label>
                <select className={inputCls} value={form.selecao} onChange={e => set('selecao', e.target.value)}>
                  <option value="Interna">Interna</option>
                  <option value="Externa">Externa</option>
                  <option value="Mista">Mista</option>
                </select>
              </div>
            </div>
          </section>

          {/* Origem / Tipo */}
          <section className="space-y-4">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">Origem da vaga</h2>
            <div><label className={labelCls}>Tipo da contratação</label>
              <select className={inputCls} value={form.tipoContratacao} onChange={e => set('tipoContratacao', e.target.value)}>
                {TIPOS_CONTRATACAO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Justifique o motivo da contratação</label><textarea className={inputCls} rows={3} value={form.justificativa} onChange={e => set('justificativa', e.target.value)} /></div>
          </section>

          {/* Requisitos */}
          <section className="space-y-4">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">Requisitos da vaga</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className={labelCls}>Jornada / Horário</label><input className={inputCls} value={form.jornada} onChange={e => set('jornada', e.target.value)} placeholder="Ex.: 8h–18h, seg–sex" /></div>
              <div><label className={labelCls}>Idade (faixa)</label><input className={inputCls} value={form.idade} onChange={e => set('idade', e.target.value)} /></div>
              <div><label className={labelCls}>Experiência / Tempo</label><input className={inputCls} value={form.experiencia} onChange={e => set('experiencia', e.target.value)} /></div>
              <div><label className={labelCls}>Salário e benefícios</label><input className={inputCls} value={form.salarioBeneficios} onChange={e => set('salarioBeneficios', e.target.value)} /></div>
            </div>
            <div><label className={labelCls}>Hard Skills (técnicas / formação)</label><textarea className={inputCls} rows={2} value={form.hardSkills} onChange={e => set('hardSkills', e.target.value)} /></div>
            <div><label className={labelCls}>Soft Skills (comportamentais)</label><textarea className={inputCls} rows={2} value={form.softSkills} onChange={e => set('softSkills', e.target.value)} /></div>
            <div><label className={labelCls}>Principais responsabilidades</label><textarea className={inputCls} rows={3} value={form.responsabilidades} onChange={e => set('responsabilidades', e.target.value)} /></div>
          </section>

          {/* Gestor */}
          <section className="space-y-4">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">Gestor solicitante</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className={labelCls}>Nome *</label><input className={inputCls} value={form.gestorSolicitante} onChange={e => set('gestorSolicitante', e.target.value)} /></div>
              <div><label className={labelCls}>E-mail (para retorno)</label><input className={inputCls} type="email" value={form.gestorEmail} onChange={e => set('gestorEmail', e.target.value)} /></div>
            </div>
          </section>

          {erro && <div className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{erro}</div>}

          <button onClick={enviar} disabled={enviando} className="w-full px-5 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition">
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {enviando ? 'Enviando…' : 'Enviar requisição'}
          </button>
        </div>

        <p className="text-center text-[11px] text-slate-400 font-medium mt-4">Os campos marcados com * são obrigatórios.</p>
      </div>
    </div>
  );
};
