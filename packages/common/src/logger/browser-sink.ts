import type { LogEntry } from './formatters';

interface BrowserLogSink {
  pushLog: (entry: LogEntry) => void;
}

let browserLogSink: BrowserLogSink | undefined = undefined;

const getBrowserLogSink = (): BrowserLogSink | undefined => browserLogSink;

const registerBrowserLogSink = (sink: BrowserLogSink | undefined): void => {
  browserLogSink = sink;
};

export { getBrowserLogSink, registerBrowserLogSink };
export type { BrowserLogSink };
