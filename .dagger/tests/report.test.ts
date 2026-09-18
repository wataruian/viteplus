import { beforeEach, describe, expect, test } from 'vite-plus/test';

import {
  SONAR_COMPARATORS,
  attachSonarRow,
  coverageRow,
  markdownCell,
  markdownList,
  semgrepRow,
  sonarRow,
} from '../src/helpers/report';
import { FakeDirectory, FakeFile } from './helpers/dagger-fakes';
import { resetDaggerWorld, world } from './helpers/dagger-world';

beforeEach(() => {
  resetDaggerWorld();
});

describe('markdownCell', () => {
  test('flattens newlines and escapes pipes so the value stays inside one table cell', () => {
    expect(markdownCell('line one\nline two | still one cell')).toBe(
      'line one line two   still one cell',
    );
  });
});

describe('markdownList', () => {
  test('renders a placeholder for an empty list', () => {
    expect(markdownList([])).toBe('-');
  });

  test('joins entries under the limit with the row separator', () => {
    expect(markdownList(['a', 'b'])).toBe('a<br>---<br>b');
  });

  test('truncates past the limit and appends a remainder marker', () => {
    const lines = Array.from({ length: 12 }, (_unused, index) => `line-${index}`);
    const result = markdownList(lines);
    expect(result.split('<br>---<br>')).toStrictEqual([...lines.slice(0, 10), '… +2 more']);
  });
});

describe('coverageRow', () => {
  test('reports a placeholder row when there is no summary', () => {
    expect(coverageRow('backend', undefined)).toBe(
      '| backend | _no coverage (tests failed or skipped)_ | | | |\n',
    );
  });

  test('renders each metric percentage from the coverage summary', () => {
    const summary = JSON.stringify({
      total: {
        branches: { pct: 80 },
        functions: { pct: 100 },
        lines: { pct: 95.5 },
        statements: { pct: 90 },
      },
    });

    expect(coverageRow('backend', summary)).toBe('| backend | 95.5% | 90% | 100% | 80% |\n');
  });

  test('renders a blank cell for a metric missing from the summary', () => {
    const summary = JSON.stringify({ total: {} });
    expect(coverageRow('backend', summary)).toBe(`| backend |  |  |  |  |\n`);
  });
});

describe('semgrepRow', () => {
  test('reports a placeholder row when there is no SARIF report', () => {
    expect(semgrepRow('backend', undefined)).toBe(
      '| backend | _no report (scan failed or skipped)_ | |\n',
    );
  });

  test('reports a clean scan with no findings', () => {
    const sarif = JSON.stringify({ runs: [{ results: [] }] });
    expect(semgrepRow('backend', sarif)).toBe('| backend | 0 | - |\n');
  });

  test('renders each finding location and message', () => {
    const sarif = JSON.stringify({
      runs: [
        {
          results: [
            {
              locations: [
                {
                  physicalLocation: {
                    artifactLocation: { uri: 'src/app.ts' },
                    region: { startLine: 10 },
                  },
                },
              ],
              message: { text: 'Avoid eval' },
              ruleId: 'no-eval',
            },
          ],
        },
      ],
    });

    expect(semgrepRow('backend', sarif)).toBe(
      '| backend | 1 | `no-eval` src/app.ts:10 — Avoid eval |\n',
    );
  });

  test('falls back to placeholders when a finding is missing its fields', () => {
    const sarif = JSON.stringify({ runs: [{ results: [{ locations: [{}] }] }] });
    expect(semgrepRow('backend', sarif)).toBe('| backend | 1 | `?` ?:? —  |\n');
  });
});

describe('SONAR_COMPARATORS', () => {
  test('maps every SonarQube comparator to its symbol', () => {
    expect(SONAR_COMPARATORS).toStrictEqual({ EQ: '==', GT: '>', LT: '<', NE: '!=' });
  });
});

describe('sonarRow', () => {
  test('reports a placeholder row when there is no quality gate report', () => {
    expect(sonarRow('backend', undefined, undefined)).toBe(
      '| backend | _no report (scan failed or skipped)_ | | | | |\n',
    );
  });

  test('renders a passing gate with no issues', () => {
    const qualityGate = JSON.stringify({
      projectStatus: {
        conditions: [
          {
            actualValue: '85.0',
            comparator: 'GT',
            errorThreshold: '80',
            metricKey: 'new_coverage',
            status: 'OK',
          },
        ],
        status: 'OK',
      },
    });
    const issues = JSON.stringify({ issues: [] });

    expect(sonarRow('backend', qualityGate, issues)).toBe(
      '| backend | ✅ Passed | 85.0 | - | - | - |\n',
    );
  });

  test('renders a failing gate with the breaching condition and its issues', () => {
    const qualityGate = JSON.stringify({
      projectStatus: {
        conditions: [
          {
            actualValue: '40',
            comparator: 'LT',
            errorThreshold: '80',
            metricKey: 'new_coverage',
            status: 'ERROR',
          },
        ],
        status: 'ERROR',
      },
    });
    const issues = JSON.stringify({
      issues: [
        {
          component: 'my-project:src/app.ts',
          line: 12,
          message: 'Refactor this',
          rule: 'typescript:S1234',
        },
      ],
    });

    expect(sonarRow('backend', qualityGate, issues)).toBe(
      '| backend | ❌ ERROR | 40 | - | `new_coverage` 40 < 80 | `typescript:S1234` src/app.ts:12 — Refactor this |\n',
    );
  });

  test('renders "-" for issues when the issues report is missing', () => {
    const qualityGate = JSON.stringify({
      projectStatus: { conditions: [], status: 'OK' },
    });

    expect(sonarRow('backend', qualityGate, undefined)).toBe(
      '| backend | ✅ Passed | - | - | - | - |\n',
    );
  });

  test('falls back to "UNKNOWN" when the gate has no status', () => {
    const qualityGate = JSON.stringify({ projectStatus: { conditions: [] } });

    expect(sonarRow('backend', qualityGate, undefined)).toBe(
      '| backend | ❌ UNKNOWN | - | - | - | - |\n',
    );
  });

  test('falls back to the raw comparator and placeholders for failing conditions missing fields', () => {
    const qualityGate = JSON.stringify({
      projectStatus: {
        conditions: [{ comparator: 'BETWEEN', status: 'ERROR' }, { status: 'ERROR' }],
        status: 'ERROR',
      },
    });

    expect(sonarRow('backend', qualityGate, undefined)).toBe(
      '| backend | ❌ ERROR | - | - | `?` ? BETWEEN ?<br>---<br>`?` ? ? ? | - |\n',
    );
  });

  test('falls back to placeholders for an issue missing its fields', () => {
    const qualityGate = JSON.stringify({
      projectStatus: { conditions: [], status: 'OK' },
    });
    const issues = JSON.stringify({ issues: [{}] });

    expect(sonarRow('backend', qualityGate, issues)).toBe(
      '| backend | ✅ Passed | - | - | - | `?` :? —  |\n',
    );
  });
});

describe('attachSonarRow', () => {
  test('reads both attached reports when present and writes the row', async () => {
    const qualityGate = JSON.stringify({
      projectStatus: { conditions: [], status: 'OK' },
    });
    const issues = JSON.stringify({ issues: [] });

    const directory = new FakeDirectory(world)
      .withFile('sonar-quality-gate.json', FakeFile.of(qualityGate))
      .withFile('sonar-issues.json', FakeFile.of(issues));

    const result = await attachSonarRow(directory, 'backend');

    await expect(result.file('sonar.row.md').contents()).resolves.toBe(
      '| backend | ✅ Passed | - | - | - | - |\n',
    );
  });

  test('falls back to the missing-report row when neither file is attached', async () => {
    const directory = new FakeDirectory(world);

    const result = await attachSonarRow(directory, 'backend');

    await expect(result.file('sonar.row.md').contents()).resolves.toBe(
      '| backend | _no report (scan failed or skipped)_ | | | | |\n',
    );
  });
});
