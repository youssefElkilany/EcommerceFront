import { z } from "zod";

const email = z.string().trim().email("Enter a valid email address.").transform(value => value.toLowerCase());
export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});
export const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name."),
  email,
  phone: z.string().trim().refine(value => !value || /^[0-9]{11}$/.test(value), "Enter an 11-digit phone number, e.g. 01001234567 (no country code or spaces)."),
  password: z.string().min(8, "Use at least 8 characters.").max(64, "Use no more than 64 characters.")
    .regex(/[a-z]/, "Add a lowercase letter.").regex(/[A-Z]/, "Add an uppercase letter.")
    .regex(/[0-9]/, "Add a number.").regex(/[^a-zA-Z0-9]/, "Add a special character."),
  cPassword: z.string().min(1, "Confirm your password."),
}).refine(values => values.password === values.cPassword, { path: ["cPassword"], message: "Passwords do not match." });

export type LoginValues = z.input<typeof loginSchema>;
export type SignupValues = z.input<typeof signupSchema>;

export const codeRequestSchema = z.object({ email });
export const codeResetSchema = z.object({
  email,
  otp: z.string().trim().regex(/^[0-9]{4}$/, "Enter the 4-digit code from your email."),
  password: signupSchema.shape.password,
  cPassword: signupSchema.shape.cPassword,
}).refine(values => values.password === values.cPassword, { path: ["cPassword"], message: "Passwords do not match." });
export type CodeRequestValues = z.input<typeof codeRequestSchema>;
export type CodeResetValues = z.input<typeof codeResetSchema>;
