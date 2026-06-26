/**
 * Error boundary with improved error display and recovery
 */

'use client';

import { ReactNode } from 'react';
import { AlertCircle, RotateCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        this.props.fallback?.(this.state.error, this.retry) || (
          <DefaultErrorFallback error={this.state.error} retry={this.retry} />
        )
      );
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
      <div className="flex items-start gap-4">
        <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-red-900 mb-1">Ein Fehler ist aufgetreten</h3>
          <p className="text-sm text-red-700 mb-4">
            {process.env.NODE_ENV === 'production'
              ? 'Bitte versuche es später erneut oder kontaktiere den Support.'
              : error.message}
          </p>
          <button
            onClick={retry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
          >
            <RotateCw className="h-4 w-4" />
            Erneut versuchen
          </button>
        </div>
      </div>
    </div>
  );
}
