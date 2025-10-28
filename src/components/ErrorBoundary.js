import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container">
          <div className="card">
            <h2>Something went wrong</h2>
            <p>An unexpected error occurred. Please try refreshing the page.</p>
            <button 
              className="btn" 
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </button>
            <button 
              className="btn btn-danger" 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              style={{ marginLeft: '1rem' }}
            >
              Clear Data & Refresh
            </button>
            {process.env.NODE_ENV === 'development' && (
              <details style={{ marginTop: '1rem' }}>
                <summary>Error Details (Development)</summary>
                <pre style={{ background: '#f8f9fa', padding: '1rem', marginTop: '0.5rem' }}>
                  {this.state.error?.toString()}
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

export default ErrorBoundary;