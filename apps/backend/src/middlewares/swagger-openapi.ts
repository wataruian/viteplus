import type { Express } from 'express';
import { directory } from '@lightproject/common/utils';
import { docsEndpoint } from '@lightproject/common/configs';
import { openApiSpecFile } from '../utils/autogen';
// import { swaggerJsonOutputFile } from '../utils/autogen';
import swaggerUi from 'swagger-ui-express';

const swaggerOpenApiMiddleware = (app: Express) => {
  app.use(
    docsEndpoint,
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
