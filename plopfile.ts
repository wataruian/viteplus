import { execFileSync } from 'node:child_process';

import type { NodePlopAPI } from 'plop';

const componentPath = 'packages/design-system/src/components/{{name}}.tsx';
const testPath = 'packages/design-system/tests/unit/{{name}}.test.tsx';
const storiesPath = 'packages/design-system/src/components/{{name}}.stories.tsx';
const registryPath = 'packages/design-system/src/components/registry.ts';

const plopfile = (plop: NodePlopAPI) => {
  plop.setActionType('format', (answers) => {
    const files = [componentPath, testPath, storiesPath, registryPath].map((file) =>
      plop.renderString(file, answers),
    );
    execFileSync('vp', ['fmt', ...files], { stdio: 'inherit' });
    return `formatted ${files.length} files`;
  });

  plop.setGenerator('component', {
    actions: [
      {
        path: componentPath,
        templateFile: '.templates/plop/component.tsx.hbs',
        type: 'add',
      },
      {
        path: testPath,
        templateFile: '.templates/plop/component.test.tsx.hbs',
        type: 'add',
      },
      {
        path: storiesPath,
        templateFile: '.templates/plop/component.stories.tsx.hbs',
        type: 'add',
      },
      {
        path: registryPath,
        separator: '',
        template: "export * from './{{name}}';\n",
        type: 'append',
      },
      { type: 'format' },
    ],
    description: 'Create a new design-system component',
    prompts: [
      {
        message: 'Component name (kebab-case):',
        name: 'name',
        type: 'input',
      },
    ],
  });
};

export default plopfile;
