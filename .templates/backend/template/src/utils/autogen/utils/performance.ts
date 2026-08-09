import { logger } from '@lightproject/common/logger';
import { performance } from 'node:perf_hooks';

class PerformanceTimer {
  private readonly measurements = new Map<string, number>();
  private readonly operations: { duration: number; name: string }[] = [];
  private startTime = 0;

  public getTotal(): number {
    return performance.now() - this.startTime;
  }

  public mark(operationName: string): void {
    this.measurements.set(operationName, performance.now());
  }

  public measure(operationName: string, showProgress = true): number {
    const startTime = this.measurements.get(operationName);

    if (startTime === undefined) {
      logger.warn(`No start time found for operation: ${operationName}`);
      return 0;
    }

    const duration = performance.now() - startTime;

    this.operations.push({
      duration,
      name: operationName,
    });

    if (showProgress) {
      const formattedDuration = PerformanceTimer.formatDuration(duration);

      logger.info(`✅ ${operationName} completed in ${formattedDuration}`);
    }

    return duration;
  }

  public showSummary(): void {
    const totalTime = this.getTotal();
    const formattedTotal = PerformanceTimer.formatDuration(totalTime);

    logger.info(`📊 Performance Summary (Total: ${formattedTotal})`);

    const sortedOps = [...this.operations].toSorted((a, b) => b.duration - a.duration);

    for (const op of sortedOps) {
      const formattedDuration = PerformanceTimer.formatDuration(op.duration);
      const percentage = ((op.duration / totalTime) * 100).toFixed(1);

      logger.info(`  ${op.name.padEnd(25)} ${formattedDuration.padStart(8)} (${percentage}%)`);
    }
  }

  public start(): void {
    this.startTime = performance.now();
    this.measurements.clear();
    this.operations.length = 0;
  }

  private static formatDuration(ms: number): string {
    return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(2)}s`;
  }
}

class ProgressIndicator {
  private current = 0;
  private lastLogTime = 0;
  private readonly logInterval = 500;
  private readonly operation: string;
  private readonly total: number;

  public constructor(operation: string, total: number) {
    this.operation = operation;
    this.total = total;
  }

  public complete(): void {
    this.current = this.total;
    this.logProgress();
  }

  public update(increment = 1): void {
    this.current += increment;

    const now = performance.now();

    if (now - this.lastLogTime > this.logInterval || this.current === this.total) {
      this.logProgress();
      this.lastLogTime = now;
    }
  }

  private static createProgressBar(percentage: number): string {
    const barLength = 20;
    const filled = Math.round((percentage / 100) * barLength);
    const empty = barLength - filled;

    return `[${'█'.repeat(filled)}${' '.repeat(empty)}]`;
  }

  private logProgress(): void {
    const percentage = Math.round((this.current / this.total) * 100);

    const bar = ProgressIndicator.createProgressBar(percentage);

    logger.info(`🔄 ${this.operation}: ${bar} ${this.current}/${this.total} (${percentage}%)`);
  }
}

const performanceTimer = new PerformanceTimer();

export { PerformanceTimer, ProgressIndicator, performanceTimer };
