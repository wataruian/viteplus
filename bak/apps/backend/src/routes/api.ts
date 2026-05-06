import type { Response } from 'express';

import express from 'express';

const router = express.Router();
const HTTP_OK = 200;

interface SampleRequestBody {
  data: unknown;
}

router.get<unknown, unknown, SampleRequestBody>(
  '/sample',
  (_req, res: Response): void => {
    res.status(HTTP_OK).json({ message: 'Hello, world!', status: 'ok' });
  }
);

export default router;
