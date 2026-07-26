import type { RouteInfo } from '../types';
import { extractServiceMetadata } from '../parsers/service-parser';
import { extractTrpcRoutesFromFile } from '../parsers/trpc-parser';
import { inspect } from 'node:util';
import path from 'node:path';
import { projectDir } from '../config';

const getTrpcRoutes = async (): Promise<RouteInfo[]> => {
  const trpcRouterDir = path.resolve(projectDir, 'src/routers/trpc/routes');

  try {
    const fs = await import('node:fs/promises');
    const routeFiles = await fs.readdir(trpcRouterDir);

    const filePromises = routeFiles.map(async (file) => {
      if (!file.endsWith('.ts') || file.endsWith('.d.ts')) {
        return [];
      }

      const filePath = path.join(trpcRouterDir, file);

      try {
        const routerPrefix = path.basename(file, '.ts');
        const fileRoutes = extractTrpcRoutesFromFile(filePath, routerPrefix);

        const routePromises = fileRoutes.map(async (route) => {
          if (
            route.serviceClass === undefined ||
            route.serviceMethod === undefined ||
            route.serviceClass === '' ||
            route.serviceMethod === ''
          ) {
            return null;
          }

          const {
            input: serviceInput,
            output,
            serviceFilePath,
          } = await extractServiceMetadata(route.serviceClass, route.serviceMethod);

          const type: 'mutation' | 'query' = route.procedureType ?? 'query';
          const method = type === 'mutation' ? 'post' : 'get';

          const returnValue = {
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
          } as RouteInfo;

          globalThis.console.log(
            'trpcReturnValue',
            inspect(returnValue, {
              colors: true,
              depth: null,
            }),
          );

          return returnValue;
        });

        const discoveredRoutes = await Promise.all(routePromises);
        return discoveredRoutes.filter((r): r is RouteInfo => r !== null);
      } catch {
        return [];
      }
    });

    const allFileRoutes = await Promise.all(filePromises);
    return allFileRoutes.flat();
  } catch {
    return [];
  }
};

export { getTrpcRoutes };
