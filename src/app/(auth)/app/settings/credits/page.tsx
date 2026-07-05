import { redirect } from "next/navigation";

export default function CreditRulesSettingsPage() {
  redirect("/app/settings/subscription?tab=usage");
}
