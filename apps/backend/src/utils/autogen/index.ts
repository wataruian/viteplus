import { logger } from '@lightproject/common/logger';
import { autogenDir } from './config';
import { getHttpRoutes, getTrpcRoutes } from './discovery';
import { generateOpenApiSpec } from './generators';
import type { RouteInfo } from './types';
import { ProgressIndicator, performanceTimer } from './utils/performance';
import { validateRoutesWithLogging } from './validators';

/**
 * Extract all routes from HTTP and tRPC routers
 */
export const extractAllRoutes = async (): Promise<RouteInfo[]> => {
  const allRoutes: RouteInfo[] = [];

  // Use dedicated functions directly for better clarity
  allRoutes.push(...(await getHttpRoutes()), ...(await getTrpcRoutes()));

  return allRoutes;
};

/**
 * Main autogen build function with performance monitoring
 */
export const build = async () => {
  // Start performance tracking
  performanceTimer.start();

  try {
    // Skip autogen during tests to prevent interference
    if (
      process.env['NODE_ENV'] === 'test' ||
      process.env['VITEST'] === 'true'
    ) {
      logger.info('Skipping swagger build during tests');
      return;
    }

    logger.info('🚀 Starting autogen build process...');

    // Extract routes with performance tracking
    performanceTimer.mark('route-extraction');
    const allRoutes = await extractAllRoutes();
    performanceTimer.measure('Route Extraction');

    // Reduce verbose logging by default, show summary instead
    const routeTypes: Record<string, number> = {};
    for (const route of allRoutes) {
      routeTypes[route.requestType] = (routeTypes[route.requestType] || 0) + 1;
    }

    logger.info(
      `📋 Discovered ${allRoutes.length} routes: ${Object.entries(routeTypes)
        .map(([type, count]) => `${count} ${type}`)
        .join(', ')}`
    );

    // Validate routes with progress tracking
    performanceTimer.mark('route-validation');
    const progress = new ProgressIndicator(
      'Validating routes',
      allRoutes.length
    );
    const validationResult = validateRoutesWithLogging(allRoutes);
    progress.complete();
    performanceTimer.measure('Route Validation');

    // Continue even with validation warnings, but fail on errors
    if (!validationResult.isValid) {
      logger.error(
        'Route validation failed. Please fix errors before continuing.'
      );
      throw new Error('Route validation failed');
    }

    // Generate OpenAPI specification with progress tracking
    performanceTimer.mark('openapi-generation');
    const openApiSpec = generateOpenApiSpec(allRoutes, {
      description: 'Auto-generated API documentation for Pancake platform',
      serverUrl: 'http://localhost:3000',
      title: 'Pancake API',
      version: '1.0.0',
    });
    performanceTimer.measure('OpenAPI Generation');

    // Save OpenAPI spec to file with progress tracking
    performanceTimer.mark('file-operations');
    const fs = await import('node:fs/promises');
    const { default: path } = await import('node:path');

    const outputDir = autogenDir;
    const outputFile = path.resolve(outputDir, 'openapi.json');

    await Promise.resolve(fs.mkdir(outputDir, { recursive: true }));
    await Promise.resolve(
      fs.writeFile(outputFile, JSON.stringify(openApiSpec, undefined, 2))
    );
    performanceTimer.measure('File Operations');

    // Final success message
    const pathCount = Object.keys(openApiSpec.paths).length;
    logger.info(`✅ OpenAPI spec generated with ${pathCount} paths`);
    logger.info(`📄 Saved to: ${outputFile}`);

    // Show detailed performance summary
    performanceTimer.showSummary();

    logger.info('🎉 OpenAPI specification generation completed successfully!');
  } catch (error) {
    const totalTime = performanceTimer.getTotal();
    logger.error(`❌ Error after ${Math.round(totalTime)}ms:`, error);
    throw error;
  }
};

// Note: Main execution is handled in ../autogen.ts for proper file path matching

// Re-export everything for backward compatibility
export * from './config';
export * from './discovery';
export * from './generators';
export * from './parsers';
export * from './types';
export * from './validators';
