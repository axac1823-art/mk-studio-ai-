import type { LucideIcon } from "lucide-react";
import { Camera, DoorOpen, Images, Map, Maximize, Sun, Video } from "lucide-react";

// Catalogue unique des outils IA du vertical architecture / archviz.
// Tous les libellés, descriptions, icônes et routes vivent ici pour éviter
// la duplication entre le popover, la future page "All tools" et le dashboard.

export type ToolCategory = "image" | "video";

export interface ToolDefinition {
  id: string;
  category: ToolCategory;
  name: string;
  description: string;
  icon: LucideIcon;
  route: string;
}

export const TOOLS: ToolDefinition[] = [
  {
    id: "screenshot-to-render",
    category: "image",
    name: "Screenshot-to-Render",
    description: "Turn 3D viewport captures into photorealistic renders",
    icon: Camera,
    route: "/app/studio?tab=print_render",
  },
  {
    id: "ambiance-change",
    category: "image",
    name: "Ambiance Change",
    description: "Change lighting, time of day, or season on an existing render",
    icon: Sun,
    route: "/app/studio?tab=mood_swap",
  },
  {
    id: "exterior-to-interior",
    category: "image",
    name: "Exterior → Interior",
    description: "Generate a plausible interior view from an exterior render",
    icon: DoorOpen,
    route: "/app/studio?tab=exterior_to_interior",
  },
  {
    id: "plan-to-furnished-render",
    category: "image",
    name: "Plan → Furnished Render",
    description: "Turn a technical floor plan into a furnished, landscaped render",
    icon: Map,
    route: "/app/studio?tab=plan_to_render",
  },
  {
    id: "upscale",
    category: "image",
    name: "Upscale",
    description: "Enhance resolution and detail on any result",
    icon: Maximize,
    route: "/app/studio?tab=upscale",
  },
  {
    id: "multi-angle",
    category: "image",
    name: "Multi-Angle",
    description: "Generate 2–3 coherent alternate camera angles from a render",
    icon: Images,
    route: "/app/studio?tab=multi_angle",
  },
  {
    id: "video-generator",
    category: "video",
    name: "Video Generator",
    description: "Turn a render into a short presentation video",
    icon: Video,
    route: "/app/video",
  },
];

export const TOOL_CATEGORIES: Array<{
  id: ToolCategory;
  label: string;
}> = [
  { id: "image", label: "Image" },
  { id: "video", label: "Video" },
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
