interface WorkerEvent {
  payload: WorkerEventPayload;
  type: string;
}

type WorkerEventPayload = Record<string, unknown>;

interface WorkerResult {
  error?: Error | null | undefined;
  success: boolean;
}

export type { WorkerEvent, WorkerEventPayload, WorkerResult };
