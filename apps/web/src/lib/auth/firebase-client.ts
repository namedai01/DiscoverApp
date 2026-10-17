import {
  RecaptchaVerifier,
  getAuth,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
} from "firebase/auth";
import { getFirebaseApp } from "@/lib/firebase";
import type { FirebaseAuthClient } from "./types";

export function createFirebaseAuthClient(): FirebaseAuthClient {
  const auth = getAuth(getFirebaseApp());
  let verifier: RecaptchaVerifier | null = null;
  let confirmation: ConfirmationResult | null = null;

  const clearVerifier = () => {
    verifier?.clear();
    verifier = null;
  };

  return {
    subscribe: (cb) =>
      onAuthStateChanged(auth, (user) =>
        cb(user ? { uid: user.uid, phone: user.phoneNumber } : null),
      ),
    getToken: async (forceRefresh) =>
      auth.currentUser ? auth.currentUser.getIdToken(forceRefresh) : null,
    signOut: () => signOut(auth),
    phone: {
      async sendCode(phoneE164, recaptchaContainer) {
        // Created per send, not on mount, so a failed attempt starts clean.
        clearVerifier();
        confirmation = null;
        verifier = new RecaptchaVerifier(auth, recaptchaContainer, {
          size: "invisible",
        });
        try {
          confirmation = await signInWithPhoneNumber(
            auth,
            phoneE164,
            verifier,
          );
        } catch (e) {
          clearVerifier();
          throw e;
        }
      },
      async confirmCode(code) {
        if (!confirmation) throw new Error("Request a code first.");
        await confirmation.confirm(code);
        clearVerifier();
        confirmation = null;
      },
      reset() {
        clearVerifier();
        confirmation = null;
      },
    },
  };
}
