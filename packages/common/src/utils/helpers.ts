type Primitive = string | number | boolean | bigint | symbol | null | undefined;

type JsonValue = Primitive | { [key: string]: JsonValue } | JsonValue[];

const assumeShape = <T>(_val: unknown, _dummy?: T): _val is T => true;

const getMetaEnv = (): Record<string, string | undefined> | undefined =>
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;

export { assumeShape, getMetaEnv };
export type { JsonValue, Primitive };
