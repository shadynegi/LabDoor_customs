import { Link } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
  title?: string;
}

export default function RouteErrorBoundary({ children, title = 'Something went wrong' }: RouteErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        <div
          style={{
            minHeight: '50vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: 22, marginBottom: 12 }}>{title}</h2>
          <p style={{ color: '#6b7280', marginBottom: 20 }}>
            This page encountered an error. You can try again or go back.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 20px',
                background: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                minHeight: 44,
              }}
            >
              Retry
            </button>
            <Link
              to="/"
              style={{
                padding: '12px 20px',
                background: '#f3f4f6',
                color: '#111',
                borderRadius: 8,
                textDecoration: 'none',
                minHeight: 44,
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              Go home
            </Link>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
