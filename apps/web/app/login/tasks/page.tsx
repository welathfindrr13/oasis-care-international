import { redirect } from "next/navigation";

export default function ClerkTaskCompatibilityPage() {
  redirect("/session-tasks/choose-organization");
}
