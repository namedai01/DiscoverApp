"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useApi } from "@/lib/api/context";
import { firebaseAuthMessage, normalizePhone } from "@/lib/auth/phone";
import type { PhoneAuth } from "@/lib/auth/types";
import { safeNext } from "@/lib/safe-next";

function codeOf(e: unknown): string {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : "";
}

const inputClass =
  "block w-full rounded-lg border border-neutral-300 px-3 py-2";
const buttonClass =
  "rounded-lg bg-accent px-4 py-2 font-medium text-neutral-900 disabled:opacity-50";

export function PhoneSignIn({
  phoneAuth,
  next,
}: {
  phoneAuth: PhoneAuth;
  next: string;
}) {
  const api = useApi();
  const router = useRouter();
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Drop a half-finished verification when leaving the page.
  useEffect(() => () => phoneAuth.reset(), [phoneAuth]);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const normalized = normalizePhone(phone);
    if ("error" in normalized) {
      setError(normalized.error);
      return;
    }
    const container = recaptchaRef.current;
    if (!container) return;
    setError(null);
    setBusy(true);
    try {
      await phoneAuth.sendCode(normalized.phone, container);
      setStep("code");
    } catch (err) {
      setError(firebaseAuthMessage(codeOf(err)));
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await phoneAuth.confirmCode(code.trim());
    } catch (err) {
      setError(firebaseAuthMessage(codeOf(err)));
      setBusy(false);
      return;
    }
    try {
      // The first authenticated call creates the profile, as on mobile.
      await api.getMe();
    } catch {
      // Best effort: pages that need the profile report their own errors.
    }
    router.replace(safeNext(next));
  }

  function useDifferentNumber() {
    phoneAuth.reset();
    setCode("");
    setError(null);
    setStep("phone");
  }

  return (
    <div className="space-y-3">
      {step === "phone" ? (
        <form onSubmit={sendCode} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Phone number</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+84 900 000 001"
              autoComplete="tel"
              className={inputClass}
            />
          </label>
          <button type="submit" disabled={busy} className={buttonClass}>
            Send code
          </button>
        </form>
      ) : (
        <form onSubmit={confirmCode} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Verification code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              className={inputClass}
            />
          </label>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy} className={buttonClass}>
              Verify
            </button>
            <button
              type="button"
              onClick={useDifferentNumber}
              disabled={busy}
              className="text-sm underline disabled:opacity-50"
            >
              Use a different number
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div ref={recaptchaRef} />
    </div>
  );
}
