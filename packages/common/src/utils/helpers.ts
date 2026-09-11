type Primitive = string | number | boolean | bigint | symbol | null | undefined;

type JsonValue = Primitive | { [key: string]: JsonValue } | JsonValue[];

const assumeShape = <T>(_val: unknown, _dummy?: T): _val is T => true;

export { assumeShape };
export type { JsonValue, Primitive };
