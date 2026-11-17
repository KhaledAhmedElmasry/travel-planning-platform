// Swagger (docs/api/openapi.yaml) must describe what the API really does (PDF 7.1, 13.1: the
// backend is evaluated through Swagger UI). Every other system test file records each real
// response it received; this file runs last and checks:
//   - every status code a real response had is documented for that operation;
//   - every JSON body matches its documented schema (types, required fields, enums, and no field
//     that the documentation does not mention);
//   - every success response with a JSON body has a documented schema;
//   - when the whole suite ran, every documented operation was called at least once;
//   - every multipart PATCH form starts empty in Swagger UI (FLT-01, HTL-01).
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  documentedOperations,
  prefilledPatchFormFields,
} from '../support/openapi-contract';

interface Recorded {
  problems: { operation: string; status: number; problem: string }[];
  called: Record<string, number[]>;
}

describe('docs/api/openapi.yaml matches the running API', () => {
  const dir = process.env.SYSTEST_WORKDIR as string;
  const files = readdirSync(dir).filter((f) => /^contract-.+\.json$/.test(f));
  const recorded = files.map(
    (f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Recorded,
  );
  const otherSuites = readdirSync(__dirname).filter(
    (f) => f.endsWith('.system-spec.ts') && !f.startsWith('zz-'),
  ).length;

  it('every real response matches its documented status code and schema', () => {
    const problems = recorded
      .flatMap((r) => r.problems)
      .map((p) => `${p.operation} -> ${p.status}: ${p.problem}`);
    expect([...new Set(problems)].sort()).toEqual([]);
  });

  it('every multipart PATCH form starts empty in Swagger UI, so only typed fields are sent', () => {
    expect(prefilledPatchFormFields()).toEqual([]);
  });

  it('every documented operation was exercised by the system tests', () => {
    if (files.length < otherSuites) {
      // Only part of the suite ran (a single file was selected): coverage is not measured.
      return;
    }
    const called = new Set(recorded.flatMap((r) => Object.keys(r.called)));
    const missing = documentedOperations().filter((op) => !called.has(op));
    expect(missing).toEqual([]);
  });
});
