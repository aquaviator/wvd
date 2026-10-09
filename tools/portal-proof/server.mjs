import {createServer} from 'node:http';
import {createPortalHandler} from './http.mjs';

// Explicit construction only. No automatic listen or fallback session identity.
export function createPortalServer(options) {
  const handler = createPortalHandler(options);
  const server = createServer({maxHeaderSize:16384},handler);
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.maxRequestsPerSocket = 100;
  return server;
}
