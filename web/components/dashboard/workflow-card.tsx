"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

interface WorkflowCardProps {
  href: string;
  title: string;
  description: string;
  image: string;
  priority?: "primary" | "secondary";
}

export function WorkflowCard({
  href,
  title,
  description,
  image,
  priority = "primary",
}: WorkflowCardProps) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        <Image
          src={image}
          alt=""
          fill
          sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 92vw"
          className="object-cover transition-transform duration-200 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
        {priority === "primary" && (
          <span className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/35 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white/90 backdrop-blur-sm">
            Workflow
          </span>
        )}
        <span className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white/90 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
      <div className="space-y-1.5 px-3.5 py-3">
        <h3 className="text-sm font-semibold leading-tight">{title}</h3>
        <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
    </Link>
  );
}
