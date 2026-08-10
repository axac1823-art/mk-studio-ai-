"use client";

import Link from "next/link";
import { CreditCard, LogOut, Settings, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { DbUser } from "@/lib/db/queries";

interface UserMenuProps {
  user: DbUser;
}

function getInitials(email: string): string {
  const name = email.split("@")[0] ?? "";
  return name.slice(0, 2).toUpperCase();
}

export function UserMenu({ user }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full"
          aria-label="User menu"
        >
          <Avatar className="h-8 w-8 border border-border">
            <AvatarFallback className="bg-surface text-xs font-medium text-foreground">
              {getInitials(user.email)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="text-sm font-medium text-foreground">Account</span>
          <span className="text-xs text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/settings" className="cursor-pointer">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/app/account" className="cursor-pointer">
            <User className="h-4 w-4" />
            Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/app/pricing" className="cursor-pointer">
            <CreditCard className="h-4 w-4" />
            Pricing
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/logout" className="cursor-pointer text-destructive focus:text-destructive">
            <LogOut className="h-4 w-4" />
            Sign out
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
