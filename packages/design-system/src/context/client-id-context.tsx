import { createRequiredContext } from '../utils/create-required-context';

interface ClientIdContextType {
  clientId: string;
  resetClientId: () => string;
}

const [ClientIdContext, useClientId] = createRequiredContext<ClientIdContextType>(
  'useClientId must be used within ClientIdProvider',
);

export { ClientIdContext, useClientId };
export type { ClientIdContextType };
