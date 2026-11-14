import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
export const metadata: Metadata = { title: "Seller signup | Dorytos" };
export default function SellerSignupPage() { return <AuthForm mode="signup" accountRole="seller" />; }
