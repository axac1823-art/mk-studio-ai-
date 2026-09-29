export type ToolPreview =
  | {
      type: "image";
      src: string;
      alt: string;
    }
  | {
      type: "video";
      src: string;
      poster?: string;
      alt: string;
    };

/**
 * Visual previews shown only while hovering a tool.
 *
 * Recommended:
 * Download the assets into /public/tool-previews/
 * instead of depending on remote URLs in production.
 */
export const TOOL_PREVIEWS: Record<string, ToolPreview> = {
  "image-generator": {
    type: "image",
    src: "/tool-previews/image-generator.jpg",
    alt: "Modern architectural visualization",
  },

  "screenshot-to-render": {
    type: "image",
    src: "/tool-previews/screenshot-to-render.jpg",
    alt: "Architectural interior visualization",
  },

  "upscale": {
    type: "image",
    src: "/tool-previews/upscale.jpg",
    alt: "High resolution modern architecture",
  },

  "ambiance-change": {
    type: "image",
    src: "/tool-previews/ambiance-change.jpg",
    alt: "Modern interior atmosphere",
  },

  "image-to-3d": {
    type: "video",
    src: "/tool-previews/image-to-3d.mp4",
    poster: "/tool-previews/image-to-3d.jpg",
    alt: "Architecture transformed into a 3D visualization",
  },

  "text-to-3d": {
    type: "image",
    src: "/tool-previews/text-to-3d.jpg",
    alt: "3D architectural model",
  },

  "video-generator": {
    type: "video",
    src: "/tool-previews/video-generator.mp4",
    poster: "/tool-previews/video-generator.jpg",
    alt: "Architectural cinematic video",
  },

  "modify-video": {
    type: "video",
    src: "/tool-previews/modify-video.mp4",
    poster: "/tool-previews/modify-video.jpg",
    alt: "AI video transformation",
  },

  "background-remover": {
    type: "image",
    src: "/tool-previews/background-remover.jpg",
    alt: "Architectural object isolated from background",
  },

  "multi-angle": {
    type: "image",
    src: "/tool-previews/multi-angle.jpg",
    alt: "Multiple architectural camera angles",
  },
};