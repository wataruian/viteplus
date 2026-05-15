import type { Express } from 'express';
import { docsEndpoint } from '@lightproject/common/configs';
import { isRecord } from '@lightproject/common/validators';
import { openApiSpecFile } from '../utils/autogen';
import { readFile } from '@lightproject/common/utils';
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
            typeof swaggerJson === 'string' ? swaggerJson : (swaggerJson?.toString() ?? '{}');
          const parsed = JSON.parse(jsonString) as unknown;
          return isRecord(parsed) ? parsed : {};
        } catch {
          return {};
        }
      })(),
    ),
  );
};

export { swaggerOpenApiMiddleware };
