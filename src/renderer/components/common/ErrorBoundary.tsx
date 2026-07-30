import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center bg-void-bg">
          <div className="text-center max-w-md px-8">
            <div className="text-5xl mb-4">⚠</div>
            <h2 className="text-lg font-medium text-void-text mb-2">Something went wrong</h2>
            <p className="text-sm text-void-secondary mb-4">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="rounded bg-void-accent px-4 py-2 text-sm text-white hover:bg-blue-600 transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
