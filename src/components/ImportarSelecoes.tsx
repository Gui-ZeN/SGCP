import React, { useState } from 'react';
import { Selecao } from '../types';
import { listarAbas, parseSelecoes, planejarSelecoes, ehAbaQuanti, origemDaAba } from '../lib/selecoesImport';
import { Users, Loader2, AlertTriangle, CheckCircle2, Upload } from 'lucide-react';

/**
 * Importação das abas QUANTI da planilha de Seleções.
 *
 * Mesmo fluxo do importador de vagas (arquivo → aba → prévia), com duas
 * diferenças: o dropdown só oferece abas "QUANTI" — as nominais têm nome de
 * candidato e não entram no sistema — e a prévia avisa quantas linhas têm
 * `convocados ≠ compareceram + ausentes`, porque isso afeta a taxa exibida.
 */

interface Props {
  selecoesExistentes: Pick<Selecao, 'data' | 'cargo' | 'sede' | 'origem'>[];
  onImportar: (novas: Omit<Selecao, 'id'>[]) => Promise<number>;
  onConcluir?: (quantidade: number, aba: string) => void;
}

const rotulo = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5';

export const ImportarSelecoes: React.FC<Props> = ({ selecoesExistentes, onImportar, onConcluir }) => {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [abas, setAbas] = useState<string[]>([]);
  const [aba, setAba] = useState('');
  const [previa, setPrevia] = useState<{
    aImportar: Omit<Selecao, 'id'>[]; jaExistem: number; ignoradas: string[]; inconsistentes: number;
  } | null>(null);
  const [ocupado, setOcupado] = useState<'' | 'lendo' | 'analisando' | 'gravando'>('');
  const [erro, setErro] = useState('');
  const [importadas, setImportadas] = useState<number | null>(null);

  const limpar = () => { setPrevia(null); setImportadas(null); setErro(''); };

  const escolherArquivo = async (file: File | null) => {
    limpar(); setArquivo(file); setAbas([]); setAba('');
    if (!file) return;
    setOcupado('lendo');
    try {
      const todas = await listarAbas(file);
      const quanti = todas.filter(ehAbaQuanti);
      setAbas(quanti);
      if (!quanti.length) {
        setErro(todas.length
          ? 'Nenhuma aba "QUANTI" neste arquivo. Só as abas de totais são importadas — as nominais têm nome de candidato.'
          : 'Não consegui ler as abas deste arquivo. Ele é um .xlsx?');
      }
    } catch {
      setErro('Não consegui abrir o arquivo.');
    } finally { setOcupado(''); }
  };

  const analisar = async (nome: string) => {
    setAba(nome); limpar();
    if (!arquivo || !nome) return;
    setOcupado('analisando');
    try {
      const { selecoes, ignoradas, inconsistentes } = await parseSelecoes(arquivo, nome);
      const { aImportar, jaExistem } = planejarSelecoes(selecoes, selecoesExistentes);
      setPrevia({ aImportar, jaExistem, ignoradas, inconsistentes });
    } catch (e: any) {
      setErro(`Erro ao ler a aba: ${e?.message || e}`);
    } finally { setOcupado(''); }
  };

  const confirmar = async () => {
    if (!previa?.aImportar.length) return;
    setOcupado('gravando'); setErro('');
    try {
      const n = await onImportar(previa.aImportar);
      setImportadas(n); setPrevia(null); onConcluir?.(n, aba);
    } catch (e: any) {
      setErro(`Erro ao gravar: ${e?.message || e}`);
    } finally { setOcupado(''); }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
          <Users className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-slate-800">Importar seleções (abas QUANTI)</h3>
          <p className="text-[12px] text-slate-500 font-medium">
            Convocados, presentes e contratados por dia de seleção. Alimenta os indicadores — não se liga a uma vaga.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="arq-selecoes" className={rotulo}>1 · Arquivo (.xlsx)</label>
          <input
            id="arq-selecoes"
            type="file"
            accept=".xlsx"
            onChange={e => escolherArquivo(e.target.files?.[0] || null)}
            className="w-full text-[12px] font-medium text-slate-600 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:font-bold file:cursor-pointer cursor-pointer"
          />
        </div>
        <div>
          <label htmlFor="aba-selecoes" className={rotulo}>2 · Aba de totais</label>
          <select
            id="aba-selecoes"
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl bg-white font-medium outline-none focus:border-slate-800 disabled:bg-slate-50 disabled:text-slate-400 cursor-pointer"
            value={aba}
            disabled={!abas.length || ocupado === 'lendo'}
            onChange={e => analisar(e.target.value)}
          >
            <option value="">{abas.length ? 'Selecione…' : 'Escolha o arquivo primeiro'}</option>
            {abas.map(nome => <option key={nome} value={nome}>{nome}</option>)}
          </select>
        </div>
      </div>

      {ocupado && ocupado !== 'gravando' && (
        <p className="text-[12px] font-bold text-slate-500 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {ocupado === 'lendo' ? 'Lendo as abas do arquivo…' : 'Analisando a aba…'}
        </p>
      )}

      {erro && (
        <p role="alert" className="text-[12px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{erro}</p>
      )}

      {importadas !== null && (
        <p className="text-[12px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {importadas} evento(s) importado(s) da aba "{aba}".
        </p>
      )}

      {previa && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between gap-2">
            <span className={rotulo + ' mb-0'}>3 · Prévia — nada foi gravado ainda</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              funil {origemDaAba(aba) === 'pedagogico' ? 'pedagógico' : 'geral'}
            </span>
          </div>

          <div className="grid grid-cols-3 divide-x divide-slate-100">
            {[
              { n: previa.aImportar.length, t: 'a importar', cor: 'text-slate-800' },
              { n: previa.jaExistem, t: 'já existem', cor: 'text-slate-400' },
              { n: previa.ignoradas.length, t: 'ignoradas', cor: previa.ignoradas.length ? 'text-amber-600' : 'text-slate-400' },
            ].map(c => (
              <div key={c.t} className="px-4 py-3 text-center">
                <div className={`text-xl font-extrabold ${c.cor}`}>{c.n}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{c.t}</div>
              </div>
            ))}
          </div>

          {previa.inconsistentes > 0 && (
            <p className="border-t border-slate-100 px-4 py-2.5 text-[11px] font-semibold text-amber-800 bg-amber-50 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>
                {previa.inconsistentes} linha(s) com <strong>convocados ≠ compareceram + ausentes</strong>. Entram
                assim mesmo (é o que o RH registrou), mas a taxa de comparecimento aparece nos indicadores com esse aviso.
              </span>
            </p>
          )}

          {previa.ignoradas.length > 0 && (
            <details className="border-t border-slate-100 px-4 py-2.5">
              <summary className="text-[11px] font-bold text-amber-700 cursor-pointer">
                Ver as {previa.ignoradas.length} linhas ignoradas
              </summary>
              <ul className="mt-2 space-y-0.5 max-h-40 overflow-y-auto">
                {previa.ignoradas.map((m, i) => <li key={i} className="text-[11px] text-slate-500 font-medium">{m}</li>)}
              </ul>
            </details>
          )}

          <div className="border-t border-slate-100 px-4 py-3 flex justify-end">
            <button
              onClick={confirmar}
              disabled={!previa.aImportar.length || ocupado === 'gravando'}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {ocupado === 'gravando'
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gravando…</>
                : <><Upload className="w-3.5 h-3.5" /> Importar {previa.aImportar.length}</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
