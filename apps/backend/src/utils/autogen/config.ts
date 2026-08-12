import { getCallerDir } from '@lightproject/common/utils';
import path from 'node:path';

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
  routesFile,
  projectDir,
  servicesDir,
  autogenDir,
  swaggerRoutesFile,
  swaggerJsonOutputFile,
  templateFile,
  openApiSpecFile,
  swaggerEndpointFiles,
};
