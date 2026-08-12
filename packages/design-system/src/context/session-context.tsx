import { createContext, useContext } from 'react';

interface SessionContextType {
  resetSessionId: () => string;
  sessionId: string;
}

const SessionContext = createContext<SessionContextType | null>(null);

const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
};

export { SessionContext, useSession };
export type { SessionContextType };
