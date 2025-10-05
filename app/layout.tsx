import type { Metadata, Viewport } from 'next';
import { Titillium_Web } from 'next/font/google';
import './globals.css';
import ThemeProviderWrapper from '../src/components/ThemeProviderWrapper';
import Header from '../src/components/Header';
import Footer from '../src/components/Footer';
import { LoadingProvider } from '../src/contexts/LoadingContext';
import { WalletProvider } from '../src/contexts/WalletContext';
import { SupabaseSyncProvider } from '../src/components/SupabaseSyncProvider';

const titilliumWeb = Titillium_Web({ 
  subsets: ['latin'],
  weight: ['200', '300', '400', '600', '700', '900'],
  variable: '--font-titillium-web'
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1f2937' },
  ],
};

export const metadata: Metadata = {
  title: 'MFL Data',
  description: 'MFL Player Search Tool',
  keywords: ['MFL', '@playMFL', 'Metaverse', 'Football', 'league', 'football', 'calculator', 'player', 'ratings'],
  authors: [{ name: 'DogeSports' }],
  creator: 'DogeSports',
  publisher: 'DogeSports',
  applicationName: 'MFL Data',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
      { url: 'https://mflplayer.info/icon.png?9513720e6414b231', sizes: '1647x1444', type: 'image/png' },
      { url: 'https://mflplayer.info/icon0.svg?ccb46ac2bafe8a38', sizes: 'any', type: 'image/svg+xml' },
      { url: 'https://mflplayer.info/icon1.png?2a8ae5c5b762ebe8', sizes: '96x96', type: 'image/png' },
    ],
    apple: [
      { url: 'https://mflplayer.info/apple-icon.png?86b913e9c98b194e', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'MFL Data',
    description: 'MFL Player Search Tool',
    type: 'website',
    url: 'https://mfldata.com',
    siteName: 'MFL Data',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MFL Data',
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
    <html lang="en" suppressHydrationWarning className={titilliumWeb.variable}>
      <head>
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
      <body className={`${titilliumWeb.className} min-h-screen transition-colors duration-300 bg-[#f6f6f6] dark:bg-[#111827]`}>
        <ThemeProviderWrapper>
          <WalletProvider>
            <LoadingProvider>
              <SupabaseSyncProvider>
                <div className="max-w-[1240px] mx-auto">
                  <Header />
                  <div className="px-[30px] max-[412px]:px-[15px] bg-white dark:bg-[#111827] min-h-[calc(100vh-0px)]">
                    {children}
                  </div>
                  <Footer />
                </div>
              </SupabaseSyncProvider>
            </LoadingProvider>
          </WalletProvider>
        </ThemeProviderWrapper>
      </body>
    </html>
  );
}
