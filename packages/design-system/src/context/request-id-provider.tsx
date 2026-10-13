import { type ReactNode, useCallback, useMemo, useState } from 'react';

import { RequestIdContext } from './request-id-context';

const RequestIdProvider = ({ children }: { children: ReactNode }) => {
  const [requestId, setRequestId] = useState(() => globalThis.crypto.randomUUID());

  const resetRequestId = useCallback(() => {
    const newId = globalThis.crypto.randomUUID();
    setRequestId(newId);
    return newId;
  }, []);

  const value = useMemo(() => ({ requestId, resetRequestId }), [requestId, resetRequestId]);

  return <RequestIdContext.Provider value={value}>{children}</RequestIdContext.Provider>;
};

export { RequestIdProvider };
