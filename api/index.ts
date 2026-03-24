import { createApp } from '../dist/src/main';
import type { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  const app = await createApp();
  app(req, res);
}
