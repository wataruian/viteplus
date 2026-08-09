import type { Express } from 'express';
import { docsEndpoint } from '@lightproject/common/configs';
import { logger } from '@lightproject/common/logger';
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
            path: openApiSpecFile,
          });
          if (typeof swaggerJson !== 'string') {
            throw new TypeError('Swagger JSON file is empty or not a string');
          }
          return (JSON.parse as (text: string) => Record<string, object>)(swaggerJson);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error('Failed to parse swagger json', {
            message: err.message,
            name: err.name,
            stack: err.stack,
          });
          return {};
        }
      })(),
      {
        customCss:
          '.parameter__type, .parameter__in, .model-box, .schema-toggle, .parameter-controls, .tab, .model, .model-container, .example { display: none !important; } .swagger-ui code { white-space: pre-wrap !important; } .swagger-ui th.parameters-col_description { font-size: 0 !important; } .swagger-ui th.parameters-col_description::after { content: "Type" !important; font-size: 12px !important; font-weight: bold !important; } .swagger-ui .renderedMarkdown h5, .swagger-ui .renderedMarkdown strong, .swagger-ui .renderedMarkdown td, .swagger-ui .renderedMarkdown th { color: #3b4151; } .dark .swagger-ui .renderedMarkdown h5, .dark .swagger-ui .renderedMarkdown strong, .dark .swagger-ui .renderedMarkdown td, .dark .swagger-ui .renderedMarkdown th, .dark-mode .swagger-ui .renderedMarkdown h5, .dark-mode .swagger-ui .renderedMarkdown strong, .dark-mode .swagger-ui .renderedMarkdown td, .dark-mode .swagger-ui .renderedMarkdown th, .dark-theme .swagger-ui .renderedMarkdown h5, .dark-theme .swagger-ui .renderedMarkdown strong, .dark-theme .swagger-ui .renderedMarkdown td, .dark-theme .swagger-ui .renderedMarkdown th, .theme-dark .swagger-ui .renderedMarkdown h5, .theme-dark .swagger-ui .renderedMarkdown strong, .theme-dark .swagger-ui .renderedMarkdown td, .theme-dark .swagger-ui .renderedMarkdown th, [data-theme="dark"] .swagger-ui .renderedMarkdown h5, [data-theme="dark"] .swagger-ui .renderedMarkdown strong, [data-theme="dark"] .swagger-ui .renderedMarkdown td, [data-theme="dark"] .swagger-ui .renderedMarkdown th, [data-mode="dark"] .swagger-ui .renderedMarkdown h5, [data-mode="dark"] .swagger-ui .renderedMarkdown strong, [data-mode="dark"] .swagger-ui .renderedMarkdown td, [data-mode="dark"] .swagger-ui .renderedMarkdown th { color: #e4e6eb !important; } .swagger-ui .renderedMarkdown .required-asterisk, .swagger-ui .renderedMarkdown td span { color: #f93e3e !important; }',
      },
    ),
  );
};

export { swaggerOpenApiMiddleware };
