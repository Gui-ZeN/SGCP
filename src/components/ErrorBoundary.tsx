import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ehErroDeChunk, recarregarUmaVez } from '../lib/lazyComRetry';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  recarregando: boolean;
}

/**
 * Rede de segurança da UI: em vez de tela branca, mostra uma mensagem amigável.
 * Se o erro for de chunk sumido (deploy novo trocou os hashes), recarrega sozinho.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    recarregando: false
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Erro capturado pelo ErrorBoundary:', error, errorInfo);
    // Deploy novo derrubou o chunk → recarrega sozinho (uma vez).
    if (ehErroDeChunk(error) && recarregarUmaVez()) {
      // @ts-ignore — tipos do React neste projeto não expõem setState na classe
      this.setState({ recarregando: true });
      return;
    }
    // @ts-ignore
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      if (this.state.recarregando) {
        return (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center animate-pulse font-black">
              SG
            </div>
            <p className="text-sm font-bold text-slate-700">Nova versão disponível — atualizando…</p>
          </div>
        );
      }

      const ehChunk = ehErroDeChunk(this.state.error);
      return (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center text-xl">
            !
          </div>
          <h2 className="text-base font-extrabold text-slate-800">
            {ehChunk ? 'O sistema foi atualizado' : 'Algo deu errado nesta tela'}
          </h2>
          <p className="text-sm text-slate-500 font-medium max-w-md">
            {ehChunk
              ? 'Saiu uma versão nova enquanto você estava com o sistema aberto. Recarregue para continuar.'
              : 'Recarregue a página para continuar. Se o erro persistir, avise o time de BI.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-1 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer shadow-md transition"
          >
            Recarregar página
          </button>
          {/* Detalhe técnico discreto — ajuda o BI sem assustar o usuário. */}
          {this.state.error && (
            <details className="mt-3 max-w-lg w-full text-left">
              <summary className="text-[11px] text-slate-400 font-semibold cursor-pointer">Detalhes técnicos</summary>
              <pre className="mt-2 text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3 overflow-auto max-h-48 whitespace-pre-wrap">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    // @ts-ignore
    return <>{this.props.children}</>;
  }
}
