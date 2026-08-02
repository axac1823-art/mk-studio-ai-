import { redirect } from "next/navigation";

// La landing page marketing arrive en dernier dans l'ordre de construction
// de la spec — pour l'instant, on va directement au studio.
export default function Home() {
  redirect("/app/dashboard");
}
