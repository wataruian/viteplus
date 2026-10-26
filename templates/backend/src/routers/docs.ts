import {
  docsEndpoint,
  docsHttpEndpoint,
  docsTrpcEndpoint,
  openApiHttpJsonEndpoint,
  openApiTrpcJsonEndpoint,
  requestTypes,
} from '@lightproject/common/configs';
import { isLocal } from '@lightproject/common/environment';
import { Hono } from 'hono';

const docsLinks = [
  { href: docsHttpEndpoint, label: `${requestTypes.http} OpenAPI docs` },
  { href: openApiHttpJsonEndpoint, label: `${requestTypes.http} OpenAPI schema` },
  { href: docsTrpcEndpoint, label: `${requestTypes.trpc} OpenAPI docs` },
  { href: openApiTrpcJsonEndpoint, label: `${requestTypes.trpc} OpenAPI schema` },
];

const renderDocsIndex = () => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>OpenAPI Docs</title>
  </head>
  <body>
    <h1>OpenAPI Docs</h1>
    <ul>
      ${docsLinks.map(({ href, label }) => `<li><a href="${href}">${label}</a></li>`).join('\n      ')}
    </ul>
  </body>
</html>`;

const docsRouter = new Hono();

if (isLocal()) {
  docsRouter.get(docsEndpoint, (c) => c.html(renderDocsIndex()));
}

export { docsLinks, docsRouter, renderDocsIndex };
