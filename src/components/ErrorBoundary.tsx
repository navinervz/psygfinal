import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log error to monitoring service
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // In production, send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { extra: errorInfo });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
          <div className="max-w-md w-full bg-black/40 backdrop-blur-xl rounded-2xl border border-red-500/30 p-8 text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            
            <h2 className="text-xl font-bold text-red-400 mb-4">
              خطایی رخ داده است
            </h2>
            
            <p className="text-gray-300 mb-6 leading-relaxed">
              متأسفانه مشکلی در نمایش این بخش رخ داده است. لطفاً صفحه را مجدداً بارگذاری کنید یا با پشتیبانی تماس بگیرید.
            </p>

            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full bg-gradient-to-r from-[#004d00] to-[#39ff14] text-black py-3 px-4 rounded-lg font-bold hover:shadow-[0_0_15px_rgba(57,255,20,0.4)] transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                تلاش مجدد
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-black/40 border border-[#39ff14]/30 text-[#39ff14] py-3 px-4 rounded-lg hover:bg-[#39ff14]/10 transition-all"
              >
                بارگذاری مجدد صفحه
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-gray-400 text-sm mb-2">
                  جزئیات خطا (فقط در حالت توسعه)
                </summary>
                <pre className="bg-red-900/20 border border-red-500/30 rounded p-3 text-xs text-red-300 overflow-auto max-h-40">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
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