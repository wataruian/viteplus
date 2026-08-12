interface LogStream {
  write: (data: string) => void;
}

interface RotationOptions {
  compress?: string | boolean;
  interval?: string;
  size?: string;
}

const createRotationStream = async (
  outputPath: string,
  options: RotationOptions = {},
): Promise<LogStream> => {
  const { createStream } = await import('rotating-file-stream');
  const { default: nodePath } = await import('node:path');
  const { dirname, basename } = nodePath;

  const rawCompress = options.compress ?? 'gzip';
  const compress: boolean | 'gzip' =
    rawCompress === 'gzip' || typeof rawCompress === 'boolean' ? rawCompress : 'gzip';

  const stream = createStream(basename(outputPath), {
    compress,
    interval: options.interval ?? '1d',
    path: dirname(outputPath),
    size: options.size ?? '10M',
  });

  return {
    write: (data: string) => {
      stream.write(data);
    },
  };
};

export { createRotationStream };
export type { LogStream, RotationOptions };
