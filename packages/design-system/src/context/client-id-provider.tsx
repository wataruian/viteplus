import { type ReactNode, useCallback, useMemo, useState } from 'react';

import { ClientIdContext } from './client-id-context';

interface ClientIdProviderProps {
  children: ReactNode;
  createId: () => string;
}

const ClientIdProvider = ({ children, createId }: ClientIdProviderProps) => {
  const [clientId, setClientId] = useState(createId);

  const resetClientId = useCallback(() => {
    const newId = createId();
    setClientId(newId);
    return newId;
  }, [createId]);

  const value = useMemo(() => ({ clientId, resetClientId }), [clientId, resetClientId]);

  return <ClientIdContext.Provider value={value}>{children}</ClientIdContext.Provider>;
};

export { ClientIdProvider };
export type { ClientIdProviderProps };
