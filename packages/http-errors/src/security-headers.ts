import type { Express } from 'express';
import helmet from 'helmet';

/**
 * Common security headers for JSON APIs. CSP disabled (not a browser document app).
 */
export const applySecurityHeaders = (app: Express): void => {
  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );
};
