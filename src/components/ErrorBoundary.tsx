import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorDetails = null;
      try {
        if (this.state.error?.message) {
          errorDetails = JSON.parse(this.state.error.message);
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl p-8 max-w-lg w-full border border-red-100">
            <div className="bg-red-50 w-16 h-16 rounded-2xl flex items-center justify-center text-red-600 mb-6">
              <AlertTriangle size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-gray-600 mb-4 font-medium">
              {errorDetails 
                ? (errorDetails.error?.includes('offline') 
                    ? "The database is currently unreachable. This often happens if the Firestore database wasn't fully provisioned or there's a connectivity issue."
                    : `A database error occurred during ${errorDetails.operationType} on ${errorDetails.path}.`)
                : (this.state.error?.message || "An unexpected error occurred. Please try refreshing the page.")}
            </p>
            
            {errorDetails ? (
              <div className="bg-gray-50 rounded-2xl p-6 mb-6 overflow-auto max-h-60 border border-gray-100 shadow-inner">
                <p className="text-xs font-mono text-gray-600 whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(errorDetails, null, 2)}
                </p>
              </div>
            ) : this.state.error ? (
              <div className="bg-red-50 rounded-2xl p-4 mb-6 overflow-auto max-h-60 border border-red-100 shadow-inner text-left">
                <p className="text-xs font-mono font-bold text-red-800 mb-1">
                  {this.state.error.name}: {this.state.error.message}
                </p>
                {this.state.error.stack && (
                  <pre className="text-[10px] font-mono text-red-600 whitespace-pre-wrap leading-tight mt-2 opacity-80">
                    {this.state.error.stack}
                  </pre>
                )}
              </div>
            ) : (
              <div className="bg-amber-50 p-4 rounded-2xl mb-6 border border-amber-100">
                <p className="text-xs text-amber-700 leading-relaxed font-medium">
                  Tip: If this is a new app, please ensure you've accepted all terms in the Firebase Setup UI from the sidebar menu.
                </p>
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCcw size={20} />
              Refresh Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
