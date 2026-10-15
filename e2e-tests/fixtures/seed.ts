import type { APIResponse, Page } from '@playwright/test';
import { expect, readData } from './auth.fixture';

/**
 * API seeding shared by specs that need deterministic data.
 *
 * The auth fixture registers a BRAND-NEW organization per test, so every list
 * page starts empty. A spec that branches on "is there a row?" passes whether
 * or not the feature works; seeding the row instead makes the branch certain.
 *
 * Every helper here FAILS the test when the API refuses: a setup that silently
 * produces nothing is how the old suite turned whole blocks into no-ops.
 */

export const API = 'http://localhost:3000/api/v1';

/**
 * Any mutating request, carrying both credentials the middleware requires: the
 * bearer token AND the CSRF double-submit pair (`vizora_csrf_token` cookie +
 * `X-CSRF-Token` header). `apiPost` in the auth fixture is the POST-only form.
 */
export async function apiSend(
  page: Page,
  token: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  data?: Record<string, unknown>,
): Promise<APIResponse> {
  const cookies = await page.context().cookies();
  const csrf = cookies.find((c) => c.name === 'vizora_csrf_token')?.value ?? '';
  return page.request.fetch(path.startsWith('http') ? path : `${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf },
    ...(data ? { data } : {}),
  });
}

export async function apiGet<T = any>(page: Page, token: string, path: string): Promise<T> {
  const res = await page.request.get(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `GET ${path} failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  return readData<T>(res);
}

/** Send, assert 2xx, and unwrap the `{ success, data, meta }` envelope. */
async function sendOk<T = any>(
  page: Page,
  token: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  data?: Record<string, unknown>,
): Promise<T> {
  const res = await apiSend(page, token, method, path, data);
  expect(res.ok(), `${method} ${path} failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  return readData<T>(res);
}

const stamp = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export interface Seeded {
  id: string;
  name: string;
}

/** CreateDisplayDto takes { name, deviceId } and maps them to nickname / deviceIdentifier. */
export async function seedDisplay(
  page: Page,
  token: string,
  opts: { name?: string; status?: 'online' | 'offline' | 'error'; location?: string } = {},
): Promise<Seeded> {
  const s = stamp();
  const display = await sendOk(page, token, 'POST', '/displays', {
    name: opts.name ?? `E2E Display ${s}`,
    deviceId: `e2e-${s}`,
    location: opts.location ?? 'E2E Location',
    ...(opts.status ? { status: opts.status } : {}),
  });
  expect(display.id, 'created display must carry an id').toBeTruthy();
  return { id: display.id, name: display.nickname };
}

export async function seedContent(
  page: Page,
  token: string,
  opts: { name?: string; type?: 'image' | 'url' | 'video' } = {},
): Promise<Seeded> {
  const content = await sendOk(page, token, 'POST', '/content', {
    name: opts.name ?? `E2E Content ${stamp()}`,
    type: opts.type ?? 'image',
    url: 'https://example.com/e2e.jpg',
  });
  expect(content.id, 'created content must carry an id').toBeTruthy();
  return { id: content.id, name: content.name };
}

export async function seedPlaylist(
  page: Page,
  token: string,
  opts: { name?: string } = {},
): Promise<Seeded> {
  const playlist = await sendOk(page, token, 'POST', '/playlists', {
    name: opts.name ?? `E2E Playlist ${stamp()}`,
  });
  expect(playlist.id, 'created playlist must carry an id').toBeTruthy();
  return { id: playlist.id, name: playlist.name };
}

/**
 * A weekday 09:00-10:00 schedule targeting one display. `startTime`/`endTime`
 * are minutes from midnight; `daysOfWeek` is 0-6 from Sunday.
 */
export async function seedSchedule(
  page: Page,
  token: string,
  opts: { name: string; playlistId: string; displayId: string; isActive?: boolean },
): Promise<Seeded> {
  const schedule = await sendOk(page, token, 'POST', '/schedules', {
    name: opts.name,
    startDate: new Date().toISOString(),
    startTime: 9 * 60,
    endTime: 10 * 60,
    daysOfWeek: [1, 2, 3, 4, 5],
    playlistId: opts.playlistId,
    displayId: opts.displayId,
    isActive: opts.isActive ?? true,
  });
  expect(schedule.id, 'created schedule must carry an id').toBeTruthy();
  return { id: schedule.id, name: schedule.name };
}

export async function seedTag(
  page: Page,
  token: string,
  opts: { name?: string; color?: string } = {},
): Promise<Seeded> {
  const tag = await sendOk(page, token, 'POST', '/content/tags', {
    name: opts.name ?? `E2E Tag ${stamp()}`,
    ...(opts.color ? { color: opts.color } : {}),
  });
  expect(tag.id, 'created tag must carry an id').toBeTruthy();
  return { id: tag.id, name: tag.name };
}

export async function tagContent(
  page: Page,
  token: string,
  contentIds: string[],
  tagIds: string[],
): Promise<void> {
  await sendOk(page, token, 'POST', '/content/bulk/tags', { contentIds, tagIds, operation: 'add' });
}

export async function seedDisplayGroup(
  page: Page,
  token: string,
  opts: { name?: string; description?: string; displayIds?: string[] } = {},
): Promise<Seeded> {
  const group = await sendOk(page, token, 'POST', '/display-groups', {
    name: opts.name ?? `E2E Group ${stamp()}`,
    ...(opts.description ? { description: opts.description } : {}),
  });
  expect(group.id, 'created group must carry an id').toBeTruthy();
  if (opts.displayIds?.length) {
    await sendOk(page, token, 'POST', `/display-groups/${group.id}/displays`, { displayIds: opts.displayIds });
  }
  return { id: group.id, name: group.name };
}

export async function seedFolder(
  page: Page,
  token: string,
  opts: { name?: string; parentId?: string } = {},
): Promise<Seeded> {
  const folder = await sendOk(page, token, 'POST', '/folders', {
    name: opts.name ?? `E2E Folder ${stamp()}`,
    ...(opts.parentId ? { parentId: opts.parentId } : {}),
  });
  expect(folder.id, 'created folder must carry an id').toBeTruthy();
  return { id: folder.id, name: folder.name };
}

export async function moveContentToFolder(
  page: Page,
  token: string,
  folderId: string,
  contentIds: string[],
): Promise<void> {
  await sendOk(page, token, 'POST', `/folders/${folderId}/content`, { contentIds });
}

/**
 * Invite a member of the CURRENT org with `role`, then switch the browser
 * context to that member. Returns the member's token. The invite response
 * carries the generated temporary password, which is all a login needs.
 */
export async function signInAsNewMember(
  page: Page,
  adminToken: string,
  role: 'admin' | 'manager' | 'viewer',
): Promise<string> {
  const email = `e2e-${role}-${stamp()}@vizora.test`;
  const invited = await sendOk(page, adminToken, 'POST', '/users/invite', {
    email,
    firstName: 'E2E',
    lastName: role,
    role,
  });
  expect(invited.tempPassword, 'invite must return a temporary password').toBeTruthy();

  const login = await page.request.post(`${API}/auth/login`, {
    data: { email, password: invited.tempPassword },
  });
  expect(login.ok(), `member login failed: ${login.status()} ${await login.text()}`).toBeTruthy();
  const setCookie = login.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie');
  const token = setCookie
    .map((h) => h.value.match(/vizora_auth_token=([^;]+)/)?.[1])
    .find(Boolean);
  expect(token, 'login must set vizora_auth_token').toBeTruthy();

  await page.context().addCookies([
    {
      name: 'vizora_auth_token',
      value: token as string,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
  await page.evaluate((t) => localStorage.setItem('authToken', t), token as string);
  return token as string;
}

export async function patch<T = any>(
  page: Page,
  token: string,
  path: string,
  data: Record<string, unknown>,
): Promise<T> {
  return sendOk<T>(page, token, 'PATCH', path, data);
}
