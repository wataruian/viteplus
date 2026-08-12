import { Project } from 'ts-morph';

let cachedProject: Project | undefined = undefined;

const getProject = () => {
  if (!cachedProject) {
    cachedProject = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
      skipLoadingLibFiles: true,
      tsConfigFilePath: 'tsconfig.json',
      useInMemoryFileSystem: false,
    });

    cachedProject.addSourceFilesAtPaths(['src/**/*.ts']);
  }

  return cachedProject;
};

export { getProject };
