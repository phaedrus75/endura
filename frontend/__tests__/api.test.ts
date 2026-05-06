/**
 * Tests for frontend/services/api.ts
 * FE-API-01 through FE-API-06 from the test plan.
 */

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import { authAPI, sessionsAPI, pushAPI } from '../services/api';

const mockGetItem = SecureStore.getItemAsync as jest.Mock;
const mockSetItem = SecureStore.setItemAsync as jest.Mock;

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

function mockOk(body: object) {
  return Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

function mockErr(body: object, status: number) {
  return Promise.resolve({
    ok: false, status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

describe('authAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue(null);
  });

  test('FE-API-01: login() sends no Authorization header (public endpoint)', async () => {
    mockFetch.mockReturnValue(mockOk({ access_token: 'test-jwt', token_type: 'bearer' }));
    mockSetItem.mockResolvedValue(undefined);

    await authAPI.login('user@example.com', 'password123');

    const [, options] = mockFetch.mock.calls[0];
    const headers = options?.headers ?? {};
    expect(headers['Authorization']).toBeUndefined();
  });

  test('login() stores JWT in SecureStore after success', async () => {
    mockFetch.mockReturnValue(mockOk({ access_token: 'returned-jwt', token_type: 'bearer' }));
    mockSetItem.mockResolvedValue(undefined);

    await authAPI.login('user@example.com', 'password123');
    expect(mockSetItem).toHaveBeenCalledWith('authToken', 'returned-jwt');
  });

  test('login() rejects on 401 error', async () => {
    mockFetch.mockReturnValue(mockErr({ detail: 'Invalid credentials' }, 401));

    await expect(authAPI.login('user@example.com', 'bad-password')).rejects.toBeDefined();
  });
});

describe('sessionsAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue('stored-jwt-token');
  });

  test('FE-API-02: completeSession() attaches Bearer token', async () => {
    mockFetch.mockReturnValue(mockOk({
      session: { id: 1, duration_minutes: 25, coins_earned: 30 },
      new_badges: [],
    }));

    await sessionsAPI.completeSession(25);

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['Authorization']).toBe('Bearer stored-jwt-token');
  });

  test('FE-API-05: completeSession() sends correct payload shape', async () => {
    mockFetch.mockReturnValue(mockOk({
      session: { id: 1, duration_minutes: 25, coins_earned: 30 },
      new_badges: [],
    }));

    await sessionsAPI.completeSession(25, undefined, undefined, 3);

    const [url, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.duration_minutes).toBe(25);
    expect(body.subject_id).toBe(3);
    expect(url).toContain('/sessions');
  });

  test('getSessions() attaches auth header', async () => {
    mockFetch.mockReturnValue(mockOk([]));

    await sessionsAPI.getSessions();

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['Authorization']).toBe('Bearer stored-jwt-token');
  });

  test('FE-API-04: Network error surfaces as thrown error', async () => {
    mockFetch.mockRejectedValue(new Error('Network request failed'));

    await expect(sessionsAPI.getSessions()).rejects.toThrow();
  });

  test('startSession() POSTs to /sessions/start with payload', async () => {
    mockFetch.mockReturnValue(mockOk({ session_id: 42, started_at: '2026-05-02T12:00:00Z' }));

    const resp = await sessionsAPI.startSession(25, 'Panda', 3);
    const [url, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(url).toContain('/sessions/start');
    expect(options.method).toBe('POST');
    expect(body.duration_minutes).toBe(25);
    expect(body.animal_name).toBe('Panda');
    expect(body.subject_id).toBe(3);
    expect(resp.session_id).toBe(42);
  });

  test('completeSessionById() targets /sessions/{id}/complete', async () => {
    mockFetch.mockReturnValue(mockOk({
      session: { id: 42, duration_minutes: 25, coins_earned: 30 },
      new_badges: [],
    }));

    await sessionsAPI.completeSessionById(42, 25, undefined, 'Panda', 3);
    const [url, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(url).toContain('/sessions/42/complete');
    expect(options.method).toBe('POST');
    expect(body.duration_minutes).toBe(25);
    expect(body.animal_name).toBe('Panda');
    expect(body.subject_id).toBe(3);
  });

  test('getPendingHatches() targets /me/pending-hatches with GET', async () => {
    mockFetch.mockReturnValue(mockOk({ pending: [] }));
    const resp = await sessionsAPI.getPendingHatches();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/me/pending-hatches');
    expect(options?.method ?? 'GET').toBe('GET');
    expect(resp.pending).toEqual([]);
  });

  test('hatchPendingSession() targets /sessions/{id}/hatch-pending with animal_name', async () => {
    mockFetch.mockReturnValue(mockOk({
      session: { id: 99, duration_minutes: 30, coins_earned: 30 },
      hatched_animal: { id: 1, name: 'Red Panda' },
      new_badges: [],
    }));
    await sessionsAPI.hatchPendingSession(99, 'Red Panda');
    const [url, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(url).toContain('/sessions/99/hatch-pending');
    expect(options.method).toBe('POST');
    expect(body.animal_name).toBe('Red Panda');
  });

  test('abandonSession() POSTs /sessions/{id}/abandon with no body', async () => {
    mockFetch.mockReturnValue(mockOk({ status: 'ok' }));
    const resp = await sessionsAPI.abandonSession(123);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/sessions/123/abandon');
    expect(options.method).toBe('POST');
    expect(options.body).toBeUndefined();
    expect(resp.status).toBe('ok');
  });

  test('apiFetch attaches HTTP status to error so callers can branch', async () => {
    mockFetch.mockReturnValue(mockErr({ detail: 'Session not found' }, 404));

    let caught: any = null;
    try {
      await sessionsAPI.completeSessionById(999, 25);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeTruthy();
    expect(caught.status).toBe(404);
    expect(caught.message).toBe('Session not found');
  });
});

describe('pushAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue('stored-jwt-token');
  });

  test('FE-API-06: registerToken() sends token and platform', async () => {
    mockFetch.mockReturnValue(mockOk({ ok: true }));

    await pushAPI.registerToken('ExponentPushToken[abc]', 'ios');

    const [url, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.token).toBe('ExponentPushToken[abc]');
    expect(body.platform).toBe('ios');
    expect(url).toContain('/users/me/push-token');
  });

  test('removeToken() sends DELETE request', async () => {
    mockFetch.mockReturnValue(mockOk({ ok: true }));

    await pushAPI.removeToken();

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('DELETE');
  });

  test('getPrefs() fetches notification prefs', async () => {
    mockFetch.mockReturnValue(mockOk({
      notification_enabled: true,
      notif_badges_enabled: true,
      notif_friends_enabled: true,
      notif_reminders_enabled: false,
      notif_marketing_enabled: true,
    }));

    const prefs = await pushAPI.getPrefs();
    expect(prefs.notif_reminders_enabled).toBe(false);
  });
});
