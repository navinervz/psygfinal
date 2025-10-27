import { useEffect } from 'react';

interface SEOData {
  title: string;
  description: string;
  keywords?: string[];
  ogImage?: string;
  canonicalUrl?: string;
  structuredData?: object;
}

export const useSEO = (seoData: SEOData) => {
  useEffect(() => {
    // Update document title
    document.title = seoData.title;

    // Update meta description
    updateMetaTag('description', seoData.description);

    // Update keywords if provided
    if (seoData.keywords) {
      updateMetaTag('keywords', seoData.keywords.join(', '));
    }

    // Update Open Graph tags
    updateMetaProperty('og:title', seoData.title);
    updateMetaProperty('og:description', seoData.description);
    updateMetaProperty('og:url', window.location.href);
    
    if (seoData.ogImage) {
      updateMetaProperty('og:image', seoData.ogImage);
    }

    // Update Twitter Card tags
    updateMetaProperty('twitter:title', seoData.title);
    updateMetaProperty('twitter:description', seoData.description);
    
    if (seoData.ogImage) {
      updateMetaProperty('twitter:image', seoData.ogImage);
    }

    // Update canonical URL
    if (seoData.canonicalUrl) {
      updateCanonicalUrl(seoData.canonicalUrl);
    }

    // Add structured data
    if (seoData.structuredData) {
      addStructuredData(seoData.structuredData);
    }

    // Cleanup function
    return () => {
      // Reset to default title
      document.title = 'فروشگاه سای جی | مرجع خرید آسان سرویس‌های آنلاین';
    };
  }, [seoData]);
};

const updateMetaTag = (name: string, content: string) => {
  let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = name;
    document.head.appendChild(meta);
  }
  meta.content = content;
};

const updateMetaProperty = (property: string, content: string) => {
  let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('property', property);
    document.head.appendChild(meta);
  }
  meta.content = content;
};

const updateCanonicalUrl = (url: string) => {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = url;
};

const addStructuredData = (data: object) => {
  // Remove existing structured data
  const existingScript = document.querySelector('script[type="application/ld+json"][data-dynamic]');
  if (existingScript) {
    existingScript.remove();
  }

  // Add new structured data
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-dynamic', 'true');
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
};