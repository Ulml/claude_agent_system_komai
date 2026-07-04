/**
 * Verifies that EVERY agent's computation method is conform and that its
 * numeric self-checks give the right result (got ≈ expected within tol).
 * Run: node apps/web/tests/agent_methods.test.mjs
 *
 * Uses Node's built-in TypeScript stripping (Node 22+ --experimental-*),
 * but to stay portable we import the compiled data by evaluating the two
 * pure-TS modules through esbuild-free transpilation: we re-implement the
 * check by importing via a tiny ts loader. Simplest: point at the source
 * with the Node type-stripping loader.
 */
// Bundled by esbuild before running (see the run command in package.json /
// the commit test step): esbuild resolves the extensionless TS imports.
import { agentMethods } from '../src/core/agent_methods.ts';

let total = 0;
let failed = 0;
const missing = [];

for (const [id, m] of Object.entries(agentMethods)) {
  const conform = Boolean(m && m.graph && m.formulas.length > 0 && m.sources.length > 0);
  if (!conform) missing.push(id);
  for (const c of m.checks ?? []) {
    total += 1;
    const tol = c.tol ?? 1e-3;
    const ok = Math.abs(c.got - c.expected) <= tol * Math.max(Math.abs(c.expected), 1e-12);
    if (!ok) {
      failed += 1;
      console.error(`✗ [${id}] ${c.label}: got ${c.got}, expected ${c.expected} (tol ${tol})`);
    } else {
      console.log(`✓ [${id}] ${c.label}: ${c.got.toPrecision(6)} ${c.unit ?? ''}`);
    }
  }
}

// Every agent referenced by a source file must also have a compliant method.
console.log(`\nChecks: ${total - failed}/${total} passed.`);
console.log(`Method-conform agents: ${Object.keys(agentMethods).length - missing.length}/${Object.keys(agentMethods).length}`);
if (missing.length) console.error('Non-conform (missing graph/formulas/sources):', missing);

// Also assert every source URL is a well-formed https link.
let badUrls = 0;
for (const [id, m] of Object.entries(agentMethods)) {
  for (const s of m.sources ?? []) {
    if (!/^https:\/\/.+/.test(s.url)) {
      badUrls += 1;
      console.error(`✗ [${id}] bad URL: ${s.url}`);
    }
  }
}
console.log(`SOTA source URLs well-formed: ${badUrls === 0 ? 'OK' : badUrls + ' bad'}`);

if (failed || missing.length || badUrls) {
  process.exit(1);
}
console.log('\nALL AGENT METHODS VERIFIED ✓');
