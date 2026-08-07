import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return { hasError: true, message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4 text-center">
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">
              Something went wrong
            </h2>
            <p className="text-sm text-white/50 max-w-sm">{this.state.message}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Reload page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
