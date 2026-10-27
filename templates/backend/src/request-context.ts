import type { RequestContext } from '@lightproject/common/logger';
import type { Context } from 'hono';

import type { AppEnv } from './schema';

const incomingIdPattern = /^[\w.:-]{1,128}$/u;

const parseIncomingId = (header: string | undefined): string | undefined =>
  header !== undefined && incomingIdPattern.test(header) ? header : undefined;

const getRequestStore = (c: Pick<Context<AppEnv>, 'get'>): RequestContext => {
  const clientId = c.get('clientId');
  return { requestId: c.get('requestId'), ...(clientId === undefined ? {} : { clientId }) };
};

export { getRequestStore, incomingIdPattern, parseIncomingId };
