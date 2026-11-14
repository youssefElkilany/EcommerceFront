import { NextRequest, NextResponse } from "next/server";
import { loginSchema, signupSchema, codeRequestSchema, codeResetSchema } from "@/lib/auth-schema";

const cookieName = "dorytos_session";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (!["login", "signup", "seller-signup", "logout", "passcode", "resetcode"].includes(action)) return json({ message: "Not found." }, 404);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ message: "Request not allowed." }, 403);
  if (action === "logout") {
    const response = json({ message: "Signed out." });
    response.cookies.set(cookieName, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
    return response;
  }
  let body: unknown;
  try { body = await request.json(); } catch { return json({ message: "Invalid request." }, 400); }
  const schema = action === "login" ? loginSchema : action === "passcode" ? codeRequestSchema : action === "resetcode" ? codeResetSchema : signupSchema;
  const result = schema.safeParse(body);
  if (!result.success) return json({ message: result.error.issues[0]?.message ?? "Check your details." }, 400);
  const base = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "")).replace(/\/+$/, "");
  if (!base) return json({ message: "Sign-in is temporarily unavailable." }, 503);
  try {
    const payload = { ...result.data };
    if ("phone" in payload && !payload.phone) delete (payload as { phone?: string }).phone;
    const upstream = await fetch(`${base}/auth/${action === "seller-signup" ? "seller/signup" : action}`, {
      method: action === "passcode" || action === "resetcode" ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      if (upstream.status === 400 && data.message === "Validation Error" && Array.isArray(data.validationErr)) {
        // Map field names only: Joi context/messages can contain submitted passwords.
        const labels: Record<string, string> = {
          name: "Enter your full name.",
          email: "Enter a valid email address.",
          phone: "Enter an 11-digit phone number, e.g. 01001234567 (no country code or spaces).",
          password: "Use 8-64 characters with uppercase, lowercase, a number, and a special character.",
          cPassword: "Passwords must match.",
          otp: "Enter the 4-digit code from your email.",
        };
        const messages = data.validationErr.flatMap((issue: { path?: unknown }) => {
          const key = Array.isArray(issue?.path) ? issue.path[0] : undefined;
          return typeof key === "string" && Object.hasOwn(labels, key) ? [labels[key]] : [];
        });
        return json({ message: [...new Set(messages)].join(" ") || "Check your details and try again." }, 400);
      }
      const message = typeof data.msgError === "string" ? data.msgError : typeof data.message === "string" ? data.message : "We couldn't complete your request.";
      // Keep internal database/stack errors out of the browser.
      const known: Record<string, string> = {
        "email already exist": "An account with this email already exists. Try logging in.",
        "email not found": action === "passcode" || action === "resetcode" ? "We couldn't reset this account. Check the email address and try again." : "We couldn't sign you in. Check your details and confirm your email first.",
        "wrong OTP": "That code is incorrect. Try again or request a new code.",
        "password mismatch": "Passwords must match.",
        "wrong password": "We couldn't sign you in. Check your details and confirm your email first.",
      };
      return json({ message: known[message] ?? "We couldn't complete your request. Please try again." }, upstream.status >= 500 ? 503 : 400);
    }
    if (action === "passcode") return json({ message: "Reset code sent. Check your email." });
    if (action === "resetcode") {
      const response = json({ message: "Password updated. Log in with your new password." });
      response.cookies.set(cookieName, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
      return response;
    }
    if (action === "signup" || action === "seller-signup") return json({ message: "Account created. Check your email to confirm your account." }, 201);
    if (typeof data.token !== "string" || !data.token) return json({ message: "Sign-in is temporarily unavailable." }, 502);
    const response = json({ message: "You're signed in.", role: data.role });
    response.cookies.set(cookieName, data.token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/",
      // Session cookie: Express remains responsible for token validation/expiry.
    });
    return response;
  } catch {
    return json({ message: "We couldn't reach the store. Please try again in a moment." }, 503);
  }
}

