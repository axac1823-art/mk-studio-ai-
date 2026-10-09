"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

interface CreditAlertProps {
  balance: number;
  threshold: number;
  compact?: boolean;
}

export function CreditAlert({ balance, threshold, compact = false }: CreditAlertProps) {
  if (balance > threshold) return null;

  return (
    <Link
      href="/pricing"
      title={"Low credits: " + balance + " left"}
      aria-label={"Low credits: " + balance + " left"}
      className={"flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-500 transition-colors hover:bg-amber-500/15 " + (compact ? "h-9 w-9 justify-center px-0 sm:h-auto sm:w-auto sm:justify-start sm:px-3" : "")}
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      <span className={compact ? "sr-only sm:not-sr-only" : "hidden md:inline"}>Low credits: {balance} left</span>
      {!compact && <span className="md:hidden">Low credits</span>}
    </Link>
  );
}
