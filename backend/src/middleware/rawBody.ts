import { Request, Response, NextFunction } from 'express';

export function rawBody(req: Request, res: Response, next: NextFunction) {
  let data = Buffer.alloc(0);
  req.on('data', (chunk) => (data = Buffer.concat([data, chunk])));
  req.on('end', () => {
    (req as any).rawBody = data; // ذخیرهٔ raw
    next();
  });
}
