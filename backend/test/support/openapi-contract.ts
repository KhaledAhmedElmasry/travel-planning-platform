// Checks real HTTP responses against docs/api/openapi.yaml (the document Swagger UI shows).
//
// Every response a system test receives goes through checkResponse(): the status code must be
// documented for that operation and, when the documentation gives a JSON schema for it, the body
// must match the schema: right types, required fields present, enum values, and no field the
// documentation does not mention.
import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import { join } from 'path';

type Json = unknown;
interface Schema {
  $ref?: string;
  type?: string;
  nullable?: boolean;
  enum?: Json[];
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  allOf?: Schema[];
  oneOf?: Schema[];
  anyOf?: Schema[];
  additionalProperties?: boolean | Schema;
  format?: string;
  example?: unknown;
}
interface Operation {
  responses: Record<
    string,
    { $ref?: string; content?: Record<string, { schema?: Schema }> }
  >;
}
interface OpenApiDocument {
  paths: Record<string, Record<string, Operation>>;
  components: Record<string, Record<string, unknown>>;
}

const DOCUMENT = load(
  readFileSync(
    join(__dirname, '..', '..', '..', 'docs', 'api', 'openapi.yaml'),
    'utf8',
  ),
) as OpenApiDocument;

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function resolve<T extends { $ref?: string }>(node: T): T {
  let current = node;
  for (let i = 0; current?.$ref && i < 20; i++) {
    current = current.$ref
      .replace(/^#\//, '')
      .split('/')
      .reduce<unknown>(
        (value, key) => (value as Record<string, unknown>)[key],
        DOCUMENT,
      ) as T;
  }
  return current;
}

interface Route {
  method: string;
  template: string;
  pattern: RegExp;
  staticParts: number;
  operation: Operation;
}

const ROUTES: Route[] = Object.entries(DOCUMENT.paths).flatMap(
  ([template, item]) =>
    METHODS.filter((method) => item[method]).map((method) => ({
      method,
      template,
      pattern: new RegExp(
        `^${template.replace(/\{[^}]+\}/g, '[^/]+').replace(/\//g, '\\/')}$`,
      ),
      staticParts: template.split('/').filter((part) => !part.startsWith('{'))
        .length,
      operation: item[method],
    })),
);

/** The documented operations, e.g. "GET /api/flights/{id}". */
export function documentedOperations(): string[] {
  return ROUTES.map(
    (route) => `${route.method.toUpperCase()} ${route.template}`,
  );
}

/**
 * Fields of multipart PATCH forms that Swagger UI would pre-fill with a sample value. "Try it out"
 * sends every field of a multipart form, and Swagger UI fills each one from that property's
 * example (or a generated sample such as "string"), so every field of an edit form needs an empty
 * example ('' or []); otherwise a TA who fills one field also sends sample values for all the
 * others (FLT-01, HTL-01). File fields are never pre-filled.
 */
export function prefilledPatchFormFields(): string[] {
  return ROUTES.filter((route) => route.method === 'patch').flatMap((route) => {
    const body = (
      route.operation as {
        requestBody?: { content?: Record<string, { schema?: Schema }> };
      }
    ).requestBody;
    const form = body?.content?.['multipart/form-data']?.schema;
    if (!form) return [];
    const properties = resolve(form).properties ?? {};
    return Object.entries(properties)
      .filter(([, property]) => {
        const field = resolve(property);
        const file =
          field.format === 'binary' ||
          resolve(field.items ?? {}).format === 'binary';
        const empty =
          field.example === '' ||
          (Array.isArray(field.example) && field.example.length === 0);
        return !file && !empty;
      })
      .map(([name]) => `PATCH ${route.template} ${name}`);
  });
}

function findRoute(method: string, path: string): Route | undefined {
  const clean = path.split('?')[0];
  return ROUTES.filter(
    (route) =>
      route.method === method.toLowerCase() && route.pattern.test(clean),
  ).sort((a, b) => b.staticParts - a.staticParts)[0];
}

function typeOf(value: Json): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number';
  }
  return typeof value;
}

/** The property names a schema documents (through allOf / oneOf / anyOf too). */
function documentedProperties(schema: Schema, into = new Set<string>()) {
  const resolved = resolve(schema);
  for (const key of Object.keys(resolved.properties ?? {})) into.add(key);
  for (const part of [
    ...(resolved.allOf ?? []),
    ...(resolved.oneOf ?? []),
    ...(resolved.anyOf ?? []),
  ]) {
    documentedProperties(part, into);
  }
  return into;
}

function allowsAnyProperty(schema: Schema): boolean {
  const resolved = resolve(schema);
  if (
    resolved.additionalProperties !== undefined &&
    resolved.additionalProperties !== false
  ) {
    return true;
  }
  const parts = [
    ...(resolved.allOf ?? []),
    ...(resolved.oneOf ?? []),
    ...(resolved.anyOf ?? []),
  ];
  if (parts.some(allowsAnyProperty)) return true;
  // An object schema without any documented property describes nothing, so it cannot be checked.
  return documentedProperties(resolved).size === 0;
}

/** Returns the list of mismatches between a value and a schema (empty = it matches). */
export function validate(
  schemaNode: Schema,
  value: Json,
  at = 'body',
  checkExtra = true,
): string[] {
  const schema = resolve(schemaNode);
  if (!schema) return [];
  if (value === null) {
    if (schema.nullable || schema.type === undefined) return [];
    return [`${at}: null is not documented as allowed`];
  }
  const problems: string[] = [];

  if (schema.allOf) {
    for (const part of schema.allOf) {
      problems.push(...validate(part, value, at, false));
    }
  }
  for (const alternatives of [schema.oneOf, schema.anyOf]) {
    if (!alternatives) continue;
    const results = alternatives.map((part) => validate(part, value, at));
    if (!results.some((result) => result.length === 0)) {
      problems.push(
        `${at}: matches none of the documented alternatives (${results
          .map((result) => result[0])
          .join(' | ')})`,
      );
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    problems.push(
      `${at}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`,
    );
  }

  const actual = typeOf(value);
  if (schema.type) {
    const matches =
      schema.type === actual ||
      (schema.type === 'number' && actual === 'integer');
    if (!matches) {
      problems.push(`${at}: expected ${schema.type}, got ${actual}`);
      return problems;
    }
  }

  if (actual === 'array' && schema.items) {
    (value as Json[]).forEach((item, index) => {
      problems.push(...validate(schema.items!, item, `${at}[${index}]`));
    });
  }

  if (actual === 'object') {
    const object = value as Record<string, Json>;
    for (const key of schema.required ?? []) {
      if (!(key in object)) problems.push(`${at}.${key}: required, missing`);
    }
    for (const [key, propertySchema] of Object.entries(
      schema.properties ?? {},
    )) {
      if (key in object && object[key] !== undefined) {
        problems.push(...validate(propertySchema, object[key], `${at}.${key}`));
      }
    }
    if (
      typeof schema.additionalProperties === 'object' &&
      schema.additionalProperties
    ) {
      for (const [key, item] of Object.entries(object)) {
        if (!(key in (schema.properties ?? {}))) {
          problems.push(
            ...validate(schema.additionalProperties, item, `${at}.${key}`),
          );
        }
      }
    }
    if (checkExtra && !allowsAnyProperty(schema)) {
      const documented = documentedProperties(schema);
      for (const key of Object.keys(object)) {
        if (!documented.has(key)) {
          problems.push(`${at}.${key}: returned but not documented`);
        }
      }
    }
  }
  return problems;
}

export interface ContractProblem {
  operation: string;
  status: number;
  problem: string;
}

const problems: ContractProblem[] = [];
const seen = new Map<string, Set<number>>();

/** Records what the documentation says about one real response. */
export function checkResponse(
  method: string,
  path: string,
  status: number,
  body: Json,
  isJson: boolean,
): void {
  if (!path.startsWith('/api/') || path.startsWith('/api/docs')) return;
  const route = findRoute(method, path);
  const name = route
    ? `${method.toUpperCase()} ${route.template}`
    : `${method.toUpperCase()} ${path.split('?')[0]}`;
  const add = (problem: string) => {
    if (
      !problems.some(
        (p) =>
          p.operation === name && p.status === status && p.problem === problem,
      )
    ) {
      problems.push({ operation: name, status, problem });
    }
  };
  if (!route) {
    // An unknown URL answering 404 is not an operation; anything else is undocumented.
    if (status !== 404) add('this route is not in openapi.yaml');
    return;
  }
  if (!seen.has(name)) seen.set(name, new Set());
  seen.get(name)!.add(status);

  const response = route.operation.responses[String(status)];
  if (!response) {
    add(`status ${status} is not documented for this operation`);
    return;
  }
  const content = resolve(response).content;
  const schema = content?.['application/json']?.schema;
  if (status >= 200 && status < 300 && status !== 204 && isJson) {
    if (!schema) {
      add('the success response has no documented JSON schema');
      return;
    }
  }
  if (schema && isJson) {
    for (const problem of validate(schema, body)) add(problem);
  }
}

export function contractProblems(): ContractProblem[] {
  return [...problems];
}

/** The operations (and status codes) the tests of this run really called. */
export function calledOperations(): Map<string, Set<number>> {
  return seen;
}
