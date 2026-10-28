export interface AuthFailure {
  status?: number;
  code?: string;
}

export type SignInOutcome = { kind: "email-not-verified" } | { kind: "error"; message: string };

/** Generic wording on purpose: we never reveal whether an email address has an account. */
export function describeSignInError(error: AuthFailure | null | undefined): SignInOutcome {
  if (error?.status === 429) {
    return { kind: "error", message: "Too many attempts. Please wait a minute and try again." };
  }
  if (error?.code === "EMAIL_NOT_VERIFIED") return { kind: "email-not-verified" };
  if (error?.code === "BANNED_USER") {
    return { kind: "error", message: "This account has been disabled. Please contact the team." };
  }
  if (error?.code === "INVALID_EMAIL_OR_PASSWORD") {
    return { kind: "error", message: "Incorrect email or password." };
  }
  return { kind: "error", message: "We couldn't sign you in. Please try again." };
}

export function describeCodeError(error: AuthFailure | null | undefined): string {
  if (error?.status === 429) return "Too many attempts. Please wait a minute and try again.";
  if (error?.code === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE") return "Too many wrong codes. Sign in again to continue.";
  if (error?.code === "INVALID_TWO_FACTOR_COOKIE") return "Your sign-in session expired. Please sign in again.";
  return "That code didn't work. Check the code and try again.";
}