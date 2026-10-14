import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { RequisicaoPublica } from './components/RequisicaoPublica';
import { EntrevistaPublica } from './components/EntrevistaPublica';
import { recarregarUmaVez } from './lib/lazyComRetry';
import './index.css';
import './styles/swiss.css';
import './styles/casca.css';
import './styles/ui.css';

// Deploy novo troca o hash dos chunks; quem está com a aba antiga aberta recebe
// 404 ao abrir uma seção lazy. O Vite avisa aqui quando o PRELOAD falha (antes
// mesmo do import()) — recarregamos uma vez para pegar o index.html novo.
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault(); // sem isso o Vite lança e derruba a árvore (tela branca)
    recarregarUmaVez();
  });
}

// Rotas públicas (fora do app, sem login). Cada uma aceita o caminho
// (/requisicao, /entrevista — rewrites no vercel.json) ou o hash equivalente,
// que é o fallback quando o host não tem os rewrites configurados.
const path = (typeof window !== 'undefined' ? window.location.pathname : '').replace(/\/+$/, '');
const hash = typeof window !== 'undefined' ? window.location.hash.toLowerCase() : '';
// ⚠️ Hash EXATO (#entrevista ou #/entrevista), não "contém": a tela do RH vive
// em #/entrevistas, que contém "entrevista" — recarregar nela abria o
// formulário público no lugar do app (achado em 14/10/2026).
const isRequisicao = path.endsWith('/requisicao') || /^#\/?requisicao$/.test(hash);
const isEntrevista = path.endsWith('/entrevista') || /^#\/?entrevista$/.test(hash);
const isPublica = isRequisicao || isEntrevista;

// Tema único (Suíço) aplicado já no boot do app — os formulários públicos ficam neutros.
if (!isPublica && typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', 'swiss');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isRequisicao ? <RequisicaoPublica /> : isEntrevista ? <EntrevistaPublica /> : <App />}
  </StrictMode>,
);
