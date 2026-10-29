/**
 * Lista de presença para imprimir ANTES da turma acontecer (29/10/2026): o RH
 * imprime, os participantes assinam no dia, e só depois a turma é registrada.
 * Não depende de turma gravada: os dados da ação são opcionais (vazio sai em
 * branco na folha, para preencher à mão). Os nomes vêm do quadro da Infra
 * (Chromos), filtrados pelas sedes marcadas.
 */
import { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { FiltroMultiplo } from '../ui/FiltroMultiplo';
import { lerQuadroDaInfra, type PessoaDoQuadro } from '../../hooks/usePresencas';
import { imprimirListaDePresenca, horaDaLista, cargaDaLista, LINHAS_EM_BRANCO, type UnidadeDaLista } from '../../utils/listaPresenca';
import { formatDateBR } from '../../utils/date';

interface Props {
  aoFechar: () => void;
  /** Para testar a tela sem o Chromos; por padrão, o real. */
  carregarQuadro?: () => Promise<PessoaDoQuadro[]>;
}

const ROTULO_UNIDADE: Record<UnidadeDaLista, string> = { colegio: 'Colégio', universidade: 'Universidade' };

export function ImprimirListaModal({ aoFechar, carregarQuadro = lerQuadroDaInfra }: Props) {
  const [quadro, setQuadro] = useState<PessoaDoQuadro[] | null>(null);
  const [erroQuadro, setErroQuadro] = useState('');
  const [unidade, setUnidade] = useState<UnidadeDaLista | ''>('');
  const [sedesSel, setSedesSel] = useState<string[]>([]);
  const [dados, setDados] = useState({ tema: '', instrutor: '', data: '', local: '', horario: '', cargaHoraria: '' });
  const [erro, setErro] = useState('');

  useEffect(() => {
    carregarQuadro().then(setQuadro).catch(e => { setQuadro([]); setErroQuadro(e?.message || String(e)); });
  }, []);

  // O RH recebe só a unidade dele; o Administrador recebe as duas e escolhe (é a logo da folha).
  const unidades = useMemo(() => [...new Set((quadro || []).map(p => p.unidade))].sort() as UnidadeDaLista[], [quadro]);
  const unidadeFinal: UnidadeDaLista = (unidade || unidades[0] || 'colegio') as UnidadeDaLista;
  const daUnidade = useMemo(() => (quadro || []).filter(p => p.unidade === unidadeFinal), [quadro, unidadeFinal]);
  const sedes = useMemo(() => [...new Set(daUnidade.map(p => p.sede))].sort(), [daUnidade]);
  const nomes = useMemo(() => daUnidade.filter(p => !sedesSel.length || sedesSel.includes(p.sede)), [daUnidade, sedesSel]);

  const campo = (k: keyof typeof dados, rotulo: string, extra: Record<string, unknown> = {}) => (
    <label className="block">
      <span className="rotulo">{rotulo}</span>
      <input className="campo w-full" value={dados[k]} onChange={e => setDados(d => ({ ...d, [k]: e.target.value }))} {...extra} />
    </label>
  );

  const imprimir = () => {
    const abriu = imprimirListaDePresenca({
      unidade: unidadeFinal, logo: `${window.location.origin}/logos/${unidadeFinal}.png`,
      tema: dados.tema.trim(), instrutor: dados.instrutor.trim(), data: dados.data ? formatDateBR(dados.data) : '',
      local: dados.local.trim() || sedesSel.join(', '), horario: horaDaLista(dados.horario), cargaHoraria: cargaDaLista(Number(dados.cargaHoraria)),
      pessoas: nomes.map(p => ({ nome: p.nome, setor: 'Infra' })), emBranco: LINHAS_EM_BRANCO,
    });
    setErro(abriu ? '' : 'O navegador bloqueou a janela de impressão. Libere pop-ups para o SGPC e tente de novo.');
  };

  return (
    <Modal
      titulo="Imprimir lista de presença"
      aoFechar={aoFechar}
      rodape={<>
        <button type="button" className="btn" onClick={aoFechar}>Fechar</button>
        <button type="button" className="btn btn-primario" disabled={quadro === null} onClick={imprimir}>
          <Printer aria-hidden="true" />Imprimir ({nomes.length} {nomes.length === 1 ? 'nome' : 'nomes'})
        </button>
      </>}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="erro-form">{erro}</p>}
        <p className="text-[13px]" style={{ color: 'var(--tinta-2)' }}>
          Para imprimir antes da turma: os ASG das sedes marcadas saem com o nome impresso e só assinam; depois deles, linhas em branco até o fim da folha. O que ficar vazio abaixo sai em branco na folha.
        </p>

        <div className="filtros">
          {unidades.length > 1 && (
            <label className="inline-flex items-center gap-2 text-[13px]">
              Logo
              <select className="campo" value={unidadeFinal} onChange={e => { setUnidade(e.target.value as UnidadeDaLista); setSedesSel([]); }}>
                {unidades.map(u => <option key={u} value={u}>{ROTULO_UNIDADE[u]}</option>)}
              </select>
            </label>
          )}
          <FiltroMultiplo rotulo="Sedes" todos="todas" opcoes={sedes.map(s => ({ valor: s, rotulo: s }))} selecionados={sedesSel} onChange={setSedesSel} />
        </div>
        {quadro === null && <p className="text-[13px]" style={{ color: 'var(--tinta-3)' }}>Lendo o quadro do Chromos…</p>}
        {erroQuadro && <p className="text-[13px]" style={{ color: 'var(--atraso)' }}>{erroQuadro} Dá para imprimir só com linhas em branco.</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {campo('tema', 'Tema do treinamento')}
          {campo('instrutor', 'Instrutor(es)')}
          {campo('data', 'Data', { type: 'date' })}
          {campo('local', 'Local', { placeholder: 'Vazio: as sedes marcadas' })}
          {campo('horario', 'Horário', { type: 'time' })}
          {campo('cargaHoraria', 'Carga horária (horas)', { type: 'number', min: 0.5, step: 0.5, inputMode: 'decimal', className: 'campo w-full tabular-nums' })}
        </div>
      </div>
    </Modal>
  );
}
