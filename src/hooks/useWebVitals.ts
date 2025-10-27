import { useEffect } from 'react';

interface WebVitalsMetric {
  name: string;
  value: number;
  id: string;
  delta: number;
}

export const useWebVitals = (onMetric?: (metric: WebVitalsMetric) => void) => {
  useEffect(() => {
    // Measure Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      const metric: WebVitalsMetric = {
        name: 'LCP',
        value: lastEntry.startTime,
        id: 'lcp-' + Date.now(),
        delta: lastEntry.startTime
      };
      
      if (onMetric) {
        onMetric(metric);
      } else {
        console.log('LCP:', metric.value);
      }
    });

    try {
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      // LCP not supported
    }

    // Measure First Input Delay (FID)
    const fidObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach((entry: any) => {
        const metric: WebVitalsMetric = {
          name: 'FID',
          value: entry.processingStart - entry.startTime,
          id: 'fid-' + Date.now(),
          delta: entry.processingStart - entry.startTime
        };
        
        if (onMetric) {
          onMetric(metric);
        } else {
          console.log('FID:', metric.value);
        }
      });
    });

    try {
      fidObserver.observe({ entryTypes: ['first-input'] });
    } catch (e) {
      // FID not supported
    }

    // Measure Cumulative Layout Shift (CLS)
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          const metric: WebVitalsMetric = {
            name: 'CLS',
            value: clsValue,
            id: 'cls-' + Date.now(),
            delta: entry.value
          };
          
          if (onMetric) {
            onMetric(metric);
          } else {
            console.log('CLS:', metric.value);
          }
        }
      });
    });

    try {
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      // CLS not supported
    }

    return () => {
      lcpObserver.disconnect();
      fidObserver.disconnect();
      clsObserver.disconnect();
    };
  }, [onMetric]);
};