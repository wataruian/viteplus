import path from 'node:path';
import { projectDir } from '../config';
import { extractServiceMetadata } from '../parsers/service-parser';
import { extractTrpcRoutesFromFile } from '../parsers/trpc-parser';
import type { RouteInfo } from '../types';

/**
 * Extract all tRPC routes from the tRPC router using AST-based parsing
 */
export const getTrpcRoutes = async (): Promise<RouteInfo[]> => {
  const routes: RouteInfo[] = [];
  const trpcRouterDir = path.resolve(projectDir, 'src/routers/trpc/routes');

  try {
    // Use AST-based parsing to extract routes from all tRPC route files
    const fs = await import('node:fs/promises');
    const routeFiles = await Promise.resolve(fs.readdir(trpcRouterDir));

    for (const file of routeFiles) {
      if (!file.endsWith('.ts') || file.endsWith('.d.ts')) {
        continue;
      }

      const filePath = path.join(trpcRouterDir, file);

      try {
        // Extract router prefix from filename (e.g., 'test.ts' -> 'test')
        const routerPrefix = path.basename(file, '.ts');

        // Extract routes using enhanced AST-based parser
        const fileRoutes = extractTrpcRoutesFromFile(filePath, routerPrefix);

        // Convert extracted routes to RouteInfo format
        for (const route of fileRoutes) {
          if (!(route.serviceClass && route.serviceMethod)) {
            console.warn(
              `Skipping route with missing service info: ${route.path}`
            );
            continue;
          }

          // Extract service metadata using shared helper
          const { input: serviceInput, serviceFilePath } =
            await extractServiceMetadata(
              route.serviceClass,
              route.serviceMethod
            );

          // Extract procedure type from enhanced parser or default to 'query'
          const type: 'mutation' | 'query' = route.procedureType || 'query';
          const method = type === 'mutation' ? 'post' : 'get';

          routes.push({
            handlerFilePath: filePath,
            input: serviceInput,
            method,
            output: undefined, // TODO: Extract output schema from AST
            path: route.path, // Already includes /trpc/ prefix from enhanced parser
            requestType: 'tRPC',
            serviceClass: route.serviceClass,
            serviceFilePath,
            serviceMethod: route.serviceMethod,
            type,
          });
        }
      } catch (error) {
        console.warn(`Failed to parse tRPC routes from ${filePath}:`, error);
        // Continue processing other files
      }
    }
  } catch (error) {
    console.warn('Failed to read tRPC routes directory:', error);
    return [];
  }

  return routes;
};
