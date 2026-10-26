import { logger } from '@lightproject/common/logger';
import { z } from 'zod';

import { config } from '../src/config';
import { createJobClient, jsonText } from '../src/core/client';
import { functions } from '../src/functions';
import { createJobStore } from '../src/stores';

const main = async () => {
  const [name = '', payloadText = '{}', countText = '1'] = globalThis.process.argv.slice(2);
  const definition = functions.find((candidate) => candidate.name === name);
  if (!definition) {
    throw new Error(
      `Unknown function "${name}". Known: ${functions.map((fn) => fn.name).join(', ')}`,
    );
  }
  const count = z.coerce.number().int().positive().parse(countText);
  if (config.jobStore === 'memory') {
    throw new Error('JOB_STORE=memory is not shared with the Node workers process');
  }
  const store = await createJobStore(config.jobStore);
  try {
    const client = createJobClient(store);
    const payload = jsonText.parse(payloadText);
    const jobs = await Promise.all(
      Array.from({ length: count }, async () => await client.enqueue(definition, payload)),
    );
    logger.info(`Enqueued ${jobs.length} ${name} job(s)`, { ids: jobs.map(({ id }) => id) });
  } finally {
    await store.close();
  }
};

try {
  await main();
} catch (error) {
  logger.error('Enqueue failed', { error });
  globalThis.process.exit(1);
}

export { main };
