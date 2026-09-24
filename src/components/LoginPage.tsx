import { LogoSGPC } from './LogoSGPC';
import React, { useState } from 'react';

/**
 * Tela de entrada — refeita em 24/09/2026 no tema Suíço (DESIGN.md, "A
 * Prancheta do RH"). Antes: órbita animada de módulos, orbs desfocados e
 * selos em caixa alta. Agora: à esquerda um cartaz tipográfico com o que o
 * sistema é e o índice real dos módulos; à direita, só a tarefa de entrar.
 * O módulo "Assistente IA" saiu da vitrine: não existe no sistema.
 */
interface LoginPageProps {
  onLogin: () => Promise<void>;
  isFirebaseEnabled: boolean;
  onSimulatedLogin: (email: string, name: string) => void;
}

const MODULOS: { nome: string; o: string }[] = [
  { nome: 'Quadro de Vagas', o: 'da requisição ao aprovado' },
  { nome: 'Seleções', o: 'convocados, candidatos e resultado' },
  { nome: 'Resumo do Dia', o: 'o relato das 18h à diretoria' },
  { nome: 'Indicadores', o: 'vagas, seleções, pessoas e clima' },
  { nome: 'Experiência', o: 'avaliações de 45 e 90 dias' },
  { nome: 'Treinamentos', o: 'turmas, presença e investimento' },
  { nome: 'Desligamentos', o: 'entrevistas de saída' },
  { nome: 'Turnover', o: 'entradas e saídas do mês' },
];

const GoogleG = () => (
  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </svg>
);

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, isFirebaseEnabled, onSimulatedLogin }) => {
  const [entrando, setEntrando] = useState(false);

  const entrar = async () => {
    setEntrando(true);
    try {
      if (isFirebaseEnabled) {
        await onLogin();
      } else {
        // Sem Firebase (ambiente de demonstração): entra com um usuário simulado.
        await new Promise(resolve => setTimeout(resolve, 600));
        onSimulatedLogin('guizen2006@gmail.com', 'Guilherme Zen');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEntrando(false);
    }
  };

  return (
    <main className="min-h-screen grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] bg-slate-50">
      {/* Cartaz: o que o sistema é, sem vitrine. Só em telas largas. */}
      <section aria-label="Sobre o SGPC" className="hidden lg:flex flex-col justify-between gap-12 bg-white border-r border-slate-200 px-12 xl:px-16 py-12">
        <div className="flex items-center gap-3">
          <LogoSGPC className="w-10 h-10" />
          <div className="leading-tight">
            <p className="text-sm font-bold text-slate-900">SGPC</p>
            <p className="text-xs font-medium text-slate-600">Sistema de Gestão de Pessoas Christus</p>
          </div>
        </div>

        <div className="max-w-2xl">
          <h2 className="text-[56px] xl:text-[72px] leading-[0.98] font-bold tracking-[-0.03em] text-slate-900 [text-wrap:balance]">
            Vagas, seleções e pessoas, <span className="text-indigo-700">num lugar só.</span>
          </h2>
          <p className="mt-6 text-base font-medium text-slate-600 max-w-md leading-relaxed">
            O dia a dia do RH do Grupo Christus, do pedido do gestor ao relatório da diretoria.
          </p>

          <ul className="mt-12 grid grid-cols-2 gap-x-10 border-t border-slate-200">
            {MODULOS.map(m => (
              <li key={m.nome} className="py-3 border-b border-slate-200">
                <p className="text-sm font-semibold text-slate-900">{m.nome}</p>
                <p className="text-xs font-medium text-slate-500 mt-0.5">{m.o}</p>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs font-medium text-slate-500">Grupo Christus · Fortaleza, CE</p>
      </section>

      {/* A tarefa: entrar. */}
      <section className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-[360px]">
          <div className="flex lg:hidden items-center gap-3 mb-12">
            <LogoSGPC className="w-10 h-10" />
            <div className="leading-tight">
              <p className="text-sm font-bold text-slate-900">SGPC</p>
              <p className="text-xs font-medium text-slate-600">Sistema de Gestão de Pessoas Christus</p>
            </div>
          </div>

          <h1 className="text-[28px] leading-tight font-bold tracking-tight text-slate-900">Entrar</h1>
          <p className="mt-2 text-sm font-medium text-slate-600 leading-relaxed">
            Use a sua conta Google do trabalho.
          </p>

          <button
            type="button"
            onClick={entrar}
            disabled={entrando}
            aria-busy={entrando}
            className="mt-8 w-full inline-flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold cursor-pointer transition-colors disabled:opacity-70 disabled:cursor-wait"
          >
            <span className="w-7 h-7 -my-1 rounded bg-white flex items-center justify-center shrink-0">
              {entrando
                ? <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" aria-hidden="true" />
                : <GoogleG />}
            </span>
            {entrando ? 'Entrando…' : 'Entrar com Google'}
          </button>

          <p className="mt-6 pt-6 border-t border-slate-200 text-xs font-medium text-slate-600 leading-relaxed">
            O acesso é liberado pelo RH. Se o seu e-mail ainda não estiver cadastrado, fale com a coordenação do RH.
          </p>

          {!isFirebaseEnabled && (
            <p role="status" className="mt-4 text-xs font-semibold text-amber-700">
              Ambiente de demonstração: sem banco conectado, você entra com um usuário de teste.
            </p>
          )}
        </div>
      </section>
    </main>
  );
};
