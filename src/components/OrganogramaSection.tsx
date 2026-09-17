import React, { useMemo, useState } from 'react';
import type { Funcionario } from '../types';
import type { Sede, Cargo, Setor } from '../hooks/useMetadata';
import { montarOrganograma, profundidade, type NoOrganograma } from '../utils/organograma';
import { rotuloDoNivel } from './AdminCargosTab';
import { siglaCanonica } from '../utils/unidade';
import {
  Network, Plus, Minus, X, Pencil, Trash2, Info, Printer, ChevronDown, ChevronRight,
} from 'lucide-react';

/**
 * Organograma — desenhado a partir do NÍVEL DO CARGO.
 *
 * O RH cadastra pessoa e cargo; o nível vem do catálogo (Painel Admin). O
 * desenho é consequência, não digitação — ver `utils/organograma.ts` para a
 * regra e para o que ela deliberadamente NÃO adivinha.
 *
 * A tela também é o cadastro de funcionários que o sistema nunca teve: a
 * coleção `funcionarios` existia alimentando só os aniversários, sem lugar
 * para inserir gente.
 */
interface OrganogramaSectionProps {
  funcionarios: Funcionario[];
  sedes: Sede[];
  cargos: Cargo[];
  setores: Setor[];
  addFuncionario?: (dados: Omit<Funcionario, 'id'>) => Promise<void>;
  updateFuncionario?: (id: string, campos: Partial<Funcionario>) => Promise<void>;
  deleteFuncionario?: (id: string) => Promise<void>;
  confirmAction?: (titulo: string, mensagem: string, onConfirm: () => void | Promise<void>) => void;
  sedePadrao?: string;
}

const campoCls = 'w-full text-sm px-3 py-2.5 border border-slate-200 rounded-xl outline-none bg-white font-medium focus:border-slate-800';
const rotuloCls = 'block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1';

const VAZIO = { nome: '', cargo: '', setor: '', sede: '', respondeA: '', ativo: true };

export const OrganogramaSection: React.FC<OrganogramaSectionProps> = ({
  funcionarios, sedes, cargos, setores,
  addFuncionario, updateFuncionario, deleteFuncionario, confirmAction, sedePadrao = '',
}) => {
  /**
   * O recorte do desenho é a REGIÃO, não a sede: a coordenação é regional — o
   * coordenador fica lotado numa sede e responde pelas outras. Por sede, o
   * quadro real deixava 126 caixas soltas no topo; por região, 36.
   */
  const regioes = useMemo(
    () => [...new Set(sedes.map(s => s.regiao).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [sedes]
  );
  const regiaoDaSedePadrao = sedes.find(s => siglaCanonica(sedes, s.nome) === siglaCanonica(sedes, sedePadrao))?.regiao;
  const [regiaoAtiva, setRegiaoAtiva] = useState(regiaoDaSedePadrao || regioes[0] || '');
  const [editando, setEditando] = useState<Funcionario | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const [form, setForm] = useState({ ...VAZIO });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());

  /** Nome do cargo (normalizado pela própria util) → nível. */
  const nivelDoCargo = useMemo(() => {
    const mapa = new Map<string, number>();
    cargos.forEach(c => {
      if (c?.nome && typeof c.nivel === 'number' && c.nivel > 0) {
        mapa.set(c.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(), c.nivel);
      }
    });
    return mapa;
  }, [cargos]);

  const regiaoDe = useMemo(() => {
    const mapa = new Map(sedes.map(s => [siglaCanonica(sedes, s.nome), s.regiao || '']));
    return (nomeSede?: string) => mapa.get(siglaCanonica(sedes, nomeSede)) || '';
  }, [sedes]);

  const daSede = useMemo(
    () => funcionarios.filter(f => regiaoDe(f.sede) === regiaoAtiva),
    [funcionarios, regiaoDe, regiaoAtiva]
  );

  const { raizes, ambiguidades, semNivel, total } = useMemo(
    () => montarOrganograma(daSede, nivelDoCargo),
    [daSede, nivelDoCargo]
  );

  const abrirNovo = () => {
    setEditando(null);
    setForm({ ...VAZIO, sede: sedes.find(s => s.regiao === regiaoAtiva)?.nome || '' });
    setErro('');
    setAbrindo(true);
  };

  const abrirEdicao = (f: Funcionario) => {
    setEditando(f);
    setForm({
      nome: f.nome || '', cargo: f.cargo || '', setor: f.setor || '',
      sede: f.sede || '', respondeA: f.respondeA || '', ativo: f.ativo !== false,
    });
    setErro('');
    setAbrindo(true);
  };

  /**
   * Superiores possíveis para o campo de desempate: só quem está ACIMA na
   * régua, na mesma sede. Oferecer a lista inteira convidaria a pendurar um
   * diretor sob um assistente.
   */
  const superioresPossiveis = useMemo(() => {
    const meuNivel = nivelDoCargo.get(
      form.cargo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    );
    return funcionarios
      .filter(f => {
        if (f.id === editando?.id || f.ativo === false) return false;
        if (regiaoDe(f.sede) !== regiaoDe(form.sede)) return false;
        const n = nivelDoCargo.get(
          String(f.cargo || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
        );
        return n !== undefined && (meuNivel === undefined || n < meuNivel);
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [funcionarios, regiaoDe, form.cargo, form.sede, editando, nivelDoCargo]);

  const salvar = async () => {
    if (!form.nome.trim()) return setErro('Informe o nome.');
    if (!form.cargo.trim()) return setErro('Informe o cargo.');
    if (!form.sede.trim()) return setErro('Informe a sede.');

    const corpo: Omit<Funcionario, 'id'> = {
      nome: form.nome.trim(),
      cargo: form.cargo.trim(),
      setor: form.setor.trim() || undefined,
      sede: form.sede.trim(),
      respondeA: form.respondeA || undefined,
      ativo: form.ativo,
      // O roster nasceu para aniversários e exige o campo; quem cadastra pelo
      // organograma não sabe a data, e travar por isso impediria o cadastro.
      dataNascimento: editando?.dataNascimento || '',
    };

    setSalvando(true);
    try {
      if (editando && updateFuncionario) await updateFuncionario(editando.id, corpo);
      else if (addFuncionario) await addFuncionario(corpo);
      setAbrindo(false);
    } catch (e: any) {
      setErro(`Não foi possível salvar: ${e?.message || e}`);
    } finally {
      setSalvando(false);
    }
  };

  const remover = (f: Funcionario) => {
    if (!deleteFuncionario) return;
    const acao = () => deleteFuncionario(f.id);
    if (confirmAction) confirmAction('Remover do organograma', `Remover "${f.nome}" do cadastro?`, acao);
    else acao();
  };

  const alternarRecolhido = (id: string) =>
    setRecolhidos(s => {
      const novo = new Set(s);
      novo.has(id) ? novo.delete(id) : novo.add(id);
      return novo;
    });

  const podeEditar = !!addFuncionario;

  /**
   * Imprimir/PDF: EXPANDE TUDO antes de chamar a impressão.
   *
   * O recolhido não está escondido por CSS — ele não existe no DOM. Sem isto o
   * PDF que o RH manda por e-mail sairia com as 9 primeiras pessoas de 81, e
   * ninguém perceberia: a folha parece completa.
   */
  const imprimir = () => {
    const todosComEquipe = new Set<string>();
    const varrer = (lista: NoOrganograma[]) => lista.forEach(n => {
      if (n.filhos.length) todosComEquipe.add(n.pessoa.id);
      varrer(n.filhos);
    });
    varrer(raizes);
    setRecolhidos(new Set());
    setMostrarTodos(todosComEquipe);
    // Dois quadros: um para o React aplicar o estado, outro para o layout
    // assentar antes de o navegador fotografar a página.
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  };

  const [arrastando, setArrastando] = useState<string | null>(null);
  const [arrastandoSobre, setArrastandoSobre] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const [zoom, setZoom] = useState(1);
  const [soltaLivre, setSoltaLivre] = useState(false);
  const [mostrarTodos, setMostrarTodos] = useState<Set<string>>(new Set());
  const arvoreRef = React.useRef<HTMLUListElement>(null);

  /**
   * Centraliza na raiz ao abrir e ao trocar de sede.
   *
   * Com 51 filhos numa linha, a raiz fica no MEIO de ~11.000px: quem abria a
   * tela caía na ponta esquerda da base e via uma fileira de caixas sem topo,
   * sem entender que aquilo era um organograma.
   */
  React.useEffect(() => {
    const ul = arvoreRef.current;
    const raiz = ul?.querySelector(':scope > li > div') as HTMLElement | null;
    const caixa = ul?.parentElement;
    if (!ul || !raiz || !caixa) return;
    const r = raiz.getBoundingClientRect();
    const c = caixa.getBoundingClientRect();
    caixa.scrollLeft += (r.left - c.left) - c.width / 2 + r.width / 2;
  }, [regiaoAtiva, total, zoom]);

  /** Todos os descendentes de alguém — a trava do arraste. */
  const descendentesDe = (id: string): Set<string> => {
    const achar = (nos: NoOrganograma[]): NoOrganograma | null => {
      for (const n of nos) {
        if (n.pessoa.id === id) return n;
        const achado = achar(n.filhos);
        if (achado) return achado;
      }
      return null;
    };
    const no = achar(raizes);
    const saco = new Set<string>();
    const descer = (n: NoOrganograma) => n.filhos.forEach(f => { saco.add(f.pessoa.id); descer(f); });
    if (no) descer(no);
    return saco;
  };

  /**
   * Soltar A sobre B = "A responde a B".
   *
   * Solta sobre o próprio chefe atual não faz nada, e soltar sobre um
   * subordinado é recusado: viraria o ciclo que a árvore teria de desmontar
   * depois. Barrar na hora, com o motivo dito, é melhor que aceitar e corrigir
   * pelas costas.
   */
  const soltarSobre = async (idArrastado: string, idDestino: string) => {
    setArrastando(null);
    if (!updateFuncionario || !idArrastado || idArrastado === idDestino) return;

    const arrastado = funcionarios.find(f => f.id === idArrastado);
    const destino = funcionarios.find(f => f.id === idDestino);
    if (!arrastado || !destino) return;

    if (descendentesDe(idArrastado).has(idDestino)) {
      setAviso(`${destino.nome} está abaixo de ${arrastado.nome} — não dá para inverter os dois de uma vez.`);
      return;
    }

    setAviso('');
    try {
      await updateFuncionario(idArrastado, { respondeA: idDestino });
    } catch (e: any) {
      setAviso(`Não foi possível mover: ${e?.message || e}`);
    }
  };

  /** Desfaz o vínculo manual e devolve a pessoa à dedução pelo nível. */
  const soltarNaRaiz = async (idArrastado: string) => {
    setArrastando(null);
    if (!updateFuncionario || !idArrastado) return;
    setAviso('');
    try {
      await updateFuncionario(idArrastado, { respondeA: '' });
    } catch (e: any) {
      setAviso(`Não foi possível soltar: ${e?.message || e}`);
    }
  };

  /** Onde os ambíguos foram parar, quando é sempre a mesma pessoa. */
  const deduzidoEm = useMemo(() => {
    const nomes = new Set(ambiguidades.map(a => a.penduradaEm?.nome).filter(Boolean));
    return nomes.size === 1 ? [...nomes][0] : '';
  }, [ambiguidades]);

  /** Quantos subordinados aparecem de cara por chefe; o resto fica a um clique. */
  const LIMITE_VISIVEL = 8;

  /** Cor da faixa por nível — dá leitura de altura sem precisar ler o número. */
  const CORES_NIVEL = [
    'bg-emerald-500', 'bg-sky-600', 'bg-indigo-500', 'bg-violet-500',
    'bg-amber-500', 'bg-rose-500', 'bg-slate-500',
  ];

  const Caixa: React.FC<{ no: NoOrganograma }> = ({ no }) => {
    const { pessoa } = no;
    const recolhido = recolhidos.has(pessoa.id);
    const temFilhos = no.filhos.length > 0;
    const ambigua = ambiguidades.some(a => a.pessoa.id === pessoa.id);
    const alvo = arrastandoSobre === pessoa.id;
    const saindo = arrastando === pessoa.id;

    return (
      <li>
        <div
          draggable={podeEditar}
          onDragStart={e => {
            setArrastando(pessoa.id);
            e.dataTransfer.setData('text/plain', pessoa.id);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragEnd={() => { setArrastando(null); setArrastandoSobre(null); }}
          onDragOver={e => {
            if (!podeEditar || !arrastando || arrastando === pessoa.id) return;
            e.preventDefault();
            // A area de "soltar para desfazer" e ANCESTRAL desta caixa: sem
            // parar aqui, ela acende junto e sugere o contrario do que vai
            // acontecer.
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            setArrastandoSobre(pessoa.id);
          }}
          onDragLeave={() => setArrastandoSobre(a => (a === pessoa.id ? null : a))}
          onDrop={e => {
            e.preventDefault();
            // Sem isto o drop sobe para a area de "soltar para desfazer" e o
            // vinculo recem-criado e apagado no mesmo gesto — medido: o
            // respondeA voltava vazio logo apos ser gravado.
            e.stopPropagation();
            setArrastandoSobre(null);
            // `arrastando` como reserva: o dataTransfer chega vazio em alguns
            // navegadores (e em drop sintetico), e o estado ja sabe quem saiu.
            soltarSobre(e.dataTransfer.getData('text/plain') || arrastando || '', pessoa.id);
          }}
          className={`group flex items-center gap-2.5 rounded-lg border bg-white px-2.5 py-1.5 transition ${
            podeEditar ? 'cursor-grab active:cursor-grabbing' : ''
          } ${
            alvo ? 'border-indigo-500 ring-2 ring-indigo-200' :
            ambigua ? 'border-slate-200 border-dashed' : 'border-slate-200'
          } ${saindo ? 'opacity-40' : ''}`}
        >
          {/* Fita do nivel: a altura na hierarquia lida sem ler numero. */}
          <span className={`w-1 self-stretch rounded-full shrink-0 ${CORES_NIVEL[(no.nivel - 1) % CORES_NIVEL.length]}`} aria-hidden="true" />

          {temFilhos ? (
            <button
              onClick={() => alternarRecolhido(pessoa.id)}
              aria-label={recolhido ? `Expandir equipe de ${pessoa.nome}` : `Recolher equipe de ${pessoa.nome}`}
              aria-expanded={!recolhido}
              className="flex items-center gap-0.5 px-1 py-0.5 -ml-0.5 rounded text-[10px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0 no-print"
            >
              {recolhido ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {no.filhos.length}
            </button>
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" aria-hidden="true" />
          )}

          <span className="text-[13px] font-bold text-slate-800 truncate">{pessoa.nome}</span>
          <span className="text-[11px] font-semibold text-slate-600 truncate">{pessoa.cargo}</span>
          {/* Sede, e não setor: agrupando por região, saber de qual unidade a
              pessoa é passa a ser a informação que falta — e `setor` vem vazio
              nos 399 espelhados do Cromos. */}
          {(pessoa.sede || pessoa.setor) && (
            <span className="text-[10px] font-semibold text-slate-500 truncate hidden sm:inline">
              {[pessoa.sede, pessoa.setor].filter(Boolean).join(' · ')}
            </span>
          )}

          {podeEditar && (
            /* So no hover: com 52 linhas, 104 botoes sempre visiveis viram ruido. */
            <span className="flex items-center gap-0.5 ml-auto shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition no-print">
              <button onClick={() => abrirEdicao(pessoa as Funcionario)} aria-label={`Editar ${pessoa.nome}`}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 cursor-pointer">
                <Pencil className="w-3 h-3" />
              </button>
              <button onClick={() => remover(pessoa as Funcionario)} aria-label={`Remover ${pessoa.nome}`}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:bg-rose-50 hover:text-rose-600 cursor-pointer">
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>

        {temFilhos && !recolhido && (
          <ul className="org-l">
            {no.filhos.slice(0, mostrarTodos.has(pessoa.id) ? undefined : LIMITE_VISIVEL)
              .map(f => <Caixa key={f.pessoa.id} no={f} />)}
            {no.filhos.length > LIMITE_VISIVEL && (
              /* Teto por chefe: 51 subordinados empilhados davam 2.695px de
                 rolagem. Mostra os primeiros e guarda o resto atras de um
                 clique, em vez de obrigar a rolar por todos sempre. */
              <li className="pl-[22px]">
                <button
                  onClick={() => setMostrarTodos(m => {
                    const novo = new Set(m);
                    novo.has(pessoa.id) ? novo.delete(pessoa.id) : novo.add(pessoa.id);
                    return novo;
                  })}
                  className="my-0.5 px-2 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer no-print"
                >
                  {mostrarTodos.has(pessoa.id)
                    ? 'Mostrar menos'
                    : `Mostrar os outros ${no.filhos.length - LIMITE_VISIVEL}`}
                </button>
              </li>
            )}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-850 flex items-center gap-2">
            <Network className="w-6 h-6 text-indigo-500" />
            Organograma
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Cadastre a pessoa e o cargo — o desenho sai do nível do cargo.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start no-print">
          <select
            value={regiaoAtiva}
            onChange={e => setRegiaoAtiva(e.target.value)}
            aria-label="Região do organograma"
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer outline-none focus:border-slate-800"
          >
            {regioes.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            onClick={imprimir}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-750 rounded-xl text-xs font-bold uppercase tracking-wider border border-slate-250 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Imprimir
          </button>
          {podeEditar && (
            <button
              onClick={abrirNovo}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-slate-900/15 transition"
            >
              <Plus className="w-4 h-4" /> Cadastrar pessoa
            </button>
          )}
        </div>
      </div>

      {ambiguidades.length > 0 && (
        /* INFORMATIVO, não pendência. Na base operacional a ambiguidade é da
           realidade — ASG e TME não têm chefe fixo, rodam na escala — e tratar
           41 pessoas como erro seria um alarme que nunca apaga. */
        <div className="bg-slate-100 border border-slate-200 rounded-2xl px-5 py-3.5 flex items-start gap-3 no-print">
          <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-700">
              {ambiguidades.length === 1
                ? '1 pessoa está ligada ao nível acima, não a um chefe específico.'
                : `${ambiguidades.length} pessoas estão ligadas ao nível acima, não a um chefe específico.`}
            </p>
            <p className="text-[11px] text-slate-600 font-semibold mt-0.5">
              O cargo delas tem mais de um superior possível{deduzidoEm ? ` — entraram sob ${deduzidoEm}` : ''}.
              Quem tiver chefe fixo, é só abrir a pessoa e apontar em “Responde a”.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {ambiguidades.slice(0, 6).map(a => (
                <button key={a.pessoa.id} onClick={() => abrirEdicao(a.pessoa as Funcionario)}
                  className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer transition">
                  {a.pessoa.nome}
                </button>
              ))}
              {ambiguidades.length > 6 && (
                <span className="px-2 py-1 text-[10px] font-bold text-slate-600">
                  +{ambiguidades.length - 6}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {semNivel.length > 0 && (
        <p className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 no-print">
          {semNivel.length === 1 ? '1 pessoa está fora do desenho' : `${semNivel.length} pessoas estão fora do desenho`}
          {' '}porque o cargo não tem nível: {semNivel.slice(0, 5).map(p => p.cargo).filter((c, i, a) => a.indexOf(c) === i).join(', ')}.
          Defina o nível em Painel Admin → Cargos.
        </p>
      )}

      {/* Cabeçalho da folha: quem olha o PDF no e-mail precisa saber de qual
          região é e de quando. Invisível na tela. */}
      <div className="print-only mb-3">
        <p className="text-sm font-bold">Organograma — {regiaoAtiva}</p>
        <p className="text-[11px]">
          {total} {total === 1 ? 'pessoa' : 'pessoas'} · {profundidade(raizes)} níveis ·
          gerado em {new Date().toLocaleDateString('pt-BR')}
        </p>
      </div>

      <div className="org-folha bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        {raizes.length === 0 ? (
          <div className="py-14 text-center">
            <Network className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-600">
              Nenhuma pessoa cadastrada em {regiaoAtiva || 'nenhuma região'}.
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              Cadastre a primeira pessoa — com o cargo já nivelado, o desenho aparece sozinho.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {regiaoAtiva} · {total} {total === 1 ? 'pessoa' : 'pessoas'} · {profundidade(raizes)} níveis
              </p>
              <div className="flex items-center gap-2 no-print">
                {podeEditar && (
                  <span className="text-[10px] font-semibold text-slate-500">
                    Arraste uma caixa sobre outra para mudar de chefe.
                  </span>
                )}
                <div className="flex items-center gap-1">
                  <button onClick={() => setZoom(z => Math.max(0.4, +(z - 0.15).toFixed(2)))}
                    aria-label="Diminuir zoom"
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-bold text-slate-600 w-10 text-center tabular-nums">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button onClick={() => setZoom(z => Math.min(1.2, +(z + 0.15).toFixed(2)))}
                    aria-label="Aumentar zoom"
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {aviso && (
              <p role="alert" className="mb-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-3.5 py-2.5 text-[11px] font-semibold">
                {aviso}
              </p>
            )}

            {/* Soltar aqui desfaz o vínculo manual — a pessoa volta à dedução
                pelo nível do cargo, sem precisar abrir o formulário. */}
            <div
              onDragOver={e => { if (arrastando) { e.preventDefault(); setSoltaLivre(true); } }}
              onDragLeave={() => setSoltaLivre(false)}
              onDrop={e => {
                e.preventDefault();
                setSoltaLivre(false);
                soltarNaRaiz(e.dataTransfer.getData('text/plain') || arrastando || '');
              }}
              className={`overflow-x-auto pb-4 rounded-xl transition ${
                soltaLivre ? 'bg-slate-100 outline-2 outline-dashed outline-slate-300' : ''
              }`}
            >
              {/* `zoom` e não `transform: scale()`: o transform encolhe o
                  desenho mas NAO a area rolavel — media 11.648px de rolagem
                  para 4.659px de conteudo visivel, e a barra sobrava vazia. */}
              <ul ref={arvoreRef} className="org-l" style={{ zoom }}>
                {raizes.map(no => <Caixa key={no.pessoa.id} no={no} />)}
              </ul>
            </div>
          </>
        )}
      </div>

      {abrindo && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div role="dialog" aria-modal="true" aria-labelledby="org-titulo"
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 id="org-titulo" className="text-sm font-bold text-slate-800">
                {editando ? `Editar ${editando.nome}` : 'Cadastrar pessoa'}
              </h3>
              <button onClick={() => setAbrindo(false)} aria-label="Fechar"
                className="w-8 h-8 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label htmlFor="org-nome" className={rotuloCls}>Nome *</label>
                <input id="org-nome" className={campoCls} value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>

              <div>
                <label htmlFor="org-cargo" className={rotuloCls}>Cargo *</label>
                <select id="org-cargo" className={campoCls} value={form.cargo}
                  onChange={e => setForm(f => ({ ...f, cargo: e.target.value, respondeA: '' }))}>
                  <option value="">Selecione…</option>
                  {cargos.filter(c => c?.nome).map(c => (
                    <option key={c.id} value={c.nome}>
                      {c.nome}{c.nivel ? ` — ${rotuloDoNivel(c.nivel)}` : ' (sem nível)'}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 font-semibold mt-1">
                  O nível vem do cargo. Cargo sem nível fica fora do desenho.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="org-sede" className={rotuloCls}>Sede *</label>
                  <select id="org-sede" className={campoCls} value={form.sede}
                    onChange={e => setForm(f => ({ ...f, sede: e.target.value, respondeA: '' }))}>
                    <option value="">Selecione…</option>
                    {sedes.map(s => <option key={s.nome} value={s.nome}>{s.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="org-setor" className={rotuloCls}>Setor</label>
                  <select id="org-setor" className={campoCls} value={form.setor}
                    onChange={e => setForm(f => ({ ...f, setor: e.target.value }))}>
                    <option value="">Sem setor</option>
                    {setores.filter(s => s?.nome).map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="org-responde" className={rotuloCls}>Responde a (opcional)</label>
                <select id="org-responde" className={campoCls} value={form.respondeA}
                  onChange={e => setForm(f => ({ ...f, respondeA: e.target.value }))}>
                  <option value="">Deixar o sistema deduzir pelo nível</option>
                  {superioresPossiveis.map(f => (
                    <option key={f.id} value={f.id}>{f.nome} — {f.cargo}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 font-semibold mt-1">
                  Só preencha para desempatar: com dois superiores do mesmo nível, o sistema não
                  tem como saber a qual deles esta pessoa responde.
                </p>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={form.ativo}
                  onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))}
                  className="w-4 h-4 accent-slate-900 cursor-pointer" />
                <span className="text-xs font-semibold text-slate-700">
                  Ativo — desmarque no desligamento para sair do desenho sem perder o histórico.
                </span>
              </label>

              {erro && (
                <p role="alert" className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-3.5 py-2.5 text-[11px] font-semibold">
                  {erro}
                </p>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setAbrindo(false)}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold rounded-xl text-slate-650 cursor-pointer">
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-bold rounded-xl text-white shadow-md cursor-pointer disabled:opacity-60">
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
