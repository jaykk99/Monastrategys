import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: unknown): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-10 text-center">
          <div className="text-terminal-green text-2xl font-bold mb-4 tracking-widest">
            SYSTEM FAULT
          </div>
          <p className="text-zinc-500 mb-6 max-w-md text-sm">
            The application hit an unexpected error. Your data is safe — try refreshing the page.
          </p>
          <pre className="bg-zinc-900 border border-white/10 p-4 rounded text-xs text-red-400 overflow-auto max-w-full mb-8 text-left">
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="bg-terminal-green text-black px-8 py-2.5 rounded-md font-bold text-sm hover:brightness-110 transition-all"
          >
            REFRESH
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
