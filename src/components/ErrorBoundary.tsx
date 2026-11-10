import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  locationKey?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  locationKey?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, locationKey: props.locationKey };
  }

  static getDerivedStateFromError(error: Error): Partial<State> | null {
    // Suppress Chrome DOM reconciliation errors (removeChild/insertBefore)
    if (error.message?.includes("removeChild") || error.message?.includes("insertBefore")) {
      console.warn("Suppressed DOM reconciliation error:", error.message);
      return null;
    }
    return { hasError: true, error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    // Reset error state when route changes
    if (props.locationKey !== state.locationKey) {
      return { hasError: false, error: null, locationKey: props.locationKey };
    }
    return null;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="text-center max-w-md space-y-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Algo deu errado</h2>
            <p className="text-muted-foreground text-sm">
              Ocorreu um erro inesperado. Tente recarregar a página.
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => window.location.reload()}>
                Recarregar Página
              </Button>
              <Button variant="outline" onClick={() => { this.setState({ hasError: false, error: null }); }}>
                Tentar Novamente
              </Button>
            </div>
            {this.state.error && (
              <details className="text-xs text-muted-foreground mt-4">
                <summary>Detalhes do erro</summary>
                <pre className="mt-2 text-left bg-muted p-2 rounded overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}