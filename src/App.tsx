import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ShoppingCartProvider } from './context/ShoppingCartContext';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { Web3Provider } from './components/Web3Provider';
import ErrorBoundary from './components/ErrorBoundary';
import Background from './components/Background';
import { useWebVitals } from './hooks/useWebVitals';

// Lazy load pages for code splitting
const HomePage = lazy(() => import('./pages/HomePage'));
const ArticlesPage = lazy(() => import('./pages/ArticlesPage'));
const ArticleDetailPage = lazy(() => import('./pages/ArticleDetailPage'));
const FAQPage = lazy(() => import('./pages/FAQPage'));

function App() {
  // Monitor Web Vitals
  useWebVitals((metric) => {
    // In production, send to analytics service
    console.log('Web Vital:', metric);
  });

  return (
    <ErrorBoundary>
      <Web3Provider>
        <NotificationProvider>
          <AuthProvider>
            <ShoppingCartProvider>
              <Router>
                <Background />
                <Suspense fallback={null}>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/articles" element={<ArticlesPage />} />
                    <Route path="/articles/:slug" element={<ArticleDetailPage />} />
                    <Route path="/faq" element={<FAQPage />} />
                    <Route path="*" element={<HomePage />} />
                  </Routes>
                </Suspense>
              </Router>
            </ShoppingCartProvider>
          </AuthProvider>
        </NotificationProvider>
      </Web3Provider>
    </ErrorBoundary>
  );
}

export default App;