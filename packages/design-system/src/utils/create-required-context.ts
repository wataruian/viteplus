import { type Context, createContext, useContext } from 'react';

const createRequiredContext = <T>(errorMessage: string): [Context<T | undefined>, () => T] => {
  const RequiredContext = createContext<T | undefined>(undefined);

  const useRequiredContext = (): T => {
    const context = useContext(RequiredContext);
    if (context === undefined) {
      throw new Error(errorMessage);
    }
    return context;
  };

  return [RequiredContext, useRequiredContext];
};

export { createRequiredContext };
