import type { RouteInfo } from '../../middlewares/initialize-request';
import { logger } from '@lightproject/common/logger';

const validateRoute = (route: RouteInfo): { errors: number; warnings: number } => {
  let errors = 0;
  let warnings = 0;

  if (route.path === '') {
    logger.error(`  - MISSING_PATH: Route is missing path`);
    errors += 1;
  }

  if (route.requestType === '') {
    logger.error(
      `  - MISSING_REQUEST_TYPE: Route is missing requestType (HTTP/tRPC) Path: ${route.path}`,
    );
    errors += 1;
  }

  if (
    route.serviceClass === undefined ||
    route.serviceClass === '' ||
    route.serviceMethod === undefined ||
    route.serviceMethod === ''
  ) {
    logger.warn(
      `  - MISSING_SERVICE_INFO: Route is missing service class or method information Path: ${route.path}`,
    );
    warnings += 1;
  } else {
    if (!route.serviceClass.endsWith('Service')) {
      logger.error(
        `  - INVALID_SERVICE_SUFFIX: Service class "${route.serviceClass}" must end with "Service" Path: ${route.path}`,
      );
      errors += 1;
    }

    if (!/^[A-Z][a-zA-Z0-9]*Service$/u.test(route.serviceClass)) {
      logger.error(
        `  - INVALID_SERVICE_NAMING: Service class "${route.serviceClass}" must be PascalCase Path: ${route.path}`,
      );
      errors += 1;
    }
  }

  if (route.requestType === 'HTTP' && route.path.startsWith('/trpc')) {
    logger.error(
      `  - INVALID_HTTP_PATH: HTTP route path should not start with /trpc Path: ${route.path}`,
    );
    errors += 1;
  }

  if (route.requestType === 'tRPC') {
    if (!route.path.startsWith('/trpc/')) {
      logger.error(
        `  - INVALID_TRPC_PATH: tRPC route path must start with /trpc/ Path: ${route.path}`,
      );
      errors += 1;
    }

    if (route.path.includes('/trpc/') && !route.path.includes('.')) {
      logger.warn(
        `  - MISSING_TRPC_DOT_NOTATION: tRPC route should use dot notation for method names Path: ${route.path}`,
      );
      warnings += 1;
    }
  }

  return { errors, warnings };
};

const validateRoutes = (routes: RouteInfo[]): { isValid: boolean } => {
  let errors = 0;
  let warnings = 0;

  for (const route of routes) {
    const res = validateRoute(route);
    errors += res.errors;
    warnings += res.warnings;
  }

  const isValid = errors === 0;
  if (isValid) {
    logger.info(`✅ All routes passed validation (${warnings} warnings)`);
  } else {
    logger.warn(`Validation found ${errors} errors and ${warnings} warnings`);
  }

  return { isValid };
};

export { validateRoute, validateRoutes };
