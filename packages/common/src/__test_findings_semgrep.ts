// Scratch file for manually testing `dagger call semgrep`'s findings row.
// Not meant to be committed — delete (and `git restore --staged`) after testing.
// Both findings below are verified against the real ruleset this repo's
// semgrep() function loads (p/security-audit, p/owasp-top-ten, p/javascript,
// p/typescript, p/react) — no need to guess at new patterns.

import express from 'express';
import jwt from 'jsonwebtoken';

const app = express();

// javascript.express.security.audit.xss.direct-response-write.direct-response-write
app.get('/', (req, res) => {
  res.send(req.query.name);
});

// javascript.jsonwebtoken.security.jwt-hardcode.hardcoded-jwt-secret
app.get('/verify', (req, res) => {
  const decoded = jwt.verify(req.query.token as string, 'hardcoded-secret-key');
  res.json(decoded);
});
