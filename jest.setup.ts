import '@testing-library/jest-dom';

// Polyfill for TextEncoder/TextDecoder in Node.js environment
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// Polyfill for fetch in Node.js environment
import fetch from 'node-fetch';
global.fetch = fetch as any;



