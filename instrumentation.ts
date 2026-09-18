// Runs once when the Next.js server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Node tries each address of a host for only 250ms before moving on to the next, and fails the
  // request with ETIMEDOUT ("fetch failed") once it has run out. From far away a connection to the
  // MFL API takes longer than that to open (270ms-1.3s measured from Australia), so every attempt
  // was abandoned before it could finish. Give each address long enough to answer.
  const net = await import('node:net');
  net.setDefaultAutoSelectFamilyAttemptTimeout(2000);
}
