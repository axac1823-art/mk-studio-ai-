"use client";

// Image Generator — utilise désormais le workspace studio partagé, en
// premier onglet, pour une expérience cohérente avec les autres outils image.
import { ImageStudioWorkspace } from "@/components/studio/image-studio-workspace";

export default function ImageGeneratorPage() {
  return <ImageStudioWorkspace feature="text_to_image" showTabs />;
}
