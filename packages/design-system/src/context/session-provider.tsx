import { type ReactNode, useState } from 'react';

import { SessionContext } from './session-context';

const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [sessionId, setSessionId] = useState(() => globalThis.crypto.randomUUID());

  const resetSessionId = () => {
    const newId = globalThis.crypto.randomUUID();
    setSessionId(newId);
    return newId;
  };

  return (
    <SessionContext.Provider value={{ resetSessionId, sessionId }}>
      {children}
    </SessionContext.Provider>
  );
};

export { SessionProvider };
