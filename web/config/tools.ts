import type { LucideIcon } from "lucide-react";
import {
  Box,
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

export type ToolCategory = "image" | "video" | "audio" | "3d";

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
    id: "image-generator",
    category: "image",
    name: "Image Generator",
    description: "Generate photorealistic architectural images from a text prompt",
    icon: Wand2,
    route: "/app/image-generator",
  },
  {
    id: "screenshot-to-render",
    category: "image",
    name: "Screenshot-to-Render",
    description: "Turn 3D viewport captures into photorealistic renders",
    icon: Camera,
    route: "/app/ai-image-generator",
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
    id: "ambiance-change",
    category: "image",
    name: "Ambiance Change",
    description: "Change lighting, time of day, or season on an existing render",
    icon: Sun,
    route: "/app/ambiance-change",
  },
  {
    id: "image-extender",
    category: "image",
    name: "Image Extender",
    description: "Expand the canvas and fill new areas consistently with the original image",
    icon: Maximize,
    route: "/app/image-extender",
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
    id: "multi-angle",
    category: "image",
    name: "Multi-Angle",
    description: "Generate 2–3 coherent alternate camera angles from a render",
    icon: Images,
    route: "/app/multi-angle",
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
    id: "variations",
    category: "image",
    name: "Variations",
    description: "Generate alternate versions of a result with similar style and composition",
    icon: Images,
    route: "/app/variations",
  },
  {
    id: "background-remover",
    category: "image",
    name: "Background Remover",
    description: "Isolate the subject and remove the background as a transparent PNG",
    icon: Scissors,
    route: "/app/background-remover",
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
    id: "modify-video",
    category: "video",
    name: "Modify Video",
    description: "Transform an existing video with a text prompt",
    icon: Wand2,
    route: "/app/ai-video-generator?mode=video_to_video",
  },
  {
    id: "video-relight",
    category: "video",
    name: "Video Relight",
    description: "Change lighting and time of day on an existing video",
    icon: Sun,
    route: "/app/video-relight",
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
    name: "Concatenate Video",
    description: "Concatenate multi-clip video projects",
    icon: MonitorPlay,
    route: "/app/video-project-editor",
  },
  {
    id: "lip-sync",
    category: "video",
    name: "Lip Sync",
    description: "Synchronize a person's mouth movement with an audio track",
    icon: Mic,
    route: "/app/lip-sync",
  },
  // --- 3D ---
  {
    id: "image-to-3d",
    category: "3d",
    name: "Image-to-3D",
    description: "Generate a 3D model from up to 6 orthographic views",
    icon: Box,
    route: "/app/3d-generator",
  },
  {
    id: "text-to-3d",
    category: "3d",
    name: "Text-to-3D",
    description: "Generate a 3D model from a text description",
    icon: Box,
    route: "/app/text-to-3d",
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
  { id: "3d", label: "3D" },
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
