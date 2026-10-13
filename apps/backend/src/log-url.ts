import { redactUrl } from '@lightproject/common/logger';
import type { Context } from 'hono';

import type { AppEnv } from './schema';

const getLogUrl = (c: Context<AppEnv>): string => {
  const cached = c.get('logUrl');
  if (cached !== undefined) {
    return cached;
  }
  const url = redactUrl(c.req.url);
  c.set('logUrl', url);
  return url;
};

export { getLogUrl };
