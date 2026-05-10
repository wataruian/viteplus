import { ProgressIndicator, performanceTimer } from './utils/performance';
import type { RouteInfo } from './types';
import { autogenDir } from './config';
import { generateOpenApiSpec } from './generators/openapi-generator';
import { getHttpRoutes } from './discovery/http-discovery';
import { getTrpcRoutes } from './discovery/trpc-discovery';
import { logger } from '@lightproject/common/logger';
import { validateRoutesWithLogging } from './validators/route-validator';

const extractAllRoutes = async (): Promise<RouteInfo[]> => {
  const allRoutes: RouteInfo[] = [];

  const httpRoutes = await getHttpRoutes();
  const trpcRoutes = await getTrpcRoutes();

  allRoutes.push(...httpRoutes, ...trpcRoutes);

  return allRoutes;
};

const build = async () => {
  performanceTimer.start();

  try {
    if (
      globalThis.process.env['NODE_ENV'] === 'test' ||
      globalThis.process.env['VITEST'] === 'true'
    ) {
      logger.info('Skipping swagger build during tests');
      return;
    }

    logger.info('🚀 Starting autogen build process...');

    performanceTimer.mark('route-extraction');
    const allRoutes = await extractAllRoutes();
    performanceTimer.measure('Route Extraction');

    const routeTypes: Record<string, number> = {};
    for (const route of allRoutes) {
      routeTypes[route.requestType] = (routeTypes[route.requestType] || 0) + 1;
    }

    logger.info(
      `📋 Discovered ${allRoutes.length} routes: ${Object.entries(routeTypes)
        .map(([type, count]) => `${count} ${type}`)
        .join(', ')}`,
    );

    performanceTimer.mark('route-validation');
    const progress = new ProgressIndicator('Validating routes', allRoutes.length);
    const validationResult = validateRoutesWithLogging(allRoutes);
    progress.complete();
    performanceTimer.measure('Route Validation');

    if (!validationResult.isValid) {
      logger.error('Route validation failed. Please fix errors before continuing.');
      throw new Error('Route validation failed');
    }

    performanceTimer.mark('openapi-generation');
    const openApiSpec = generateOpenApiSpec(allRoutes, {
      description: 'Auto-generated API documentation for Pancake platform',
      serverUrl: 'http://localhost:3000',
      title: 'Pancake API',
      version: '1.0.0',
    });
    performanceTimer.measure('OpenAPI Generation');

    performanceTimer.mark('file-operations');
    const fs = await import('node:fs/promises');
    const { default: path } = await import('node:path');

    const outputDir = autogenDir;
    const outputFile = path.resolve(outputDir, 'openapi.json');

    await Promise.resolve(fs.mkdir(outputDir, { recursive: true }));
    await Promise.resolve(fs.writeFile(outputFile, JSON.stringify(openApiSpec, undefined, 2)));
    performanceTimer.measure('File Operations');

    const pathCount = Object.keys(openApiSpec.paths).length;
    logger.info(`✅ OpenAPI spec generated with ${pathCount} paths`);
    logger.info(`📄 Saved to: ${outputFile}`);

    performanceTimer.showSummary();

    logger.info('🎉 OpenAPI specification generation completed successfully!');
  } catch (error) {
    const totalTime = performanceTimer.getTotal();
    logger.error(`❌ Error after ${Math.round(totalTime)}ms:`, error as Record<string, unknown>);
    throw error;
  }
};

export { extractAllRoutes, build };

export * from './config';
export * from './discovery/http-discovery';
export * from './discovery/trpc-discovery';
export * from './generators/openapi-generator';
export * from './parsers/http-parser';
export * from './parsers/service-parser';
export * from './parsers/trpc-parser';
export * from './types';
export * from './validators/route-validator';
