import path from 'node:path';

import { getCallerDir } from '@lightproject/common/utils';

const projectDir = getCallerDir();
const servicesDir = path.resolve(projectDir, 'src/services');

const autogenDir = path.resolve(projectDir, 'tmp/autogen');
const swaggerRoutesFile = path.resolve(autogenDir, 'swagger-routes.ts');
const swaggerJsonOutputFile = path.resolve(autogenDir, 'swagger-output.json');
const templateFile = path.resolve(autogenDir, 'template.json');
const openApiSpecFile = path.resolve(autogenDir, 'openapi.json');
const routesFile = path.resolve(autogenDir, 'routes.json');

const swaggerEndpointFiles = [swaggerRoutesFile];

export {
  autogenDir,
  openApiSpecFile,
  projectDir,
  routesFile,
  servicesDir,
  swaggerEndpointFiles,
  swaggerJsonOutputFile,
  swaggerRoutesFile,
  templateFile,
};
