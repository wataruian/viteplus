import { autogenDir, routesFile } from './config';
import { getEnv, isTest, isTrue } from '@lightproject/common/environment';
import { getHttpRoutes, getTrpcRoutes } from './discovery';
import type { RouteInfo } from '../../middlewares/initialize-request';
import fs from 'node:fs/promises';
import { generateOpenApiSpec } from './schema';
import { inspect } from 'node:util';
import { logger } from '@lightproject/common/logger';
import path from 'node:path';
import { validateRoutes } from './validators';

const extractAllRoutes = async (): Promise<RouteInfo[]> => {
  const httpRoutes = await getHttpRoutes();
  const trpcRoutes = await getTrpcRoutes();
  const allRoutes = [...httpRoutes, ...trpcRoutes];

  await fs.mkdir(autogenDir, { recursive: true });
  await fs.writeFile(routesFile, JSON.stringify(allRoutes, undefined, 2));

  if (isTrue(getEnv('AUTOGEN_DEBUG'))) {
    globalThis.console.log('allRoutes', inspect(allRoutes, { colors: true, depth: null }));
  }

  return allRoutes;
};

const build = async () => {
  const startTime = Date.now();

  try {
    if (isTest() || isTrue(getEnv('SKIP_AUTOGEN'))) {
      logger.info('Skipping swagger build during tests or SKIP_AUTOGEN is true');
      return;
    }

    logger.info('🚀 Starting autogen build process...');

    const allRoutes = await extractAllRoutes();

    const routeTypes: Record<string, number> = {};

    for (const route of allRoutes) {
      routeTypes[route.requestType] = (routeTypes[route.requestType] || 0) + 1;
    }

    logger.info(
      `📋 Discovered ${allRoutes.length} routes: ${Object.entries(routeTypes)
        .map(([type, count]) => `${count} ${type}`)
        .join(', ')}`,
    );

    logger.info(`Validating ${allRoutes.length} routes...`);
    const validationResult = validateRoutes(allRoutes);

    if (!validationResult.isValid) {
      logger.error('Route validation failed. Please fix errors before continuing.');
      throw new Error('Route validation failed');
    }

    const openApiSpec = generateOpenApiSpec(allRoutes);
    const outputFile = path.resolve(autogenDir, 'openapi.json');

    await fs.mkdir(autogenDir, { recursive: true });
    await fs.writeFile(outputFile, JSON.stringify(openApiSpec, undefined, 2));

    const pathCount = Object.keys(openApiSpec.paths).length;

    logger.info(`✅ OpenAPI spec generated with ${pathCount} paths`);
    logger.info(`📄 Saved to: ${outputFile}`);
    logger.info(
      `🎉 OpenAPI specification generation completed successfully! (${Date.now() - startTime}ms)`,
    );
  } catch (error) {
    logger.error(
      `❌ Error after ${Date.now() - startTime}ms:`,
      error instanceof Error ? { message: error.message, stack: error.stack } : { error },
    );
    throw error;
  }
};

export { build, extractAllRoutes };

export * from './config';
export * from './discovery';
export * from './project';
export * from './schema';
export * from './validators';
