import type { Express } from 'express';
import { docsEndpoint } from '@lightproject/common/configs';
import { openApiSpecFile } from '../utils/autogen';
import { readFile } from '@lightproject/common/utils';
// import { swaggerJsonOutputFile } from '../utils/autogen';
import swaggerUi from 'swagger-ui-express';

const swaggerOpenApiMiddleware = (app: Express) => {
  app.use(
    docsEndpoint,
    swaggerUi.serve,
    swaggerUi.setup(
      (() => {
        const swaggerJson = readFile({
          encoding: 'utf8',
          // path: swaggerJsonOutputFile,
          path: openApiSpecFile,
        });
        try {
          const jsonString =
            typeof swaggerJson === 'string' ? swaggerJson : swaggerJson?.toString() || '{}';
          return JSON.parse(jsonString);
        } catch {
          return {};
        }
      })(),
    ),
  );
};

export { swaggerOpenApiMiddleware };
