import { redirect } from "next/navigation";

export default function FavoritesRedirect() {
  redirect("/app/projects?view=favorites");
}
