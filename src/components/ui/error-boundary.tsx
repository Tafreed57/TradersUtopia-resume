'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 [ERROR BOUNDARY] Caught an error:', error);
    console.error('📍 [ERROR BOUNDARY] Error info:', errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to error monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      // Send to monitoring service (Sentry, LogRocket, etc.)
      console.error('Production error logged:', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    // Only redirect to home if user explicitly clicks the button
    // Don't automatically redirect on errors
    if (
      window.confirm(
        'Are you sure you want to go to the homepage? You will lose your current page.'
      )
    ) {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={this.state.error!}
            retry={this.handleRetry}
          />
        );
      }

      // Default error UI
      return (
        <div className='min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95'>
          <Card className='w-full max-w-md'>
            <CardHeader className='text-center'>
              <div className='mx-auto mb-4 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center'>
                <AlertTriangle className='w-6 h-6 text-red-600' />
              </div>
              <CardTitle className='text-xl'>Something went wrong</CardTitle>
              <CardDescription>
                We apologize for the inconvenience. An unexpected error
                occurred.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className='p-3 bg-gradient-to-r from-gray-800/80 via-gray-700/80 to-gray-800/80 backdrop-blur-sm rounded-lg border border-gray-600/30'>
                  <p className='text-sm font-mono text-red-600'>
                    {this.state.error.message}
                  </p>
                  {this.state.error.stack && (
                    <details className='mt-2'>
                      <summary className='text-xs text-gray-600 cursor-pointer'>
                        Show stack trace
                      </summary>
                      <pre className='text-xs mt-1 text-gray-600 whitespace-pre-wrap'>
                        {this.state.error.stack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className='flex flex-col sm:flex-row gap-2'>
                <Button
                  onClick={this.handleRetry}
                  className='flex-1 flex items-center gap-2'
                  variant='default'
                >
                  <RefreshCw className='w-4 h-4' />
                  Try Again
                </Button>
                <Button
                  onClick={this.handleGoHome}
                  className='flex-1 flex items-center gap-2'
                  variant='outline'
                >
                  <Home className='w-4 h-4' />
                  Go Home
                </Button>
              </div>

              <p className='text-xs text-center text-gray-500'>
                If this problem persists, please contact support.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Note: useErrorHandler and withErrorBoundary exports have been removed as they were unused
