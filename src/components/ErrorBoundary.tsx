import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { logError } from "@/lib/telemetry";
import { AlertTriangle } from "lucide-react";

interface State { hasError: boolean; message?: string }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    logError(error.message, error.stack, { componentStack: info.componentStack });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground break-words">
            {this.state.message ?? "Unexpected error"}
          </p>
          <Button onClick={() => window.location.assign("/")}>Back to home</Button>
        </div>
      </div>
    );
  }
}