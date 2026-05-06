const isCi = () => {
  return (
    process.env['ENV'] === 'ci' ||
    process.env['NODE_ENV'] === 'ci' ||
    process.env['CI'] === 'true' ||
    process.env['GITHUB_ACTIONS'] === 'true' ||
    process.env['GITLAB_CI'] === 'true'
  );
};

const isTest = () => {
  return (
    process.env['ENV'] === 'test' ||
    process.env['NODE_ENV'] === 'test' ||
    process.env['TEST'] === 'true' ||
    process.env['VITEST'] === 'true'
  );
};

const isLocal = () => {
  return (
    process.env['ENV'] === 'local' ||
    process.env['NODE_ENV'] === 'local' ||
    process.env['LOCAL'] === 'true'
  );
};

const isDevelopment = () => {
  return (
    process.env['ENV'] === 'development' ||
    process.env['NODE_ENV'] === 'development' ||
    process.env['DEVELOPMENT'] === 'true'
  );
};

const isStaging = () => {
  return (
    process.env['ENV'] === 'staging' ||
    process.env['NODE_ENV'] === 'staging' ||
    process.env['STAGING'] === 'true'
  );
};

const isProduction = () => {
  return (
    process.env['ENV'] === 'production' ||
    process.env['NODE_ENV'] === 'production' ||
    process.env['PRODUCTION'] === 'true'
  );
};

const isNonProduction = () => {
  return (
    (isCi() || isTest() || isLocal() || isDevelopment() || isStaging()) &&
    !isProduction()
  );
};

const isOtherEnvironment = (environment = '') => {
  let isOtherEnv =
    !(
      isCi() ||
      isTest() ||
      isLocal() ||
      isDevelopment() ||
      isStaging() ||
      isProduction()
    ) &&
    process.env['ENV'] !== undefined &&
    process.env['ENV'] !== null &&
    process.env['ENV'] !== '';

  if (
    !isOtherEnv &&
    environment &&
    typeof environment === 'string' &&
    environment.trim().length > 0
  ) {
    isOtherEnv = isOtherEnv && process.env['ENV'] === environment;
  }

  return (
    isOtherEnv !== undefined &&
    isOtherEnv !== null &&
    typeof isOtherEnv !== 'string' &&
    typeof isOtherEnv === 'boolean' &&
    isOtherEnv
  );
};

export {
  isCi,
  isDevelopment,
  isLocal,
  isNonProduction,
  isOtherEnvironment,
  isProduction,
  isStaging,
  isTest,
};
