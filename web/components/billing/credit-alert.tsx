"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

interface CreditAlertProps {
  balance: number;
  threshold: number;
}

export function CreditAlert({ balance, threshold }: CreditAlertProps) {
  if (balance > threshold) return null;

  return (
    <Link
      href="/app/pricing"
      className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-500 transition-colors hover:bg-amber-500/15"
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      <span className="hidden md:inline">Low credits: {balance} left</span>
      <span className="md:hidden">Low credits</span>
    </Link>
  );
}
