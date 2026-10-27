const readEnv = (key: string) => globalThis.process.env[key];

const localDefault = 'lightproject';

const getPostgresUser = () => readEnv('POSTGRES_USER') ?? localDefault;
const getPostgresPassword = () => readEnv('POSTGRES_PASSWORD') ?? localDefault;
const getPostgresHost = () => readEnv('POSTGRES_HOST') ?? 'localhost';
const getPostgresPort = () => readEnv('POSTGRES_PORT') ?? '5432';
const getPostgresDb = () => readEnv('DATASTORE_POSTGRES_DB') ?? 'lightproject_datastore';
const getPostgresUrl = () =>
  readEnv('DATASTORE_POSTGRES_URL') ??
  `postgres://${encodeURIComponent(getPostgresUser())}:${encodeURIComponent(getPostgresPassword())}@${getPostgresHost()}:${getPostgresPort()}/${getPostgresDb()}`;

const getDatabaseDialect = () => readEnv('DATABASE_DIALECT') ?? '';
const getCloudflareEnv = () => readEnv('CLOUDFLARE_ENV') ?? '';

export {
  getCloudflareEnv,
  getDatabaseDialect,
  getPostgresDb,
  getPostgresHost,
  getPostgresPassword,
  getPostgresPort,
  getPostgresUrl,
  getPostgresUser,
  localDefault,
  readEnv,
};
