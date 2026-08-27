import type { NodePlopAPI } from 'plop';

const plopfile = (plop: NodePlopAPI) => {
  plop.setGenerator('component', {
    actions: [
      {
        path: 'packages/design-system/src/components/{{name}}.tsx',
        templateFile: '.templates/plop/component.tsx.hbs',
        type: 'add',
      },
      {
        path: 'packages/design-system/tests/{{name}}.test.ts',
        templateFile: '.templates/plop/component.test.ts.hbs',
        type: 'add',
      },
      {
        path: 'packages/design-system/src/components/{{name}}.stories.tsx',
        templateFile: '.templates/plop/component.stories.tsx.hbs',
        type: 'add',
      },
      {
        path: 'packages/design-system/src/components/registry.ts',
        separator: '',
        template: "export * from './{{name}}';",
        type: 'append',
      },
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
