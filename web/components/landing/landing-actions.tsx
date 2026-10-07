"use client";

import dynamic from "next/dynamic";
import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

const LoginModal = dynamic(() =>
  import("@/components/auth/login-modal").then((mod) => mod.LoginModal)
);

export function LandingActions({
  initialLogin,
  initialSignup,
}: {
  initialLogin: boolean;
  initialSignup: boolean;
}) {
  const router = useRouter();

  const openLogin = useCallback(() => {
    router.push("/?login=true", { scroll: false });
  }, [router]);

  const openSignup = useCallback(() => {
    router.push("/?login=true&mode=signup", { scroll: false });
  }, [router]);

  return (
    <>
      <Button variant="ghost" onClick={openLogin}>
        Log in
      </Button>
      <Button onClick={openSignup}>Sign up</Button>
      {initialLogin ? (
        <LoginModal
          initialMode={initialSignup ? "signup" : "login"}
          onClose={() => router.push("/", { scroll: false })}
        />
      ) : null}
    </>
  );
}
