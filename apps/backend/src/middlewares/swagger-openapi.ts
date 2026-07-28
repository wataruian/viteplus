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
        try {
          const swaggerJson = readFile({
            encoding: 'utf8',
            // path: swaggerJsonOutputFile,
            path: openApiSpecFile,
          });
          const jsonString =
            typeof swaggerJson === 'string' ? swaggerJson : (swaggerJson?.toString() ?? '{}');
          const parsed = JSON.parse(jsonString) as unknown;
          return isRecord(parsed) ? parsed : {};
        } catch {
          return {};
        }
      })(),
      {
        customCss:
          '.parameter__type, .parameter__in, .parameters input, .parameters select, .parameters .parameter__value, .model-box, .schema-toggle, .parameter-controls, .tab, .model, .model-container, .example { display: none !important; } .swagger-ui code { white-space: pre-wrap !important; } .swagger-ui th.parameters-col_description { font-size: 0 !important; } .swagger-ui th.parameters-col_description::after { content: "Type" !important; font-size: 12px !important; font-weight: bold !important; }',
      },
    ),
  );
};

export { swaggerOpenApiMiddleware };
