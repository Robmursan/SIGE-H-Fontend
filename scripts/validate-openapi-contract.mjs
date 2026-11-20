import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const contractPath = path.resolve(__dirname, '../contracts/sigeh-v1.json');

const EXPECTED_SHA256 =
  'ab9dd2a4b17806784c029ca16b79a4837542f83ac3ea3a0246cb6b50a18847f0';
const EXPECTED_OPERATIONS_COUNT = 21;
const REQUIRED_CONTRACT_PATHS = [
  { method: 'get', path: '/api/v1/pases-lista', operationId: 'listScopedAttendanceRoster' },
  {
    method: 'put',
    path: '/api/v1/programaciones/{programacionId}/asistencia',
    operationId: 'captureInitialAttendance',
  },
];
const HTTP_METHODS = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
  'trace',
]);

const raw = fs.readFileSync(contractPath);
const actualSha256 = crypto.createHash('sha256').update(raw).digest('hex');

if (actualSha256 !== EXPECTED_SHA256) {
  console.error(
    `FAIL: SHA-256 mismatch.\n  expected: ${EXPECTED_SHA256}\n  actual:   ${actualSha256}`,
  );
  process.exit(1);
}

const spec = JSON.parse(raw.toString('utf8'));
const operationIds = new Set();
const duplicateOperationIds = [];
let totalOperations = 0;

for (const [pathKey, pathItem] of Object.entries(spec.paths ?? {})) {
  for (const [method, operation] of Object.entries(pathItem ?? {})) {
    if (!HTTP_METHODS.has(method.toLowerCase())) continue;
    totalOperations += 1;
    const opId = operation?.operationId;
    if (!opId) {
      duplicateOperationIds.push(`MISSING:${method.toUpperCase()} ${pathKey}`);
    } else if (operationIds.has(opId)) {
      duplicateOperationIds.push(`DUPLICATE:${opId}`);
    } else {
      operationIds.add(opId);
    }
  }
}

function resolvePointer(root, pointer) {
  if (!pointer.startsWith('#/')) return undefined;
  const segments = pointer
    .slice(2)
    .split('/')
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
  let current = root;
  for (const segment of segments) {
    if (current && typeof current === 'object' && segment in current) {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

let totalRefs = 0;
const unresolvedRefs = [];

function walk(node, location = '#') {
  if (Array.isArray(node)) {
    node.forEach((item, idx) => walk(item, `${location}[${idx}]`));
  } else if (node && typeof node === 'object') {
    if (typeof node.$ref === 'string') {
      totalRefs += 1;
      if (resolvePointer(spec, node.$ref) === undefined) {
        unresolvedRefs.push({ location, ref: node.$ref });
      }
    }
    for (const [key, value] of Object.entries(node)) {
      walk(value, `${location}/${key}`);
    }
  }
}

walk(spec);

if (totalOperations !== EXPECTED_OPERATIONS_COUNT) {
  console.error(
    `FAIL: Expected ${EXPECTED_OPERATIONS_COUNT} operations, found ${totalOperations}`,
  );
  process.exit(1);
}

if (duplicateOperationIds.length > 0) {
  console.error('FAIL: Missing or duplicate operationId:', duplicateOperationIds);
  process.exit(1);
}

if (unresolvedRefs.length > 0) {
  console.error('FAIL: Unresolved $ref pointers:', unresolvedRefs);
  process.exit(1);
}

for (const reqOp of REQUIRED_CONTRACT_PATHS) {
  const foundOp = spec.paths?.[reqOp.path]?.[reqOp.method];
  if (!foundOp || foundOp.operationId !== reqOp.operationId) {
    console.error(
      `FAIL: Missing required operation ${reqOp.method.toUpperCase()} ${reqOp.path} (${reqOp.operationId})`,
    );
    process.exit(1);
  }
}

console.log(
  JSON.stringify(
    {
      status: 'PASS',
      openapi: spec.openapi,
      version: spec.info?.version,
      sha256: actualSha256,
      totalOperations,
      uniqueOperationIds: operationIds.size,
      totalRefs,
      unresolvedRefs: unresolvedRefs.length,
      totalSchemas: Object.keys(spec.components?.schemas ?? {}).length,
    },
    null,
    2,
  ),
);
