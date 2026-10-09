import { useState, type ComponentType } from 'react';
import { X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { LogoSGPC } from './LogoSGPC';

/**
 * Menu lateral da casca nova (rework 10/2026). Os estilos moram em
 * `styles/casca.css`, fora do alcance do `swiss.css`: o menu é o primeiro pedaço
 * que já nasce no visual novo, e as telas antigas continuam dentro dele até
 * migrarem. A campanha (Outubro Rosa…) pinta SÓ o menu e o selo do logo.
 */
export interface ItemMenu {
  id: string;
  rotulo: string;
  Icone: ComponentType<{ className?: string }>;
  grupo: string;
  /** Número no canto do item (vagas atrasadas, requisições pendentes). */
  badge?: number;
  badgeTitulo?: string;
}

interface Props {
  itens: ItemMenu[];
  ativo: string;
  irPara: (id: string) => void;
  /** Gaveta abaixo de `lg`. */
  aberto: boolean;
  fechar: () => void;
  usuario: { nome: string; foto?: string | null; papel: string; sede: string } | null;
  sair: () => void;
  conectado: boolean;
  campanha?: { nome: string } | null;
}

/** Preferência de cada pessoa: menu recolhido (só ícones) ou aberto, no computador. */
const CHAVE_RECOLHIDO = 'sgpc_menu_recolhido';
function lerRecolhido(): boolean {
  try {
    const salvo = localStorage.getItem(CHAVE_RECOLHIDO);
    if (salvo !== null) return salvo === '1';
  } catch { /* sem localStorage: segue o padrão */ }
  // Padrão: recolhido em notebook (1366×768 e afins), aberto em monitor grande.
  return typeof window !== 'undefined' && window.innerWidth < 1440;
}

export function MenuLateral({ itens, ativo, irPara, aberto, fechar, usuario, sair, conectado, campanha }: Props) {
  // Recolhido = só os ícones; passar o mouse (ou o foco do teclado) abre por
  // cima do conteúdo, sem empurrar a tela. Abaixo de lg o menu é gaveta e isto não vale.
  const [recolhido, setRecolhido] = useState(lerRecolhido);
  const alternarRecolhido = () => setRecolhido(r => {
    try { localStorage.setItem(CHAVE_RECOLHIDO, r ? '0' : '1'); } catch { /* ignora */ }
    return !r;
  });
  const grupos = itens.reduce<{ nome: string; itens: ItemMenu[] }[]>((acc, item) => {
    const ultimo = acc[acc.length - 1];
    if (ultimo && ultimo.nome === item.grupo) ultimo.itens.push(item);
    else acc.push({ nome: item.grupo, itens: [item] });
    return acc;
  }, []);

  return (
    <>
      {aberto && <div className="casca-veu" onClick={fechar} aria-hidden="true" />}
      {recolhido && <div className="casca-espaco" aria-hidden="true" />}
      <nav id="menu-principal" aria-label="Navegação principal" className={`casca-menu no-print${aberto ? ' aberto' : ''}${recolhido ? ' recolhido' : ''}`}>
        {/* Topo: logo, nome (ou a campanha do mês) e o botão de recolher. Tudo que
            dava para tirar do rodapé subiu para cá: o menu precisa caber num
            notebook 1366×768 sem rolar (pedido do Guilherme, 08/10/2026). */}
        <div className="casca-marca">
          <LogoSGPC className="casca-logo" />
          <div>
            <strong>SGPC</strong>
            {campanha
              ? <small className="casca-campanha"><svg width="11" height="14" viewBox="0 0 18 22" aria-hidden="true"><path d="M9 9C6 5 4 2 6.5 1S12 2 9 9Zm0 0c-3 4-6 9-5 12m5-12c3 4 6 9 5 12" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>{campanha.nome}</small>
              : <small>Gestão de Pessoas Christus</small>}
          </div>
          <button type="button" className="casca-alternar" onClick={alternarRecolhido} aria-pressed={recolhido}
            aria-label={recolhido ? 'Deixar o menu sempre aberto' : 'Recolher o menu e mostrar só os ícones'}
            title={recolhido ? 'Deixar o menu sempre aberto' : 'Recolher o menu (só os ícones)'}>
            {recolhido ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
          </button>
          <button type="button" className="casca-fechar" onClick={fechar} aria-label="Fechar menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="casca-lista">
          {grupos.map((g, i) => (
            <div key={`${g.nome}-${i}`} className="casca-grupo" role="group" aria-label={g.nome || undefined}>
              {g.nome && <h2>{g.nome}</h2>}
              {g.itens.map(item => (
                <a
                  key={item.id}
                  href={`#/${item.id}`}
                  aria-current={ativo === item.id ? 'page' : undefined}
                  onClick={e => { e.preventDefault(); irPara(item.id); fechar(); }}
                >
                  <item.Icone className="casca-icone" aria-hidden="true" />
                  <span>{item.rotulo}</span>
                  {!!item.badge && <em title={item.badgeTitulo}>{item.badge}</em>}
                </a>
              ))}
            </div>
          ))}
        </div>

        {/* Rodapé: só quem está usando. A conexão é a bolinha no avatar. */}
        {usuario && (
          <div className="casca-rodape">
            <div className="casca-usuario">
              <span className="casca-avatar-moldura" title={conectado ? 'Conectado' : 'Modo local: não está sincronizando'}>
                {usuario.foto
                  ? <img src={usuario.foto} alt="" width={28} height={28} loading="lazy" />
                  : <span className="casca-avatar" aria-hidden="true">{usuario.nome.charAt(0)}</span>}
                <i className={conectado ? 'ok' : ''} aria-label={conectado ? 'Conectado' : 'Modo local, sem sincronizar'} role="img" />
              </span>
              <div>
                <strong>{usuario.nome}</strong>
                <small>{usuario.papel} · {usuario.sede}</small>
              </div>
              <button type="button" onClick={sair}>Sair</button>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
