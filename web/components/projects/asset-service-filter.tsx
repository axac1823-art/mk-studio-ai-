"use client";

interface ServiceOption {
  id: string;
  label: string;
  types: Array<"image" | "video" | "audio">;
}

const SERVICES: ServiceOption[] = [
  { id: "text_to_image", label: "Image Generator", types: ["image"] },
  { id: "print_render", label: "Render", types: ["image"] },
  { id: "mood_swap", label: "Mood", types: ["image"] },
  { id: "exterior_to_interior", label: "Exterior to Interior", types: ["image"] },
  { id: "plan_to_render", label: "Plan to Render", types: ["image"] },
  { id: "multi_angle", label: "Multi-Angle", types: ["image"] },
  { id: "upscale", label: "Image Upscale", types: ["image"] },
  { id: "image_extender", label: "Image Extender", types: ["image"] },
  { id: "variations", label: "Image Variations", types: ["image"] },
  { id: "background_remover", label: "Background Remover", types: ["image"] },
  { id: "text_to_video", label: "Text to Video", types: ["video"] },
  { id: "image_to_video", label: "Image to Video", types: ["video"] },
  { id: "start_end_frame", label: "Start + End Frame", types: ["video"] },
  { id: "multi_reference", label: "Multi-Reference Video", types: ["video"] },
  { id: "multi_shot", label: "Multi-Shot Video", types: ["video"] },
  { id: "video_to_video", label: "Modify Video", types: ["video"] },
  { id: "relight", label: "Video Relight", types: ["video"] },
  { id: "video_upscale", label: "Video Speed", types: ["video"] },
  { id: "video_edit_trim", label: "Clip Editor: Trim", types: ["video"] },
  { id: "video_edit_speed", label: "Clip Editor: Speed", types: ["video"] },
  { id: "video_edit_overlay", label: "Clip Editor: Text Overlay", types: ["video"] },
  { id: "video_edit_export", label: "Clip Editor: Export", types: ["video"] },
  { id: "video_edit_concat", label: "Video Project Editor", types: ["video"] },
  { id: "voice_generator", label: "Voice Generator", types: ["audio"] },
];

interface AssetServiceFilterProps {
  type: "all" | "image" | "video" | "audio";
  value: string;
  onChange: (value: string) => void;
}

export function AssetServiceFilter({ type, value, onChange }: AssetServiceFilterProps) {
  const options = SERVICES.filter((service) => type === "all" || service.types.includes(type));

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      Created with
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border bg-background px-3 text-sm text-foreground"
      >
        <option value="all">All services</option>
        {options.map((service) => <option key={service.id} value={service.id}>{service.label}</option>)}
      </select>
    </label>
  );
}
