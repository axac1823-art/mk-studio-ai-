import type { LucideIcon } from "lucide-react";
import {
  Camera,
  DoorOpen,
  Images,
  Map,
  Maximize,
  Maximize2,
  Mic,
  MonitorPlay,
  Scissors,
  Sun,
  Video,
  Wand2,
} from "lucide-react";

// Catalogue unique des outils IA du vertical architecture / archviz.
// Tous les libellés, descriptions, icônes et routes vivent ici pour éviter
// la duplication entre le popover, la future page "All tools" et le dashboard.

export type ToolCategory = "image" | "video" | "audio";

export interface ToolDefinition {
  id: string;
  category: ToolCategory;
  name: string;
  description: string;
  icon: LucideIcon;
  route: string;
}

export const TOOLS: ToolDefinition[] = [
  // --- Image ---
  {
    id: "screenshot-to-render",
    category: "image",
    name: "Screenshot-to-Render",
    description: "Turn 3D viewport captures into photorealistic renders",
    icon: Camera,
    route: "/app/ai-image-generator",
  },
  {
    id: "ambiance-change",
    category: "image",
    name: "Ambiance Change",
    description: "Change lighting, time of day, or season on an existing render",
    icon: Sun,
    route: "/app/ambiance-change",
  },
  {
    id: "exterior-to-interior",
    category: "image",
    name: "Exterior → Interior",
    description: "Generate a plausible interior view from an exterior render",
    icon: DoorOpen,
    route: "/app/exterior-to-interior",
  },
  {
    id: "plan-to-furnished-render",
    category: "image",
    name: "Plan → Furnished Render",
    description: "Turn a technical floor plan into a furnished, landscaped render",
    icon: Map,
    route: "/app/plan-to-render",
  },
  {
    id: "upscale",
    category: "image",
    name: "Upscale",
    description: "Enhance resolution and detail on any image result",
    icon: Maximize,
    route: "/app/upscale",
  },
  {
    id: "multi-angle",
    category: "image",
    name: "Multi-Angle",
    description: "Generate 2–3 coherent alternate camera angles from a render",
    icon: Images,
    route: "/app/multi-angle",
  },
  // --- Video ---
  {
    id: "video-generator",
    category: "video",
    name: "Video Generator",
    description: "Turn a render into a short presentation video",
    icon: Video,
    route: "/app/ai-video-generator",
  },
  {
    id: "video-upscaler",
    category: "video",
    name: "Video Upscaler",
    description: "Enhance resolution and detail on an existing video",
    icon: Maximize2,
    route: "/app/video-upscaler",
  },
  {
    id: "clip-editor",
    category: "video",
    name: "Clip Editor",
    description: "Trim, cut, and merge video clips",
    icon: Scissors,
    route: "/app/clip-editor",
  },
  {
    id: "video-project-editor",
    category: "video",
    name: "Video Project Editor",
    description: "Edit multi-clip video projects",
    icon: MonitorPlay,
    route: "/app/video-project-editor",
  },
  // --- Audio ---
  {
    id: "voice-generator",
    category: "audio",
    name: "Voice Generator",
    description: "Generate realistic voiceovers from text",
    icon: Mic,
    route: "/app/voice-generator",
  },
];

export const TOOL_CATEGORIES: Array<{
  id: ToolCategory;
  label: string;
}> = [
  { id: "image", label: "Image" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
];

export function toolsByCategory(category: ToolCategory): ToolDefinition[] {
  return TOOLS.filter((tool) => tool.category === category);
}

export function searchTools(query: string): ToolDefinition[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return TOOLS;
  return TOOLS.filter(
    (tool) =>
      tool.name.toLowerCase().includes(normalized) ||
      tool.description.toLowerCase().includes(normalized)
  );
}
