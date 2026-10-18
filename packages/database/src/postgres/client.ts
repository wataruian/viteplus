import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

interface PostgresDatabaseOptions {
  url: string;
  max?: number;
  onNotice?: (message: string) => void;
}

const ignoreNotice = () => {};

const createPostgresDatabase = ({
  max = 10,
  onNotice = ignoreNotice,
  url,
}: PostgresDatabaseOptions) => {
  const client = postgres(url, {
    max,
    onnotice: ({ message }) => {
      onNotice(message);
    },
  });
  const db = drizzle({ client });
  return {
    close: async () => {
      await client.end({ timeout: 5 });
    },
    db,
  };
};

type PostgresDatabase = ReturnType<typeof createPostgresDatabase>['db'];

export { createPostgresDatabase, ignoreNotice };
export type { PostgresDatabase, PostgresDatabaseOptions };
