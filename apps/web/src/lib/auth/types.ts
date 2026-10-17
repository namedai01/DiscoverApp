export type AuthUser = { uid: string; phone: string | null };

export interface AuthClient {
  // Calls `cb` with the current user as soon as it is known, then on changes.
  subscribe(cb: (u: AuthUser | null) => void): () => void;
  getToken(forceRefresh: boolean): Promise<string | null>;
  signOut(): Promise<void>;
}

export interface PhoneAuth {
  sendCode(phoneE164: string, recaptchaContainer: HTMLElement): Promise<void>;
  confirmCode(code: string): Promise<void>;
  reset(): void;
}

export type FakeAuthClient = AuthClient & { signIn(uid: string): void };
export type FirebaseAuthClient = AuthClient & { phone: PhoneAuth };
