const E164 = /^\+[1-9]\d{7,14}$/;

export function normalizePhone(
  input: string,
): { phone: string } | { error: string } {
  const compact = input.replace(/[\s\-().]/g, "");
  if (!compact.startsWith("+")) {
    return { error: "Include the country code, e.g. +84 900 000 001." };
  }
  if (!E164.test(compact)) return { error: "That phone number isn't valid." };
  return { phone: compact };
}

export function firebaseAuthMessage(code: string): string {
  switch (code) {
    case "auth/invalid-verification-code":
      return "That code is incorrect.";
    case "auth/code-expired":
      return "That code has expired. Request a new one.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes and try again.";
    case "auth/invalid-phone-number":
      return "That phone number isn't valid.";
    case "auth/network-request-failed":
      return "Network error. Check your connection.";
    default:
      return "Sign-in failed. Try again.";
  }
}
