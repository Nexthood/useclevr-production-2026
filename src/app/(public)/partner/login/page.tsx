import { redirect } from "next/navigation";
export default function PartnerLogin() {
  redirect("/login?callbackUrl=%2Fpartner");
}
