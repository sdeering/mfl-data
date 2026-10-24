import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, JetBrains_Mono, Manrope } from 'next/font/google';
import './globals.css';
import ThemeProviderWrapper from '../src/components/ThemeProviderWrapper';
import Header from '../src/components/Header';
import Footer from '../src/components/Footer';
import PitchBackdrop from '../src/components/PitchBackdrop';
import { LoadingProvider } from '../src/contexts/LoadingContext';
import { WalletProvider } from '../src/contexts/WalletContext';
import { SupabaseSyncProvider } from '../src/components/SupabaseSyncProvider';

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage' });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], weight: ['500'], variable: '--font-jetbrains' });

// Puts the saved theme on <html> before the first paint, so a light-theme visitor never sees a dark flash
const themeInitScript = `try{var t=JSON.parse(localStorage.getItem('mfl-data-theme-preference'));if(t==='light'){var c=document.documentElement.classList;c.remove('dark');c.add('light');}}catch(e){}`;

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#080c0a' },
    { media: '(prefers-color-scheme: dark)', color: '#080c0a' },
  ],
};

export const metadata: Metadata = {
  title: 'MFL Data - Free PlayMFL Tools',
  description: 'MFL Player Search Tool',
  keywords: ['MFL', '@playMFL', 'Metaverse', 'Football', 'league', 'football', 'calculator', 'player', 'ratings'],
  authors: [{ name: 'DogeSports' }],
  creator: 'DogeSports',
  publisher: 'DogeSports',
  applicationName: 'MFL Data',
  manifest: '/manifest.json',
  icons: {
    // app/favicon.ico is linked automatically for browsers without SVG icons
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'MFL Data - Free PlayMFL Tools',
    description: 'MFL Player Search Tool',
    type: 'website',
    url: 'https://mfldata.com',
    siteName: 'MFL Data',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MFL Data - Free PlayMFL Tools',
    description: 'MFL Player Search Tool',
    site: '@dogesports69',
  },
  robots: {
    index: true,
    follow: true,
  },
};



export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`dark ${bricolage.variable} ${manrope.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="author" href="https://www.twitter.com/dogesports69" />
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-RMQQLQJKZZ"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-RMQQLQJKZZ');
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-canvas text-fg font-sans">
        <ThemeProviderWrapper>
          <WalletProvider>
            <LoadingProvider>
              <SupabaseSyncProvider>
                <div className="relative min-h-screen overflow-x-clip">
                  <PitchBackdrop />
                  <div className="relative">
                    <Header />
                    <main className="max-w-[1520px] mx-auto px-4 sm:px-7 pt-7 pb-20">
                      {children}
                    </main>
                    <Footer />
                  </div>
                </div>
              </SupabaseSyncProvider>
            </LoadingProvider>
          </WalletProvider>
        </ThemeProviderWrapper>
      </body>
    </html>
  );
}
