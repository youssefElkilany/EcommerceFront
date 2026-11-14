"use client";

import Link from "next/link";
import { z } from "zod";
import { useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Check, Eye, EyeOff, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { loginSchema, signupSchema, type SignupValues } from "@/lib/auth-schema";

import {useAuthSession} from './auth-session';
type Values = SignupValues;
type AuthFormProps={mode:'login'|'signup';accountRole?:'customer'|'seller'};
export function Field({ label, name, error, type = "text", autoComplete, placeholder, hint, optional, inputMode }: {
  label: string; name: UseFormRegisterReturn; error?: string; type?: string; autoComplete?: string; placeholder?: string; hint?: string; optional?: boolean; inputMode?: "numeric" | "text";
}) {
  const [visible, setVisible] = useState(false);
  const password = type === "password";
  return <div className="form-field">
    <label htmlFor={name.name}>{label}{optional && <span className="optional-label">Optional</span>}</label>
    <div className="input-wrap">
      <input {...name} id={name.name} type={password && visible ? "text" : type} autoComplete={autoComplete}
        inputMode={inputMode} placeholder={placeholder} aria-invalid={!!error} aria-describedby={error ? name.name + "-error" : hint ? name.name + "-hint" : undefined} className={password ? "password-input" : ""} />
      {password && <button type="button" className="password-toggle" onClick={() => setVisible(!visible)} aria-label={visible ? "Hide " + label.toLowerCase() : "Show " + label.toLowerCase()} aria-pressed={visible}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
    </div>
    {error ? <p className="field-error" id={name.name + "-error"}>{error}</p> : hint && <p className="field-hint" id={name.name + "-hint"}>{hint}</p>}
  </div>;
}

async function authenticate(mode: "login" | "signup", values: Values, accountRole: "customer" | "seller") {
  const body = mode === "login" ? { email: values.email, password: values.password } : values;
  const response = await fetch("/api/auth/" + (mode === "signup" && accountRole === "seller" ? "seller-signup" : mode), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
}

export function AuthForm(props:AuthFormProps){
  const {revision}=useAuthSession();
  return <AuthFormContent key={props.mode+':'+(props.accountRole||'customer')+':'+revision} {...props}/>;
}
function AuthFormContent({mode,accountRole='customer'}:AuthFormProps){
  const signup = mode === "signup";
  const {clearAccountData,signOut}=useAuthSession();
  // The signup shape keeps shared fields stable; login only validates email/password.
  const schema = signup ? signupSchema : loginSchema.extend({ name: z.string(), phone: z.string(), cPassword: z.string() });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", password: "", cPassword: "" },
    mode: "onBlur",
  });
  const mutation = useMutation({ mutationFn: (values: Values) => authenticate(mode, values, accountRole), onSuccess: async () => { if (mode === "login") await clearAccountData(); reset(); } });
  const [logoutError, setLogoutError] = useState("");
  const [nextPath, setNextPath] = useState("/");
  const [loggingOut, setLoggingOut] = useState(false);

  if (mutation.isSuccess) return <div className="auth-success" role="status">
    <div className="success-icon">{signup ? <Mail size={28} /> : <Check size={28} />}</div>
    <span className="form-eyebrow">{signup ? "ONE LAST STEP" : "YOU'RE ALL SET"}</span>
    <h2>{signup ? "Check your inbox." : "Welcome to Dorytos."}</h2>
    <p>{signup ? "Your account has been created. Open the confirmation email and follow the link to activate your account, then come back to log in." : "You're signed in and ready for your next discovery."}</p>
    {signup && <p className="field-hint">Can’t find it? Take a look in your spam or junk folder.</p>}
    <Link href={signup ? "/login?next=" + encodeURIComponent(nextPath) : nextPath} className="auth-submit">{signup ? "Continue to login" : "Back to store"}<ArrowRight size={18} /></Link>
    {!signup && <button type="button" className="text-button" disabled={loggingOut} onClick={async () => {
      setLoggingOut(true); setLogoutError("");
      try { await signOut(); }
      catch { setLogoutError("Couldn't sign out. Please try again."); } finally { setLoggingOut(false); }
    }}>{loggingOut ? "Signing out…" : "Sign out"}</button>}
    {logoutError && <p role="alert" className="form-error">{logoutError}</p>}
  </div>;

  return <>
    <div className="form-intro">
      <span className="form-eyebrow">{signup ? "YOUR NEXT CHAPTER STARTS HERE" : "GOOD TO SEE YOU AGAIN"}</span>
      <h2>{signup ? (accountRole === "seller" ? "Start selling with Dorytos." : "Join the discovery.") : "Welcome back."}</h2>
      <p>{signup ? "Create your Dorytos account. Let’s find your favorites." : "Log in to your Dorytos account and pick up where you left off."}</p>
    </div>
    <nav className="auth-tabs" aria-label="Account access"><Link href="/login" aria-current={!signup ? "page" : undefined}>Log in</Link><Link href="/signup" aria-current={signup && accountRole === "customer" ? "page" : undefined}>Customer signup</Link><Link href="/signup/seller" aria-current={signup && accountRole === "seller" ? "page" : undefined}>Seller signup</Link></nav>
    <form noValidate onSubmit={handleSubmit(values => { const candidate = new URLSearchParams(window.location.search).get("next"); if (candidate?.startsWith("/") && !candidate.startsWith("//")) setNextPath(candidate); mutation.mutate(values); })} className="auth-form">
      <fieldset disabled={mutation.isPending}>
        {signup && <Field label="Full name" name={register("name")} error={errors.name?.message} autoComplete="name" placeholder="Your full name" />}
        <Field label="Email address" name={register("email")} error={errors.email?.message} type="email" autoComplete="email" placeholder="you@example.com" />
        {signup && <Field label="Phone number" optional name={register("phone")} error={errors.phone?.message} type="tel" autoComplete="tel" placeholder="01001234567" hint="11 digits, without a country code or spaces." />}
        <Field label="Password" name={register("password")} error={errors.password?.message} type="password" autoComplete={signup ? "new-password" : "current-password"} placeholder={signup ? "Create a strong password" : "Enter your password"} hint={signup ? "8–64 characters, with uppercase, lowercase, a number, and a special character." : undefined} />
        {!signup && <Link href="/forgot-password" className="justify-self-end text-xs font-semibold text-sky-700">Forgot password?</Link>}
        {signup && <Field label="Confirm password" name={register("cPassword")} error={errors.cPassword?.message} type="password" autoComplete="new-password" placeholder="Enter your password again" />}
        {mutation.isError && <p className="form-error" role="alert">{mutation.error instanceof TypeError ? "Connection lost. Check your internet and try again." : mutation.error.message}</p>}
        <button className="auth-submit" type="submit" disabled={mutation.isPending}>{mutation.isPending ? <><LoaderCircle className="animate-spin" size={18} />{signup ? "Creating your account…" : "Logging in…"}</> : <>{signup ? (accountRole === "seller" ? "Create seller account" : "Create customer account") : "Log in"}<ArrowRight size={18} /></>}</button>
      </fieldset>
    </form>
    {!signup && <p className="confirmation-note">New here? Confirm your email after signing up to activate your account.</p>}
    <p className="auth-switch">{signup ? "Already part of Dorytos?" : "Your first visit?"} <Link href={signup ? "/login" : "/signup"}>{signup ? "Log in" : "Create an account"}<ArrowRight size={13} /></Link></p>
    <div className="privacy-note"><ShieldCheck size={16} /><span>Your next discovery starts with you.</span></div>
  </>;
}





