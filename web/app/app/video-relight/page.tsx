import { redirect } from "next/navigation";

export default function VideoRelightPage() {
  redirect("/app/ai-video-generator?mode=relight");
}
