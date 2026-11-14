import { AuthShell } from "@/components/auth/auth-shell";
import "./auth.css";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
