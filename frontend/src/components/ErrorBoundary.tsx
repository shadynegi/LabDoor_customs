import { Component, type ReactNode } from 'react';
import { captureException } from '../lib/sentry';
import { logError } from '../lib/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError('Error Boundary caught an error:', error);
    captureException(error, { componentStack: errorInfo.componentStack });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f5e0d5 0%, #9c6649 55%, #361906 100%)',
            padding: '20px',
          }}
        >
          <div
            style={{
              maxWidth: 600,
              background: 'white',
              borderRadius: 16,
              padding: 40,
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                fontSize: 40,
              }}
            >
              ⚠️
            </div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: '#1f2937',
                marginBottom: 12,
              }}
            >
              Oops! Something went wrong
            </h1>
            <p
              style={{
                fontSize: 16,
                color: '#6b7280',
                marginBottom: 24,
                lineHeight: 1.6,
              }}
            >
              We encountered an unexpected error. Don't worry, your cart is safe.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 24,
                  textAlign: 'left',
                }}
              >
                <p
                  style={{
                    fontSize: 14,
                    color: '#991b1b',
                    fontFamily: 'monospace',
                    margin: 0,
                    wordBreak: 'break-word',
                  }}
                >
                  {this.state.error.toString()}
                </p>
              </div>
            )}
            <button
              onClick={this.handleReset}
              style={{
                padding: '14px 28px',
                background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = 'translateY(-2px)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = 'translateY(0)')
              }
            >
              Return to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

