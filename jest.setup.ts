import '@testing-library/jest-dom';

// Fake MFL API token so server-side code paths under test don't throw
// on a missing env var; never a real credential.
process.env.MFL_API_TOKEN ||= 'test-mfl-api-token';

// Polyfill for TextEncoder/TextDecoder in Node.js environment
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// Polyfill for fetch in Node.js environment
import fetch from 'node-fetch';
global.fetch = fetch as any;



