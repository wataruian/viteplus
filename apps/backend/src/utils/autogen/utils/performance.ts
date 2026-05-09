import { logger } from '@lightproject/common/logger';

// Constants for formatting and display
const SEPARATOR_LENGTH = 50;
const PROGRESS_BAR_LENGTH = 20;
const LOG_INTERVAL_MS = 500;
const SECONDS_THRESHOLD_MS = 1000;
const PERCENTAGE_DECIMAL_PLACES = 1;
const DURATION_DECIMAL_PLACES = 2;
const PERCENTAGE_MULTIPLIER = 100;
const OPERATION_NAME_PADDING = 25;
const DURATION_PADDING = 8;

/**
 * Performance measurement utility for autogen operations
 */
export class PerformanceTimer {
  private readonly measurements: Map<string, number> = new Map();
  private readonly operations: Array<{ duration: number; name: string }> = [];
  private startTime = 0;

  /**
   * Get the total elapsed time since start
   */
  getTotal(): number {
    return performance.now() - this.startTime;
  }

  /**
   * Mark the start of a specific operation
   */
  mark(operationName: string): void {
    this.measurements.set(operationName, performance.now());
  }

  /**
   * End timing for a specific operation and log progress
   */
  measure(operationName: string, showProgress = true): number {
    const startTime = this.measurements.get(operationName);
    if (!startTime) {
      logger.warn(`No start time found for operation: ${operationName}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.operations.push({ duration, name: operationName });

    if (showProgress) {
      const formattedDuration = this.formatDuration(duration);
      logger.info(`✅ ${operationName} completed in ${formattedDuration}`);
    }

    return duration;
  }

  /**
   * Show a detailed performance summary
   */
  showSummary(): void {
    const totalTime = this.getTotal();
    const formattedTotal = this.formatDuration(totalTime);

    logger.info(`\n📊 Performance Summary (Total: ${formattedTotal})`);
    logger.info('='.repeat(SEPARATOR_LENGTH));

    // Sort operations by duration (longest first)
    const sortedOps = [...this.operations].sort(
      (a, b) => b.duration - a.duration
    );

    for (const op of sortedOps) {
      const formattedDuration = this.formatDuration(op.duration);
      const percentage = (
        (op.duration / totalTime) *
        PERCENTAGE_MULTIPLIER
      ).toFixed(PERCENTAGE_DECIMAL_PLACES);
      logger.info(
        `  ${op.name.padEnd(OPERATION_NAME_PADDING)} ${formattedDuration.padStart(DURATION_PADDING)} (${percentage}%)`
      );
    }

    logger.info('='.repeat(SEPARATOR_LENGTH));
  }

  /**
   * Start timing the overall process
   */
  start(): void {
    this.startTime = performance.now();
    this.measurements.clear();
    this.operations.length = 0;
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    return ms < SECONDS_THRESHOLD_MS
      ? `${ms.toFixed(0)}ms`
      : `${(ms / SECONDS_THRESHOLD_MS).toFixed(DURATION_DECIMAL_PLACES)}s`;
  }
}

/**
 * Progress indicator for operations with known counts
 */
export class ProgressIndicator {
  private current = 0;
  private lastLogTime = 0;
  private readonly logInterval: number = LOG_INTERVAL_MS; // Log every 500ms
  private readonly operation: string;
  private readonly total: number;

  constructor(operation: string, total: number) {
    this.operation = operation;
    this.total = total;
  }

  /**
   * Complete the progress indicator
   */
  complete(): void {
    this.current = this.total;
    this.logProgress();
  }

  /**
   * Update progress and optionally log
   */
  update(increment = 1): void {
    this.current += increment;

    const now = performance.now();
    if (
      now - this.lastLogTime > this.logInterval ||
      this.current === this.total
    ) {
      this.logProgress();
      this.lastLogTime = now;
    }
  }

  /**
   * Create a simple progress bar
   */
  private createProgressBar(percentage: number): string {
    const barLength = PROGRESS_BAR_LENGTH;
    const filled = Math.round((percentage / PERCENTAGE_MULTIPLIER) * barLength);
    const empty = barLength - filled;
    return `[${'█'.repeat(filled)}${' '.repeat(empty)}]`;
  }

  /**
   * Log current progress
   */
  private logProgress(): void {
    const percentage = Math.round(
      (this.current / this.total) * PERCENTAGE_MULTIPLIER
    );
    const bar = this.createProgressBar(percentage);
    logger.info(
      `🔄 ${this.operation}: ${bar} ${this.current}/${this.total} (${percentage}%)`
    );
  }
}

/**
 * Global performance timer instance
 */
export const performanceTimer = new PerformanceTimer();
