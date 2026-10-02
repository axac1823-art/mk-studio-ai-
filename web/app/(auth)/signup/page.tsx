import { Suspense } from "react";
import { LoginModal } from "@/components/auth/login-modal";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <LoginModal standalone initialMode="signup" />
    </Suspense>
  );
}
