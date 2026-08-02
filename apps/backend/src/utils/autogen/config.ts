import { getCallerDir } from '@lightproject/common/utils';
import path from 'node:path';
import { projectCache } from './utils/cache';

const projectDir = getCallerDir();
const servicesDir = path.resolve(projectDir, 'src/services');

const autogenDir = path.resolve(projectDir, 'tmp/autogen');
const swaggerRoutesFile = path.resolve(autogenDir, 'swagger-routes.ts');
const swaggerJsonOutputFile = path.resolve(autogenDir, 'swagger-output.json');
const templateFile = path.resolve(autogenDir, 'template.json');
const openApiSpecFile = path.resolve(autogenDir, 'openapi.json');
const routesFile = path.resolve(autogenDir, 'routes.json');

const swaggerEndpointFiles = [swaggerRoutesFile];

const getProject = () => projectCache.getProject();

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
  getProject,
};
