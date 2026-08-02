import { getEnv, isTest } from '@lightproject/common/environment';
import type { RouteInfo } from '../types';
import { extractServiceMetadata } from '../parsers/service-parser';
import { extractTrpcRoutesFromFile } from '../parsers/trpc-parser';

import path from 'node:path';
import { projectDir } from '../config';

const getTrpcRoutes = async (): Promise<RouteInfo[]> => {
  const trpcRouterDir = path.resolve(projectDir, 'src/routers/trpc/routes');

  try {
    const fs = await import('node:fs/promises');
    const rawRouteFiles = await fs.readdir(trpcRouterDir);
    const routeFiles =
      getEnv('ENABLE_TEST_ROUTES') === 'true' ||
      isTest() ||
      getEnv('VITEST') === 'true' ||
      getEnv('NODE_ENV') === 'test'
        ? rawRouteFiles
        : rawRouteFiles.filter((file) => file !== 'test.ts');

    const allRoutes: RouteInfo[] = [];

    await routeFiles.reduce(async (filePromise, file) => {
      await filePromise;

      if (!file.endsWith('.ts') || file.endsWith('.d.ts')) {
        return;
      }

      const filePath = path.join(trpcRouterDir, file);

      try {
        const routerPrefix = path.basename(file, '.ts');
        const fileRoutes = extractTrpcRoutesFromFile(filePath, routerPrefix);

        await fileRoutes.reduce(async (routePromise, route) => {
          await routePromise;

          if (
            route.serviceClass === undefined ||
            route.serviceMethod === undefined ||
            route.serviceClass === '' ||
            route.serviceMethod === ''
          ) {
            return;
          }

          const {
            input: serviceInput,
            output,
            serviceFilePath,
          } = await extractServiceMetadata(route.serviceClass, route.serviceMethod);

          const type: 'mutation' | 'query' = route.procedureType ?? 'query';
          const method = type === 'mutation' ? 'post' : 'get';

          allRoutes.push({
            handlerFilePath: filePath,
            input: serviceInput,
            method,
            output,
            path: route.path,
            requestType: 'tRPC',
            serviceClass: route.serviceClass,
            serviceFilePath,
            serviceMethod: route.serviceMethod,
            type,
          });
        }, Promise.resolve());
      } catch {
        // Ignore file parsing/loading error and continue
      }
    }, Promise.resolve());

    return allRoutes;
  } catch {
    return [];
  }
};

export { getTrpcRoutes };
