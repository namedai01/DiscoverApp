import type { AuthUser, FakeAuthClient } from "./types";

// Development only: loaded solely through the guarded import in ./index.
const STORAGE_KEY = "memopin.fakeUid";
const UID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function validateFakeUid(uid: string): string | null {
  return UID_PATTERN.test(uid) ? null : "Use 1–64 letters, digits, - or _.";
}

function read(storage: Storage): string | null {
  try {
    const uid = storage.getItem(STORAGE_KEY);
    return uid !== null && validateFakeUid(uid) === null ? uid : null;
  } catch {
    return null;
  }
}

function write(storage: Storage, uid: string | null) {
  try {
    if (uid === null) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, uid);
  } catch {
    // Storage can be blocked; the session then lasts until reload.
  }
}

export function createFakeAuthClient(
  storage: Storage = window.localStorage,
): FakeAuthClient {
  const listeners = new Set<(u: AuthUser | null) => void>();
  let uid = read(storage);

  const current = (): AuthUser | null => (uid ? { uid, phone: null } : null);
  const notify = () => {
    for (const cb of [...listeners]) cb(current());
  };

  return {
    subscribe(cb) {
      listeners.add(cb);
      cb(current());
      return () => {
        listeners.delete(cb);
      };
    },
    async getToken() {
      return uid ? `fake:${uid}:` : null;
    },
    async signOut() {
      uid = null;
      write(storage, null);
      notify();
    },
    signIn(next) {
      const problem = validateFakeUid(next);
      if (problem) throw new Error(problem);
      uid = next;
      write(storage, next);
      notify();
    },
  };
}
