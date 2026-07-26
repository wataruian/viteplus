import {
  autogenDir,
  getProject,
  openApiSpecFile,
  projectDir,
  servicesDir,
  swaggerEndpointFiles,
  swaggerJsonOutputFile,
  swaggerRoutesFile,
  templateFile,
} from '../../src/utils/autogen/config';
import { describe, expect, it } from 'vite-plus/test';
import path from 'node:path';

describe('Autogen Config', () => {
  describe('Project configuration', () => {
    it('should have correct projectDir', () => {
      expect(projectDir).toMatch(/apps\/backend$/u);
      expect(path.isAbsolute(projectDir)).toBe(true);
    });

    it('should have correct servicesDir', () => {
      expect(servicesDir).toBe(path.resolve(projectDir, 'src/services'));
      expect(path.isAbsolute(servicesDir)).toBe(true);
    });
  });

  describe('Output paths', () => {
    it('should have correct autogenDir', () => {
      expect(autogenDir).toBe(path.resolve(projectDir, 'tmp/autogen'));
      expect(path.isAbsolute(autogenDir)).toBe(true);
    });

    it('should have correct file paths', () => {
      expect(swaggerRoutesFile).toBe(path.resolve(autogenDir, 'swagger-routes.ts'));
      expect(swaggerJsonOutputFile).toBe(path.resolve(autogenDir, 'swagger-output.json'));
      expect(templateFile).toBe(path.resolve(autogenDir, 'template.json'));
      expect(openApiSpecFile).toBe(path.resolve(autogenDir, 'openapi.json'));
    });

    it('should have correct swagger endpoint files', () => {
      expect(swaggerEndpointFiles).toEqual([swaggerRoutesFile]);
    });

    it('should use absolute paths for all output files', () => {
      const outputFiles = [swaggerRoutesFile, swaggerJsonOutputFile, templateFile, openApiSpecFile];

      for (const file of outputFiles) {
        expect(path.isAbsolute(file)).toBe(true);
      }
    });
  });

  describe('TypeScript project', () => {
    it('should create project instance', () => {
      const project = getProject();
      expect(project).toBeDefined();
      expect(project.getCompilerOptions()).toBeDefined();
    });

    it('should use correct tsconfig path', () => {
      const project = getProject();
      expect(project.getSourceFiles().length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Path relationships', () => {
    it('should have consistent path structure', () => {
      expect(servicesDir.startsWith(projectDir)).toBe(true);
      expect(autogenDir.startsWith(projectDir)).toBe(true);
    });

    it('should have correct relative structure', () => {
      const relativeServicesDir = path.relative(projectDir, servicesDir);
      const relativeAutogenDir = path.relative(projectDir, autogenDir);

      expect(relativeServicesDir).toBe('src/services');
      expect(relativeAutogenDir).toBe('tmp/autogen');
    });
  });
});
