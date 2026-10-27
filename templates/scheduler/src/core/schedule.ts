interface Field {
  name: string;
  min: number;
  max: number;
  names?: readonly string[];
}

const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

const fields: readonly Field[] = [
  { max: 59, min: 0, name: 'minute' },
  { max: 23, min: 0, name: 'hour' },
  { max: 31, min: 1, name: 'day of month' },
  { max: 12, min: 1, name: 'month' },
  { max: 6, min: 0, name: 'day of week', names: weekdays },
];

const itemPattern = /^(?<range>\*|[0-9A-Z]+(?:-[0-9A-Z]+)?)(?:\/(?<step>[1-9]\d*))?$/u;

const stepOnSingleValue = /^[0-9A-Z]+\//u;

const valueOf = (token: string, field: Field) => {
  if (field.names !== undefined) {
    const index = field.names.indexOf(token);
    return index === -1 ? undefined : index;
  }
  if (!/^\d+$/u.test(token)) {
    return undefined;
  }
  const value = Number(token);
  return value >= field.min && value <= field.max ? value : undefined;
};

const describeField = (field: Field) =>
  field.names === undefined
    ? `${field.name} must be *, ${field.min}-${field.max}, a range or a list; /step only after * or a range`
    : `${field.name} must be * or ${field.names.join('|')} (names only: Kubernetes counts 0-6 from Sunday, Cloudflare 1-7)`;

const checkField = (text: string, field: Field): string | undefined => {
  for (const item of text.split(',')) {
    const groups = itemPattern.exec(item)?.groups;
    if (groups === undefined || stepOnSingleValue.test(item)) {
      return describeField(field);
    }
    const { range } = groups;
    if (range === '*') {
      continue;
    }
    const [start, end = start] = range.split('-').map((token) => valueOf(token, field));
    if (start === undefined || end === undefined || start > end) {
      return describeField(field);
    }
  }
  return undefined;
};

const checkSchedule = (expression: string): string | undefined => {
  const parts = expression.split(' ');
  const shape = `expected ${fields.length} space-separated fields (minute hour day-of-month month day-of-week)`;
  if (parts.length !== fields.length) {
    return shape;
  }
  for (const [index, part] of parts.entries()) {
    const reason = checkField(part, fields[index]);
    if (reason !== undefined) {
      return reason;
    }
  }
  if (parts[2] !== '*' && parts[4] !== '*') {
    return 'restrict day of month or day of week, not both (how the two combine is not portable)';
  }
  return undefined;
};

export {
  checkField,
  checkSchedule,
  describeField,
  fields,
  itemPattern,
  stepOnSingleValue,
  valueOf,
  weekdays,
};
export type { Field };
