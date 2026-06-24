import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { RequisicaoPublica } from './components/RequisicaoPublica';
import './index.css';
import './styles/swiss.css';

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
