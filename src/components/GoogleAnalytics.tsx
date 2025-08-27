'use client';

import Script from 'next/script';

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

export default function GoogleAnalytics() {
  const GA_MEASUREMENT_ID = 'G-RMQQLQJKZZ';

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){window.dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `,
        }}
      />
    </>
  );
}
