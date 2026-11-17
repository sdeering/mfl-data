/**
 * @jest-environment node
 */
import { getSelfBaseUrl } from '../lib/serverBaseUrl';

const KEYS = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SITE_URL',
  'VERCEL_ENV',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'VERCEL_URL',
  'PORT',
] as const;

describe('getSelfBaseUrl (server)', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('prefers an explicit app URL, without a trailing slash', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com/';
    process.env.VERCEL_ENV = 'production';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'mfldata.com';
    expect(getSelfBaseUrl()).toBe('https://example.com');
  });

  it('uses the public production domain on Vercel production, not the protected deployment URL', () => {
    process.env.VERCEL_ENV = 'production';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'mfldata.com';
    process.env.VERCEL_URL = 'mfl-player-search-abc123.vercel.app';
    expect(getSelfBaseUrl()).toBe('https://mfldata.com');
  });

  it('uses the deployment URL on previews', () => {
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'mfldata.com';
    process.env.VERCEL_URL = 'mfl-player-search-abc123.vercel.app';
    expect(getSelfBaseUrl()).toBe('https://mfl-player-search-abc123.vercel.app');
  });

  it('falls back to the local dev server', () => {
    expect(getSelfBaseUrl()).toBe('http://localhost:3000');
    process.env.PORT = '3100';
    expect(getSelfBaseUrl()).toBe('http://localhost:3100');
  });
});
