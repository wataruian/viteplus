import { endpoints } from '@lightproject/common/configs';
// import { generateOpenApiDocument } from 'trpc-openapi';
import { generateOpenAPIDocumentFromTRPCRouter } from 'openapi-trpc';

import { trpcRouter } from '../routers/trpc';

// export const openApiDocument = generateOpenApiDocument(trpcRouter, {
//   baseUrl: endpoints.trpcUrl,
//   docsUrl: endpoints.trpcDocsUrl,
//   title: 'tRPC OpenAPI',
//   version: '1.0.0',
// });

export const openApiDocument = generateOpenAPIDocumentFromTRPCRouter(
  trpcRouter,
  {
    pathPrefix: endpoints.trpcEndpoint,
  }
);
