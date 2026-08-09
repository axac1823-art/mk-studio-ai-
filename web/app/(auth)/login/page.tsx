import { Suspense } from "react";

import { LoginModal } from "@/components/auth/login-modal";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginModal standalone />
    </Suspense>
  );
}
