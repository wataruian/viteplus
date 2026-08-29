import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import {
  apiEndpoint,
  docsHttpEndpoint,
  openApiHttpJsonEndpoint,
  openApiVersion,
  requestTypes,
} from '@lightproject/common/configs';
import { isLocal } from '@lightproject/common/environment';

import packageJson from '../../../package.json' with { type: 'json' };
import { assertHttpRoutesDocumented, mergeHttpRouters } from '../utils';
import { defaultRouter } from './default';
import { testRouter } from './test';

const httpRouter = new OpenAPIHono();

const apiRouter = mergeHttpRouters({
  default: defaultRouter,
  test: testRouter,
});

httpRouter.route(apiEndpoint, apiRouter);

if (isLocal()) {
  assertHttpRoutesDocumented(apiRouter);

  httpRouter.get(openApiHttpJsonEndpoint, (c) =>
    c.json(
      httpRouter.getOpenAPIDocument({
        info: {
          title: `${requestTypes.http} OpenAPI`,
          version: packageJson.version,
        },
        openapi: openApiVersion,
      }),
    ),
  );
  httpRouter.get(docsHttpEndpoint, swaggerUI({ url: openApiHttpJsonEndpoint }));
}

export { apiRouter, httpRouter };
