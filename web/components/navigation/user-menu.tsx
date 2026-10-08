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
import { ThemeToggle } from "@/components/theme-toggle";
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