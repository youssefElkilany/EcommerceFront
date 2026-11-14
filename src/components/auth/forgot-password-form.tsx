"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Mail } from "lucide-react";
import { Field } from "./auth-form";
import { codeRequestSchema, codeResetSchema, type CodeRequestValues, type CodeResetValues } from "@/lib/auth-schema";

async function request(action: "passcode" | "resetcode", body: CodeRequestValues | CodeResetValues) {
  const response = await fetch("/api/auth/" + action, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Please try again.");
}

export function ForgotPasswordForm() {
  const [step, setStep] = useState<"email" | "reset" | "done">("email");
  const [email, setEmail] = useState("");
  const [resent, setResent] = useState(false);
  const emailForm = useForm<CodeRequestValues>({ resolver: zodResolver(codeRequestSchema), defaultValues: { email: "" }, mode: "onBlur" });
  const resetForm = useForm<CodeResetValues>({
    resolver: zodResolver(codeResetSchema), defaultValues: { email: "", otp: "", password: "", cPassword: "" }, mode: "onBlur",
  });
  const sendCode = useMutation({
    mutationFn: (values: CodeRequestValues) => request("passcode", values),
    onSuccess: (_, values) => {
      setEmail(values.email);
      resetForm.reset({ email: values.email, otp: "", password: "", cPassword: "" });
      setResent(step === "reset");
      setStep("reset");
    },
  });
  const resetPassword = useMutation({
    mutationFn: (values: CodeResetValues) => request("resetcode", values),
    onSuccess: () => { resetForm.reset(); setStep("done"); },
  });
  const pending = sendCode.isPending || resetPassword.isPending;
  const error = sendCode.error || resetPassword.error;
  const errorText = error instanceof TypeError ? "Connection lost. Check your internet and try again." : error?.message;

  if (step === "done") return <div className="auth-success" role="status">
    <div className="success-icon"><Check size={28} /></div>
    <span className="form-eyebrow">A FRESH START</span>
    <h2>Password updated.</h2>
    <p>You can now log in with your new password.</p>
    <Link href="/login" className="auth-submit">Back to login<ArrowRight size={18} /></Link>
  </div>;

  return <>
    <div className="form-intro">
      <div className="success-icon"><Mail size={27} /></div>
      <span className="form-eyebrow">{step === "email" ? "LET'S GET YOU BACK IN" : "CHECK YOUR INBOX"}</span>
      <h2>{step === "email" ? "Forgot your password?" : "Set a new password."}</h2>
      <p>{step === "email" ? "Enter your account email and we'll send you a 4-digit reset code." : <>Enter the code sent to <strong className="break-all">{email}</strong> and choose a new password.</>}</p>
    </div>
    <div className="mt-7">
      {step === "email" ? <form key="email" noValidate className="auth-form" onSubmit={emailForm.handleSubmit(values => { sendCode.reset(); sendCode.mutate(values); })}>
        <fieldset disabled={pending}>
          <Field label="Email address" name={emailForm.register("email")} type="email" autoComplete="email" placeholder="you@example.com" error={emailForm.formState.errors.email?.message} />
          {errorText && <p role="alert" className="form-error">{errorText}</p>}
          <button type="submit" className="auth-submit" disabled={pending}>{pending ? <><LoaderCircle className="animate-spin" size={18} />Sending code...</> : <>Send reset code<ArrowRight size={18} /></>}</button>
        </fieldset>
      </form> : <>
        <form key="reset" noValidate className="auth-form" onSubmit={resetForm.handleSubmit(values => { sendCode.reset(); resetPassword.mutate(values); })}>
          <fieldset disabled={pending}>
            <Field label="Reset code" name={resetForm.register("otp")} inputMode="numeric" autoComplete="one-time-code" placeholder="4-digit code" error={resetForm.formState.errors.otp?.message} />
            <Field label="New password" name={resetForm.register("password")} type="password" autoComplete="new-password" placeholder="Create a strong password" hint="8-64 characters, with uppercase, lowercase, a number, and a special character." error={resetForm.formState.errors.password?.message} />
            <Field label="Confirm new password" name={resetForm.register("cPassword")} type="password" autoComplete="new-password" placeholder="Enter your password again" error={resetForm.formState.errors.cPassword?.message} />
            {errorText && <p role="alert" className="form-error">{errorText}</p>}
            {resent && <p role="status" className="field-hint">A new code has been sent. Use the most recent code in your inbox.</p>}
            <button type="submit" className="auth-submit" disabled={pending}>{resetPassword.isPending ? <><LoaderCircle className="animate-spin" size={18} />Updating password...</> : <>Update password<ArrowRight size={18} /></>}</button>
          </fieldset>
        </form>
        <div className="mt-4 flex flex-wrap justify-between gap-2">
          <button type="button" className="text-button" disabled={pending} onClick={() => {
            resetPassword.reset(); setResent(false); sendCode.mutate({ email });
          }}>{sendCode.isPending ? "Sending..." : "Resend code"}</button>
          <button type="button" className="text-button" disabled={pending} onClick={() => {
            sendCode.reset(); resetPassword.reset(); resetForm.reset(); emailForm.reset({ email }); setResent(false); setStep("email");
          }}>Change email</button>
        </div>
        <p className="field-hint">Check your spam or junk folder if you don&apos;t see the email.</p>
      </>}
    </div>
    <p className="auth-switch"><Link href="/login"><ArrowLeft size={14} />Back to login</Link></p>
  </>;
}
