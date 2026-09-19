import type { Directory } from '@dagger.io/dagger';

import { readArray, readNumber, readRecord, readScalarAsString, readString } from './json';

const SONAR_COMPARATORS: Record<string, string> = { EQ: '==', GT: '>', LT: '<', NE: '!=' };

const markdownCell = (text: string): string => text.replaceAll('\n', ' ').replaceAll('|', ' ');

const markdownList = (lines: string[], max = 10): string => {
  if (lines.length === 0) {
    return '-';
  }

  const shown = lines.slice(0, max);
  if (lines.length > max) {
    shown.push(`… +${lines.length - max} more`);
  }

  return shown.join('<br>---<br>');
};

const coverageRow = (shortName: string, summaryJson: string | undefined): string => {
  if (summaryJson === undefined) {
    return `| ${shortName} | _no coverage (tests failed or skipped)_ | | | |\n`;
  }

  const total = readRecord(readRecord(JSON.parse(summaryJson)).total);
  const pct = (key: string): string => {
    const value = readNumber(readRecord(total[key]).pct);
    return value === undefined ? '' : `${value}%`;
  };

  return `| ${shortName} | ${pct('lines')} | ${pct('statements')} | ${pct('functions')} | ${pct('branches')} |\n`;
};

const semgrepRow = (shortName: string, sarifJson: string | undefined): string => {
  if (sarifJson === undefined) {
    return `| ${shortName} | _no report (scan failed or skipped)_ | |\n`;
  }

  const runs = readArray(readRecord(JSON.parse(sarifJson)).runs);
  const results = readArray(readRecord(runs[0]).results);

  const lines = results.map((entry) => {
    const result = readRecord(entry);
    const ruleId = readString(result.ruleId) ?? '?';
    const location = readRecord(readArray(result.locations)[0]);
    const physicalLocation = readRecord(location.physicalLocation);
    const file = readString(readRecord(physicalLocation.artifactLocation).uri) ?? '?';
    const line = readNumber(readRecord(physicalLocation.region).startLine) ?? '?';
    const message = markdownCell(readString(readRecord(result.message).text) ?? '');
    return `\`${ruleId}\` ${file}:${line} — ${message}`;
  });

  return `| ${shortName} | ${results.length} | ${markdownList(lines)} |\n`;
};

const sonarRow = (
  shortName: string,
  qualityGateJson: string | undefined,
  issuesJson: string | undefined,
): string => {
  if (qualityGateJson === undefined) {
    return `| ${shortName} | _no report (scan failed or skipped)_ | | | | |\n`;
  }

  const projectStatus = readRecord(readRecord(JSON.parse(qualityGateJson)).projectStatus);
  const status = readString(projectStatus.status) ?? 'UNKNOWN';
  const conditions = readArray(projectStatus.conditions).map((entry) => readRecord(entry));

  const conditionValue = (metricKey: string): string | undefined => {
    const condition = conditions.find((entry) => readString(entry.metricKey) === metricKey);
    return condition === undefined ? undefined : readScalarAsString(condition.actualValue);
  };

  const newCoverage = conditionValue('new_coverage') ?? '-';
  const newViolations = conditionValue('new_violations') ?? '-';

  const gateDisplay = status === 'OK' ? '✅ Passed' : `❌ ${status}`;
  const failed = conditions
    .filter((entry) => readString(entry.status) !== 'OK')
    .map((entry) => {
      const metricKey = readString(entry.metricKey) ?? '?';
      const actualValue = readScalarAsString(entry.actualValue) ?? '?';
      const comparator = readString(entry.comparator) ?? '?';
      const errorThreshold = readScalarAsString(entry.errorThreshold) ?? '?';
      return `\`${metricKey}\` ${actualValue} ${SONAR_COMPARATORS[comparator] ?? comparator} ${errorThreshold}`;
    });
  const failedConditions =
    status === 'OK' || failed.length === 0 ? '-' : failed.join('<br>---<br>');

  let issues = '-';
  if (issuesJson !== undefined) {
    const issueLines = readArray(readRecord(JSON.parse(issuesJson)).issues).map((entry) => {
      const issue = readRecord(entry);
      const file = (readString(issue.component) ?? '').replace(/^[^:]*:/u, '');
      const line = readScalarAsString(issue.line) ?? '?';
      const message = markdownCell(readString(issue.message) ?? '');
      const rule = readString(issue.rule) ?? '?';
      return `\`${rule}\` ${file}:${line} — ${message}`;
    });
    issues = markdownList(issueLines);
  }

  return `| ${shortName} | ${gateDisplay} | ${newCoverage} | ${newViolations} | ${failedConditions} | ${issues} |\n`;
};

const attachSonarRow = async (result: Directory, shortName: string): Promise<Directory> => {
  const readAttached = async (name: string): Promise<string | undefined> => {
    try {
      return await result.file(name).contents();
    } catch {
      return undefined;
    }
  };

  const [qualityGateJson, issuesJson] = await Promise.all([
    readAttached('sonar-quality-gate.json'),
    readAttached('sonar-issues.json'),
  ]);

  return result.withNewFile('sonar.row.md', sonarRow(shortName, qualityGateJson, issuesJson));
};

export {
  attachSonarRow,
  coverageRow,
  markdownCell,
  markdownList,
  semgrepRow,
  SONAR_COMPARATORS,
  sonarRow,
};
