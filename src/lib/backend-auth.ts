// Server-side only: preserve the backend prefix exactly, including spaces.
export function backendAuthorization(token: string): string {
  const prefix = process.env.BEARER_KEY;
  if (!prefix) throw new Error("The backend authorization prefix is not configured.");
  return prefix + token;
}

export function backendAuthFailure(message: unknown): { message: string; status: number } | null {
  if (typeof message !== "string") return null;
  if (/invalid bearer key/i.test(message)) return { message: "We could not authenticate with the store. Please try again.", status: 502 };
  if (/in-?valid token|jwt expired|jwt malformed|invalid signature|expired token|user not found/i.test(message)) return { message: "Your session expired. Log in to continue.", status: 401 };
  if (message === "u are not authorized") return { message: "Switch to a customer account to access this feature.", status: 403 };
  return null;
}
