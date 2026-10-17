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
  let verifierHost: HTMLElement | null = null;
  let confirmation: ConfirmationResult | null = null;

  // An invisible verifier's clear() leaves its element behind, and Firebase
  // refuses to render twice into one element. So every verifier gets a fresh
  // child, and the container is emptied when the verifier is dropped.
  const clearVerifier = () => {
    verifier?.clear();
    verifier = null;
    verifierHost?.replaceChildren();
    verifierHost = null;
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
        const el = document.createElement("div");
        recaptchaContainer.replaceChildren(el);
        verifierHost = recaptchaContainer;
        try {
          verifier = new RecaptchaVerifier(auth, el, { size: "invisible" });
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
