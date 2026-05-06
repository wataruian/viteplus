import path from 'node:path';
import { directory } from '@lightproject/common/utils';

import { projectCache } from './utils/cache';

// Project configuration
export const projectDir = directory.findProjectRoot('.', 'package.json');
export const servicesDir = path.resolve(projectDir, 'src/services');

// Output paths
export const autogenDir = path.resolve(projectDir, 'tmp/autogen');
export const swaggerRoutesFile = path.resolve(autogenDir, 'swagger-routes.ts');
export const swaggerJsonOutputFile = path.resolve(
  autogenDir,
  'swagger-output.json'
);
export const templateFile = path.resolve(autogenDir, 'template.json');
export const openApiSpecFile = path.resolve(autogenDir, 'openapi.json');
export const swaggerEndpointFiles = [swaggerRoutesFile];

// TypeScript project instance with caching for better performance
export const getProject = () => projectCache.getProject();
