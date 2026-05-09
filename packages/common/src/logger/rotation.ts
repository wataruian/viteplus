import type { InternalStream, LogStream, RotationOptions } from './types';
import { isRecord } from '../validators/validate';

const isInternalStream = (value: unknown): value is InternalStream =>
  isRecord(value) && typeof value['write'] === 'function';

const createRotationStream = async (
  outputPath: string,
  options: RotationOptions = {},
): Promise<LogStream> => {
  const { createStream } = await import('rotating-file-stream');
  const { dirname, basename } = await import('node:path');

  const rawCompress = options.compress ?? 'gzip';
  const compress: boolean | 'gzip' =
    rawCompress === 'gzip' || typeof rawCompress === 'boolean' ? rawCompress : 'gzip';

  const stream = createStream(basename(outputPath), {
    compress,
    interval: options.interval ?? '1d',
    path: dirname(outputPath),
    size: options.size ?? '10M',
  });

  if (isInternalStream(stream)) {
    return {
      write: (data: string) => {
        stream.write(data);
      },
    };
  }

  throw new Error('Failed to create a valid rotation stream');
};

export { isInternalStream, createRotationStream };
