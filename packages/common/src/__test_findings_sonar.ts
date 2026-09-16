// Scratch file for manually testing `dagger call sonar`'s findings row.
// Not meant to be committed — delete after testing.
// Unlike the semgrep sample, these patterns are NOT verified end-to-end here
// (that needs a live SonarQube token + local instance I don't have in this
// session) — they're well-established SonarJS/TS rule triggers, but treat
// this one as a starting point rather than a guarantee.

export const DB_PASSWORD = 'CorrectHorseBatteryStaple123!'; // hardcoded credential (S2068/S6418)

export function messyLogic(status: string, role: string, region: string): string {
  const unusedTotal = 0; // dead store, never read (S1854/S1481)

  if (status == 'active') {
    if (role == 'admin') {
      if (region == 'us') {
        return 'us-admin-active';
      } else if (region == 'eu') {
        return 'eu-admin-active';
      }
      return 'other-admin-active';
    } else if (role == 'editor') {
      if (region == 'us') {
        return 'us-editor-active';
      }
      return 'other-editor-active';
    }
  } else if (status == 'inactive') {
    return 'inactive';
  }

  return 'unknown';
}

export function parseMaybeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    // empty catch block (S108/S2486)
  }
  return undefined;
}

export function labelsForRegion(region: string): string {
  // "us-east-1" repeated 3+ times — duplicated string literal (S1192)
  if (region === 'us-east-1') {
    return 'us-east-1';
  }
  console.log('defaulting region to us-east-1');
  return 'us-east-1';
}
