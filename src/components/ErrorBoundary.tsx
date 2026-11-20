import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Erro inesperado ao carregar o portal.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('Portal ErrorBoundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#050705] p-6 text-[#F1F3EC]">
          <div className="w-full max-w-lg border border-[#263F24] bg-[#0B100C] p-8">
            <div className="mb-4 flex items-center gap-3 text-[#D62828]">
              <AlertTriangle className="h-6 w-6" />
              <h1 className="font-display text-2xl font-bold text-[#F1F3EC]">
                Interrupção de Execução — 1.F.M.O.T
              </h1>
            </div>
            <p className="mb-6 text-sm leading-relaxed text-[#A5AAA2]">
              Ocorreu uma falha de comunicação ou permissão ao processar esta operação no portal.
              Recarregue a interface para restabelecer a sessão.
            </p>
            <pre className="mb-6 max-h-32 overflow-auto border border-[#263F24]/60 bg-[#050705] p-3 font-mono text-xs text-[#A5AAA2]">
              {this.state.errorMessage}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 bg-[#263F24] px-5 py-2.5 text-xs font-semibold text-[#F1F3EC] transition-colors hover:bg-[#526B32]"
            >
              <RotateCcw className="h-4 w-4" />
              Recarregar Portal
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
