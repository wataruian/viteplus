export interface WorkerEvent {
  payload: WorkerEventPayload;
  type: string;
}

export interface WorkerEventPayload {
  [key: string]: unknown;
}

export interface WorkerResult {
  error?: Error | null | undefined;
  success: boolean;
}
