import { createRequiredContext } from '../utils/create-required-context';

interface SessionContextType {
  resetSessionId: () => string;
  sessionId: string;
}

const [SessionContext, useSession] = createRequiredContext<SessionContextType>(
  'useSession must be used within SessionProvider',
);

export { SessionContext, useSession };
export type { SessionContextType };
