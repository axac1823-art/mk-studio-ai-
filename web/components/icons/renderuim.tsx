import * as React from "react";
import { cn } from "@/lib/utils";

interface RenderuimLogoProps extends React.SVGProps<SVGSVGElement> {
  showWordmark?: boolean;
  wordmarkClassName?: string;
}

export function RenderuimLogo({
  className,
  showWordmark = false,
  wordmarkClassName,
  ...props
}: RenderuimLogoProps) {
  return (
    <div className={cn("flex items-center gap-2", showWordmark ? "" : "inline-flex")}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        fill="none"
        className={cn("h-8 w-8", className)}
        {...props}
      >
        <defs>
          <linearGradient id="ru-gradient" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
        {/* Outer frame / viewport */}
        <rect
          x="2"
          y="2"
          width="28"
          height="28"
          rx="7"
          stroke="url(#ru-gradient)"
          strokeWidth="2"
          opacity="0.25"
        />
        {/* Stylized R / perspective frame */}
        <path
          d="M9 23V9h6c2.8 0 5 2.2 5 5s-2.2 5-5 5h-2l7 6"
          stroke="url(#ru-gradient)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* 3D floor line */}
        <path
          d="M9 23h14"
          stroke="url(#ru-gradient)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.6"
        />
      </svg>
      {showWordmark && (
        <span
          className={cn(
            "text-lg font-semibold tracking-tight text-foreground",
            wordmarkClassName
          )}
        >
          Renderuim
        </span>
      )}
    </div>
  );
}
