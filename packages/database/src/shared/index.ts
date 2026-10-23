type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const jobStatuses = ['pending', 'running', 'succeeded', 'dead'] as const;

type JobStatus = (typeof jobStatuses)[number];

const jobStatusList = jobStatuses.map((status) => `'${status}'`).join(', ');

const dedupeKeyPredicate = 'dedupe_key IS NOT NULL';
const finishedJobsPredicate = "status IN ('succeeded', 'dead')";

const now = () => new Date();

const newId = () => globalThis.crypto.randomUUID();

const first = <T>(rows: readonly T[]): T | undefined => rows.at(0);

export { dedupeKeyPredicate, finishedJobsPredicate, first, jobStatuses, jobStatusList, newId, now };
export type { JobStatus, JsonValue };
