/**
 * Fotos e PDFs da turma (29/10/2026), guardados no Drive compartilhado do RH.
 * Só o RH da unidade abre (a rota confere). Até 10 por turma; a foto é
 * reduzida antes de subir. As fotos aparecem para escolher no relatório
 * mensal, na página do treinamento em destaque.
 */
import { useEffect, useRef, useState } from 'react';
import { Paperclip, FileText, Trash2, Download, Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import type { Treinamento } from '../../types';
import { listarAnexos, enviarAnexo, baixarAnexo, apagarAnexo, ErroDeAnexo, MAX_ANEXOS, TETO_PDF_MB, type Anexo } from '../../hooks/useAnexos';

interface Props {
  turma: Pick<Treinamento, 'id' | 'tema' | 'escopo'>;
  aoFechar: () => void;
}

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function AnexosModal({ turma, aoFechar }: Props) {
  const [anexos, setAnexos] = useState<Anexo[] | null>(null);
  const [miniaturas, setMiniaturas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState('');
  const [erro, setErro] = useState('');
  const [naoLigado, setNaoLigado] = useState(false);
  const urls = useRef<string[]>([]);

  const falhou = (e: unknown) => {
    if (e instanceof ErroDeAnexo && e.naoLigado) setNaoLigado(true);
    setErro(e instanceof ErroDeAnexo ? e.message : 'Algo deu errado. Tente de novo.');
  };
  const recarregar = () => listarAnexos(turma.id).then(setAnexos).catch(e => { setAnexos([]); falhou(e); });
  useEffect(() => { recarregar(); }, [turma.id]);
  useEffect(() => () => urls.current.forEach(u => URL.revokeObjectURL(u)), []);

  // Miniatura das fotos (pela rota, que confere o acesso a cada pedido).
  useEffect(() => {
    for (const a of anexos || []) {
      if (!a.tipo.startsWith('image/') || miniaturas[a.id]) continue;
      baixarAnexo(turma.id, a).then(b => {
        const u = URL.createObjectURL(b);
        urls.current.push(u);
        setMiniaturas(m => ({ ...m, [a.id]: u }));
      }).catch(() => {});
    }
  }, [anexos]);

  const enviar = async (lista: FileList | null) => {
    const arquivos = [...(lista || [])];
    const cabem = MAX_ANEXOS - (anexos?.length || 0);
    if (arquivos.length > cabem) { setErro(`Cabem mais ${cabem} anexo(s) nesta turma (até ${MAX_ANEXOS}).`); return; }
    setErro('');
    for (const [i, f] of arquivos.entries()) {
      setEnviando(`Enviando ${i + 1} de ${arquivos.length}…`);
      try { await enviarAnexo(turma.id, f); } catch (e) { falhou(e); break; }
    }
    setEnviando('');
    recarregar();
  };

  const abrir = async (a: Anexo) => {
    try {
      const u = URL.createObjectURL(await baixarAnexo(turma.id, a));
      urls.current.push(u);
      const link = Object.assign(document.createElement('a'), { href: u, download: a.nome });
      link.click();
    } catch (e) { falhou(e); }
  };

  const apagar = async (a: Anexo) => {
    if (!window.confirm(`Apagar "${a.nome}"? Vai para a lixeira do Drive.`)) return;
    try { await apagarAnexo(turma.id, a.id); recarregar(); } catch (e) { falhou(e); }
  };

  const cheio = (anexos?.length || 0) >= MAX_ANEXOS;
  return (
    <Modal titulo="Anexos da turma" antes={turma.tema} aoFechar={aoFechar} largura="lg"
      rodape={<button type="button" className="btn" onClick={aoFechar}>Fechar</button>}>
      <div className="space-y-4">
        {erro && <p role="alert" className="erro-form">{erro}</p>}
        {naoLigado ? (
          <p className="text-[13px]" style={{ color: 'var(--tinta-2)' }}>
            Os anexos vão para o Drive compartilhado do RH, e essa ligação ainda está sendo configurada. Assim que estiver pronta, os arquivos aparecem aqui.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <label className={`btn ${cheio || enviando || anexos === null ? 'opacity-50 pointer-events-none' : ''}`}>
                {enviando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Paperclip aria-hidden="true" />}
                {enviando || 'Anexar fotos ou PDF'}
                <input type="file" multiple accept="image/*,application/pdf" className="sr-only" disabled={cheio || !!enviando}
                  onChange={e => { enviar(e.target.files); e.target.value = ''; }} />
              </label>
              <span className="text-[12.5px]" style={{ color: 'var(--tinta-3)' }}>
                {anexos?.length || 0} de {MAX_ANEXOS} · fotos são reduzidas · PDF até {TETO_PDF_MB} MB · só o RH da unidade vê
              </span>
            </div>

            {anexos === null ? <p className="text-[13px]" style={{ color: 'var(--tinta-3)' }}>Carregando…</p>
              : anexos.length === 0 ? <p className="text-[13px]" style={{ color: 'var(--tinta-3)' }}>Nenhum anexo ainda: a lista de presença assinada (PDF) e fotos da turma.</p>
              : (
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {anexos.map(a => (
                    <li key={a.id} className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--linha)' }}>
                      <button type="button" onClick={() => abrir(a)} className="block w-full aspect-[4/3] grid place-items-center" style={{ background: 'var(--fundo-2, #F3F4F6)' }}
                        title={`Baixar ${a.nome}`}>
                        {a.tipo.startsWith('image/')
                          ? (miniaturas[a.id] ? <img src={miniaturas[a.id]} alt={a.nome} className="w-full h-full object-cover" /> : <Loader2 className="animate-spin w-5 h-5" aria-label="Carregando foto" />)
                          : <FileText className="w-8 h-8" aria-hidden="true" style={{ color: 'var(--tinta-2)' }} />}
                      </button>
                      <div className="flex items-center gap-1 px-2 py-1.5">
                        <span className="flex-1 min-w-0 truncate text-[12.5px]" title={a.nome}>{a.nome}</span>
                        <span className="text-[11.5px] tabular-nums shrink-0" style={{ color: 'var(--tinta-3)' }}>{kb(a.tamanho)}</span>
                        <button type="button" className="btn-texto p-1" onClick={() => abrir(a)} aria-label={`Baixar ${a.nome}`}><Download className="w-3.5 h-3.5" aria-hidden="true" /></button>
                        <button type="button" className="btn-texto p-1" style={{ color: 'var(--atraso)' }} onClick={() => apagar(a)} aria-label={`Apagar ${a.nome}`}><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
          </>
        )}
      </div>
    </Modal>
  );
}
