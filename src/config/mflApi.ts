// Central config for the MFL REST API.
// Server-only: reads process.env.MFL_API_TOKEN (no NEXT_PUBLIC_ prefix), so
// Next.js never inlines the token into a client bundle. Never import this
// from client ('use client') code.

export const MFL_API_BASE_URL = 'https://api.playmfl.com';

export function getMflAuthHeaders(): Record<string, string> {
  const token = process.env.MFL_API_TOKEN;
  if (!token) {
    throw new Error('MFL_API_TOKEN is not set');
  }
  return { 'X-MFL-Api-Token': token };
}
