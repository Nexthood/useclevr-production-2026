import { redirect } from "next/navigation";

export default function BillingSettingsPage() {
  redirect("/app/settings/subscription?tab=billing");
}
