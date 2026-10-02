// Jest setup for every test file. Tests need no production build.
import { TextEncoder, TextDecoder } from 'node:util';

// JSDOM does not implement TextEncoder and TextDecoder
if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
}
if (!global.TextDecoder) {
  // @ts-ignore
  global.TextDecoder = TextDecoder;
}
