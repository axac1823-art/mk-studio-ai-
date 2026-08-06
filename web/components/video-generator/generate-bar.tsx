"use client";

import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

interface GenerateBarProps {
  cost: number;
  hasEnoughCredits: boolean;
  balance: number | null;
  isBusy: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
}

export function GenerateBar({ cost, hasEnoughCredits, balance, isBusy, canGenerate, onGenerate }: GenerateBarProps) {
  return (
    <div className="flex flex-col gap-2">
      {!hasEnoughCredits && balance !== null && (
        <p role="alert" className="text-xs text-destructive">
          You don&apos;t have enough credits for this generation. {cost} credits required. You have {balance} credits.{" "}
          <a href="/app/billing" className="font-medium underline">
            Buy more credits
          </a>
        </p>
      )}
      <Button
        onClick={onGenerate}
        disabled={isBusy || !canGenerate || !hasEnoughCredits}
        className="w-full"
      >
        {isBusy ? (
          <>
            <Loader2 className="animate-spin" />
            Generating video…
          </>
        ) : (
          <>
            <Sparkles />
            Generate Video — {cost} credits
          </>
        )}
      </Button>
    </div>
  );
}
