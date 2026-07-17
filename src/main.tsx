import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { RequisicaoPublica } from './components/RequisicaoPublica';
import { recarregarUmaVez } from './lib/lazyComRetry';
import './index.css';
import './styles/swiss.css';

// Deploy novo troca o hash dos chunks; quem está com a aba antiga aberta recebe
// 404 ao abrir uma seção lazy. O Vite avisa aqui quando o PRELOAD falha (antes
// mesmo do import()) — recarregamos uma vez para pegar o index.html novo.
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault(); // sem isso o Vite lança e derruba a árvore (tela branca)
    recarregarUmaVez();
  });
}

// Rota pública do formulário de requisição (fora do app, sem login).
// Aceita /requisicao (rewrite no vercel.json) ou #requisicao (fallback sem config).
const path = (typeof window !== 'undefined' ? window.location.pathname : '').replace(/\/+$/, '');
const isRequisicao = path.endsWith('/requisicao') ||
  (typeof window !== 'undefined' && window.location.hash.toLowerCase().includes('requisicao'));

// Tema único (Suíço) aplicado já no boot do app — o formulário público fica neutro.
if (!isRequisicao && typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', 'swiss');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isRequisicao ? <RequisicaoPublica /> : <App />}
  </StrictMode>,
);
