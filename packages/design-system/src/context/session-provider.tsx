import { type ReactNode, useCallback, useMemo, useState } from 'react';

import { SessionContext } from './session-context';

const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [sessionId, setSessionId] = useState(() => globalThis.crypto.randomUUID());

  const resetSessionId = useCallback(() => {
    const newId = globalThis.crypto.randomUUID();
    setSessionId(newId);
    return newId;
  }, []);

  const value = useMemo(() => ({ resetSessionId, sessionId }), [resetSessionId, sessionId]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export { SessionProvider };
