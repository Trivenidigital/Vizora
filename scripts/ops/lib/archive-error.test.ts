import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyArchiveError } from './archive-error.js';

test('classifyArchiveError treats duplicate archive attempts as idempotent success', () => {
  assert.deepEqual(
    classifyArchiveError(new Error('API 409: Conflict - already archived')),
    { kind: 'already_archived' },
  );
});

test('classifyArchiveError treats missing archive endpoints as fatal contract drift', () => {
  assert.deepEqual(
    classifyArchiveError(new Error('API 405: Method Not Allowed - /content/abc/archive')),
    {
      kind: 'fatal',
      status: 405,
      message: 'API 405: Method Not Allowed - /content/abc/archive',
    },
  );
});

test('classifyArchiveError treats not-found archive attempts as benign races', () => {
  assert.deepEqual(
    classifyArchiveError(new Error('API 404: Not Found - content was deleted')),
    { kind: 'not_found' },
  );
});

test('classifyArchiveError treats missing archive routes as fatal contract drift', () => {
  assert.deepEqual(
    classifyArchiveError(
      new Error('API 404: Not Found - /content/abc/archive: {"message":"Cannot POST /api/v1/content/abc/archive"}'),
    ),
    {
      kind: 'fatal',
      status: 404,
      message: 'API 404: Not Found - /content/abc/archive: {"message":"Cannot POST /api/v1/content/abc/archive"}',
    },
  );
});

test('classifyArchiveError treats server errors as transient', () => {
  assert.deepEqual(
    classifyArchiveError(new Error('API 503: Service Unavailable')),
    {
      kind: 'transient',
      status: 503,
      message: 'API 503: Service Unavailable',
    },
  );
});
