// TEMPORARY — for local semgrep testing only. Delete this file before committing.
// Ignored by fmt/lint/type-check-adjacent tooling (see dagger/vite.config.ts and
// vite.config.ts) and excluded from coverage, since it exists only to trip
// Semgrep's p/security-audit, p/owasp-top-ten, p/javascript, p/typescript, and
// p/react rulesets — the exact ones wired into SEMGREP_RULESETS.
//
// NOTE: plain eval()/exec()/hardcoded-secret/weak-hash patterns did NOT fire
// against these specific packs without extra framework context (verified
// empirically against semgrep/semgrep:1.177.0). The patterns below were
// confirmed to reliably trigger with zero extra dependencies: Express-style
// req/res handlers are matched structurally by name/shape, not by a real
// `express` import.

import * as https from 'node:https';

interface FakeRequest {
  query: Record<string, string>;
}

interface FakeResponse {
  send: (body: unknown) => void;
  sendFile: (path: string) => void;
  redirect: (url: string) => void;
}

interface FakeApp {
  get: (path: string, handler: (req: FakeRequest, res: FakeResponse) => void) => void;
}

declare const app: FakeApp;

// Insecure transport: TLS verification disabled (problem-based-packs.insecure-transport)
export function insecureTlsRequest(): void {
  https.request({ hostname: 'example.com', rejectUnauthorized: false }, () => {});
}

// Path traversal via res.sendFile (javascript.express.security.audit)
app.get('/file', (req, res) => {
  res.sendFile(req.query.path);
});

// Open redirect (javascript.express.security.audit)
app.get('/redirect', (req, res) => {
  res.redirect(req.query.url);
});

// Reflected XSS: direct response write + raw HTML formatting (javascript.express.security)
app.get('/render', (req, res) => {
  res.send(`<h1>${req.query.name}</h1>`);
});
