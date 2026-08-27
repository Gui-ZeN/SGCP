import React, { useState } from 'react';
import { Vaga } from '../types';
import { listarAbas, parseVagasDaAba, planejarImportacao, PlanoDeImportacao } from '../lib/vagasAnuaisImport';
import { FileSpreadsheet, Loader2, AlertTriangle, CheckCircle2, Upload } from 'lucide-react';

/**
 * Importação da planilha anual "Controle de Vagas" (uma aba por ano).
 *
 * O fluxo é em três passos deliberados — arquivo, aba, prévia — porque
 * importação é de mão única: escolher a aba errada ou duplicar 355 vagas dá
 * muito trabalho para desfazer. Nada é gravado antes do "Importar" da prévia.
 */

interface Props {
  vagasExistentes: Pick<Vaga, 'vaga' | 'sede' | 'solicitacao'>[];
  onImportar: (novas: Omit<Vaga, 'id' | 'codigo'>[]) => Promise<number>;
  onConcluir?: (quantidade: number, aba: string) => void;
}

const cartao = 'bg-white rounded-2xl border border-slate-200 p-5';
const rotulo = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5';

export const ImportarVagasAnuais: React.FC<Props> = ({ vagasExistentes, onImportar, onConcluir }) => {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [abas, setAbas] = useState<string[]>([]);
  const [aba, setAba] = useState('');
  const [plano, setPlano] = useState<PlanoDeImportacao | null>(null);
  const [ocupado, setOcupado] = useState<'' | 'lendo' | 'analisando' | 'gravando'>('');
  const [erro, setErro] = useState('');
  const [importadas, setImportadas] = useState<number | null>(null);

  const limparResultado = () => { setPlano(null); setImportadas(null); setErro(''); };

  const escolherArquivo = async (file: File | null) => {
    limparResultado();
    setArquivo(file); setAbas([]); setAba('');
    if (!file) return;
    setOcupado('lendo');
    try {
      const nomes = await listarAbas(file);
      setAbas(nomes);
      if (!nomes.length) setErro('Não consegui ler as abas deste arquivo. Ele é um .xlsx?');
    } catch {
      setErro('Não consegui abrir o arquivo.');
    } finally {
      setOcupado('');
    }
  };

  const analisar = async (nomeDaAba: string) => {
    setAba(nomeDaAba);
    limparResultado();
    if (!arquivo || !nomeDaAba) return;
    setOcupado('analisando');
    try {
      const { vagas, ignoradas } = await parseVagasDaAba(arquivo, nomeDaAba);
      setPlano(planejarImportacao(vagas, vagasExistentes, ignoradas));
    } catch (e: any) {
      setErro(`Erro ao ler a aba: ${e?.message || e}`);
    } finally {
      setOcupado('');
    }
  };

  const confirmar = async () => {
    if (!plano?.aImportar.length) return;
    setOcupado('gravando'); setErro('');
    try {
      const n = await onImportar(plano.aImportar);
      setImportadas(n);
      setPlano(null);
      onConcluir?.(n, aba);
    } catch (e: any) {
      setErro(`Erro ao gravar: ${e?.message || e}`);
    } finally {
      setOcupado('');
    }
  };

  return (
    <div className={`${cartao} space-y-5`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
          <FileSpreadsheet className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-slate-800">Importar planilha anual de vagas</h3>
          <p className="text-[12px] text-slate-500 font-medium">
            Para o "Controle de Vagas", que tem uma aba por ano. Você escolhe a aba e confere a prévia antes de gravar.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="arq-vagas-anuais" className={rotulo}>1 · Arquivo (.xlsx)</label>
          <input
            id="arq-vagas-anuais"
            type="file"
            accept=".xlsx"
            onChange={e => escolherArquivo(e.target.files?.[0] || null)}
            className="w-full text-[12px] font-medium text-slate-600 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:font-bold file:cursor-pointer cursor-pointer"
          />
        </div>
        <div>
          <label htmlFor="aba-vagas-anuais" className={rotulo}>2 · Aba (ano)</label>
          <select
            id="aba-vagas-anuais"
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
        <p role="alert" className="text-[12px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
          {erro}
        </p>
      )}

      {importadas !== null && (
        <p className="text-[12px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {importadas} vaga(s) importada(s) da aba "{aba}".
        </p>
      )}

      {plano && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
            <span className={rotulo + ' mb-0'}>3 · Prévia — nada foi gravado ainda</span>
          </div>

          <div className="grid grid-cols-3 divide-x divide-slate-100">
            {[
              { n: plano.aImportar.length, t: 'a importar', cor: 'text-slate-800' },
              { n: plano.jaExistem, t: 'já existem', cor: 'text-slate-400' },
              { n: plano.ignoradas.length, t: 'ignoradas', cor: plano.ignoradas.length ? 'text-amber-600' : 'text-slate-400' },
            ].map(c => (
              <div key={c.t} className="px-4 py-3 text-center">
                <div className={`text-xl font-extrabold ${c.cor}`}>{c.n}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{c.t}</div>
              </div>
            ))}
          </div>

          {plano.ignoradas.length > 0 && (
            <details className="border-t border-slate-100 px-4 py-2.5">
              <summary className="text-[11px] font-bold text-amber-700 cursor-pointer flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Ver as {plano.ignoradas.length} linhas ignoradas
              </summary>
              <ul className="mt-2 space-y-0.5 max-h-40 overflow-y-auto">
                {plano.ignoradas.map((motivo, i) => (
                  <li key={i} className="text-[11px] text-slate-500 font-medium">{motivo}</li>
                ))}
              </ul>
            </details>
          )}

          <div className="border-t border-slate-100 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500 font-medium">
              {plano.aImportar.length > 0
                ? 'As que já existem são puladas — o dado do sistema é mantido.'
                : 'Nada novo nesta aba.'}
            </p>
            <button
              onClick={confirmar}
              disabled={!plano.aImportar.length || ocupado === 'gravando'}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {ocupado === 'gravando'
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gravando…</>
                : <><Upload className="w-3.5 h-3.5" /> Importar {plano.aImportar.length}</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
