"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Image as ImageIcon,
  MoreHorizontal,
  Music2,
  Play,
  Plus,
  Trash2,
  Video,
} from "lucide-react";

import type { ProjectSummary } from "@/components/projects/project-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type ViewMode = "overview" | "projects" | "assets" | "favorites";

type RecentAsset = {
  id: string;
  projectId?: string | null;
  type: "image" | "video" | "audio" | "3d_model";
  url: string;
  isFavorite: boolean;
  generationId?: string | null;
  createdAt?: string;
};

function ProjectCover({
  project,
}: {