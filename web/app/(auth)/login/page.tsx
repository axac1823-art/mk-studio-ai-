import { Suspense } from "react";

import { LoginModal } from "@/components/auth/login-modal";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginModal standalone initialMode="login" />
    </Suspense>
  );
}
