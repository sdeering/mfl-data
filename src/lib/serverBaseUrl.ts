// Base URL for calls this app makes to its own API routes.
// In the browser it is '' (relative URLs). On the server it has to be absolute:
// an explicit NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_SITE_URL wins; on Vercel
// production it is the public production domain (the per-deployment
// VERCEL_URL sits behind deployment protection, so self-calls to it fail);
// otherwise the deployment URL, or the local dev server.
export function getSelfBaseUrl(): string {
  if (typeof window !== 'undefined') return '';

  const explicit = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');

  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  return `http://localhost:${process.env.PORT || 3000}`;
}
