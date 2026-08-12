// import { generateOpenApiDocument } from 'trpc-openapi';
import { trpcEndpoint } from '@lightproject/common/configs';
// import { trpcDocsUrl, trpcUrl } from '@lightproject/common/configs';
import { generateOpenAPIDocumentFromTRPCRouter } from 'openapi-trpc';
import type openApiTypes from 'openapi-types';

import { trpcRouter } from '../routers/trpc';

// const openApiDocument: openApiTypes.OpenAPI.Document = generateOpenApiDocument(trpcRouter, {
//   baseUrl: trpcUrl,
//   docsUrl: trpcDocsUrl,
//   title: 'tRPC OpenAPI',
//   version: '1.0.0',
// });

const openApiDocument: openApiTypes.OpenAPI.Document = generateOpenAPIDocumentFromTRPCRouter(
  trpcRouter,
  {
    pathPrefix: trpcEndpoint,
  },
);

export { openApiDocument };
