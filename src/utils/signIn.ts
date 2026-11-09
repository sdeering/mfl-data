/** The app name a wallet signs an account proof for, the same on the page and the server */
export const APP_IDENTIFIER = 'MFL Data';

/** The message a wallet signs when it gives no account proof, as hex; the one-time code ties it to this login */
export const signInMessage = (nonce: string) =>
  Array.from(new TextEncoder().encode(`Sign in to MFL Data: ${nonce}`), byte => byte.toString(16).padStart(2, '0')).join('');
