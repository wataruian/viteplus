import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const getVariants = (content: string): Record<string, string[]> => {
  const m = /argTypes:\s*\{(?<blocks>[\s\S]*?)\}\s*,?\s*(?:component|tags|title):/u.exec(content);
  const variants: Record<string, string[]> = {};
  if (m?.groups?.['blocks'] !== undefined && m.groups['blocks'] !== '') {
    const blocks = m.groups['blocks'].split(/(?=\s+[a-zA-Z0-9_]+:\s*\{)/u);

    for (const block of blocks) {
      const match = /^\s+(?<name>[a-zA-Z0-9_]+):\s*\{/u.exec(block);

      if (match?.groups?.['name'] !== undefined && match.groups['name'] !== 'as') {
        const { name } = match.groups;
        const optMatch = /options:\s*\[(?<options>[^\]]+)\]/u.exec(block);

        if (optMatch?.groups?.['options'] !== undefined && optMatch.groups['options'] !== '') {
          const opts = optMatch.groups['options']
            .split(',')
            .map((s) => s.trim().replaceAll(/^['"]|['"]$/gu, ''))
            .filter(Boolean);
          variants[name] = opts;
        }
      }
    }
  }
  return variants;
};

const updateStoryFile = (storiesFile: string): boolean => {
  let content = fs.readFileSync(storiesFile, 'utf8');

  const variants = getVariants(content);

  const variantNames = Object.keys(variants);
  if (variantNames.length === 0) {
    return false;
  }

  let generatedStories = '';
  const exportList: string[] = ['Default'];
  let changed = false;

  if (content.includes('const AllVariants')) {
    content = content.replace(/const AllVariants[\s\S]*?\n\};\n\n/u, '');
    changed = true;
  }

  content = content.replaceAll(
    /const (?:Intent|Size|Look|Variant|State|Label|Radius|Align|Color|Type|Tone): StoryObj<typeof meta> = \{[\s\S]*?\n\};\n/gu,
    '',
  );

  for (const variantName of variantNames) {
    const options = variants[variantName];

    for (const option of options) {
      let safeOption = option;

      if (safeOption === 'true') {
        safeOption = 'True';
      }

      if (safeOption === 'false') {
        safeOption = 'False';
      }

      safeOption = safeOption.replaceAll(/[^a-zA-Z0-9_]/gu, '');

      if (safeOption.length === 0) {
        continue;
      }

      const StoryName = safeOption.charAt(0).toUpperCase() + safeOption.slice(1);

      if (StoryName === 'Default') {
        continue;
      }

      exportList.push(StoryName);

      if (!content.includes(`const ${StoryName}: StoryObj`)) {
        changed = true;

        const value = option === 'true' || option === 'false' ? option : `'${option}'`;

        generatedStories += `\nconst ${StoryName}: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    ${variantName}: ${value},
  },
};\n`;
      }
    }
  }

  if (changed) {
    content = content.replace(/(?<export>\nexport\s+\{)/u, `${generatedStories}$<export>`);

    content = content.replace(
      /export\s+\{\s*(?<exports>[^}]+)\s*\};/u,
      (_match: string, group1: string) => {
        const existingExports = group1
          .split(',')
          .map((s: string) => s.trim())
          .filter(
            (s: string) =>
              s !== '' &&
              s !== 'AllVariants' &&
              s !== 'Intent' &&
              s !== 'Size' &&
              s !== 'Look' &&
              s !== 'Variant' &&
              s !== 'State',
          );

        const finalExports: string[] = [];
        const allExports = new Set([...existingExports, ...exportList]);

        for (const exp of allExports) {
          if (!finalExports.some((f) => f.endsWith(` as ${exp}`) || f === exp)) {
            finalExports.push(exp);
          }
        }

        return `export { ${finalExports.join(', ')} };`;
      },
    );

    fs.writeFileSync(storiesFile, content);
    return true;
  }

  return false;
};

const updateStories = () => {
  const dir = path.join(globalThis.process.cwd(), 'src', 'components');

  const filesToFix: string[] = [];
  const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.stories.tsx'));

  for (const file of files) {
    const storiesFile = path.join(dir, file);
    const updated = updateStoryFile(storiesFile);
    if (updated) {
      filesToFix.push(storiesFile);
    }
  }

  if (filesToFix.length > 0) {
    globalThis.process.stdout.write(`Running vp check --fix on ${filesToFix.length} files...\n`);

    exec(
      `vp check --fix ${filesToFix.join(' ')}`,
      (err: Error | null, stdout: string, stderr: string) => {
        if (stdout !== '') {
          globalThis.process.stdout.write(stdout);
        }
        if (stderr !== '') {
          globalThis.process.stderr.write(stderr);
        }
        if (err === null) {
          globalThis.process.stdout.write('Successfully updated and formatted story files.\n');
        } else {
          throw new Error('Linting failed.');
        }
      },
    );
  } else {
    globalThis.process.stdout.write('All story files are up to date.\n');
  }
};

if (import.meta.url === `file://${globalThis.process.argv[1]}`) {
  updateStories();
}

export { getVariants, updateStories, updateStoryFile };
