import { Router, type Request, type Response, type NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { getService } from '../config.js';

export const proxyRouter = Router();

/**
 * Universal reverse-proxy target.
 * GET /ctrl/proxy/:id/*  → forwards to that service's port.
 */
proxyRouter.use(
  '/:id',
  (req: Request, res: Response, next: NextFunction) => {
    const svc = getService(req.params.id);
    if (!svc || svc.port === null) {
      res.status(404).json({ error: `no proxy target for service ${req.params.id}` });
      return;
    }
    next();
  },
  createProxyMiddleware({
    router: (req) => {
      const id = (req as Request).params.id;
      const svc = getService(id);
      return svc?.port ? `http://127.0.0.1:${svc.port}` : 'http://127.0.0.1:1';
    },
    changeOrigin: true,
    ws: true,
    on: {
      error: (err, _req, res) => {
        const w = res as unknown as { writeHead?: (n: number) => void; end?: (s: string) => void };
        if (typeof w.writeHead === 'function') w.writeHead(502);
        if (typeof w.end === 'function') w.end(`Proxy error: ${err.message}`);
      },
    },
  }) as unknown as RequestHandler,
);

// Re-export for cleaner typing of the cast above.
type RequestHandler = (req: Request, res: Response, next: NextFunction) => void;