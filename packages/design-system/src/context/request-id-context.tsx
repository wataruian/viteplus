import { createRequiredContext } from '../utils/create-required-context';

interface RequestIdContextType {
  requestId: string;
  resetRequestId: () => string;
}

const [RequestIdContext, useRequestId] = createRequiredContext<RequestIdContextType>(
  'useRequestId must be used within RequestIdProvider',
);

export { RequestIdContext, useRequestId };
export type { RequestIdContextType };
