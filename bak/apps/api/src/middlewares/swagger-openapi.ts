import { endpoints } from '@lightproject/common/configs';
import { directory } from '@lightproject/common/utils';
import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

import { openApiSpecFile } from '../utils/autogen';
// import { swaggerJsonOutputFile } from '../utils/autogen';

export const swaggerOpenApiMiddleware = (app: Express) => {
  app.use(
    endpoints.docsEndpoint,
    swaggerUi.serve,
    swaggerUi.setup(
      (() => {
        const swaggerJson = directory.readFile({
          encoding: 'utf8',
          // path: swaggerJsonOutputFile,
          path: openApiSpecFile,
        });
        try {
          const jsonString =
            typeof swaggerJson === 'string'
              ? swaggerJson
              : swaggerJson?.toString() || '{}';
          return JSON.parse(jsonString);
        } catch {
          return {};
        }
      })()
    )
  );
};
