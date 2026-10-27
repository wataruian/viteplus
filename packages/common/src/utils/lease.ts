type LeaseLoss = 'expiring' | 'taken-over';

interface LeaseHeartbeatOptions {
  leaseMs: number;
  intervalMs: number;
  reserveMs: number;
  heldSince: number;
  renew: () => Promise<boolean>;
  onLost: (reason: LeaseLoss) => void;
  onRenewError: (error: unknown) => void;
  clock?: () => number;
}

const leaseReserveMs = (intervalMs: number, abortGraceMs: number, marginMs: number) =>
  intervalMs + abortGraceMs + Math.min(marginMs, intervalMs / 2);

const startLeaseHeartbeat = ({
  clock = Date.now,
  heldSince,
  intervalMs,
  leaseMs,
  onLost,
  onRenewError,
  renew,
  reserveMs,
}: LeaseHeartbeatOptions): (() => void) => {
  let heldUntil = heldSince + leaseMs;
  let inFlight = false;
  let stopped = false;
  let timer: ReturnType<typeof globalThis.setInterval> | undefined = undefined;
  const stop = () => {
    stopped = true;
    globalThis.clearInterval(timer);
  };
  const lose = (reason: LeaseLoss) => {
    stop();
    onLost(reason);
  };
  timer = globalThis.setInterval(() => {
    const now = clock();
    if (now + reserveMs >= heldUntil) {
      lose('expiring');
      return;
    }
    if (inFlight) {
      return;
    }
    inFlight = true;
    renew().then(
      (held) => {
        inFlight = false;
        if (stopped) {
          return;
        }
        if (held) {
          heldUntil = Math.max(heldUntil, now + leaseMs);
        } else {
          lose('taken-over');
        }
      },
      (error: unknown) => {
        inFlight = false;
        if (!stopped) {
          onRenewError(error);
        }
      },
    );
  }, intervalMs);
  return stop;
};

export { leaseReserveMs, startLeaseHeartbeat };
export type { LeaseHeartbeatOptions, LeaseLoss };
