type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const jobStatuses = ['pending', 'running', 'succeeded', 'dead'] as const;

type JobStatus = (typeof jobStatuses)[number];

const jobStatusList = jobStatuses.map((status) => `'${status}'`).join(', ');

const now = () => new Date();

const newId = () => globalThis.crypto.randomUUID();

export { jobStatuses, jobStatusList, newId, now };
export type { JobStatus, JsonValue };
