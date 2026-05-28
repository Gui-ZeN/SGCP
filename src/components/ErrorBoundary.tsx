import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    // @ts-ignore
    this.setState({
      error,
      errorInfo
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 m-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <h1 className="font-bold text-lg mb-2">Something went wrong.</h1>
          <p className="font-mono text-sm">{this.state.error && this.state.error.toString()}</p>
          <pre className="mt-2 text-xs overflow-auto max-h-64 whitespace-pre-wrap">
            {this.state.errorInfo?.componentStack}
          </pre>
        </div>
      );
    }

    // @ts-ignore
    return this.props.children;
  }
}
