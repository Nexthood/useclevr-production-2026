"use client";

import {
  Activity,
  Bot,
  CreditCard,
  ReceiptText,
  ShieldCheck,
  SlidersHorizontal,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/app/settings/profile", label: "Profile", icon: User },
  { href: "/app/settings/preferences", label: "Preferences", icon: SlidersHorizontal },
  { href: "/app/settings/ai-providers", label: "AI Providers", icon: Bot },
  { href: "/app/settings/subscription", label: "Subscription", icon: CreditCard },
  { href: "/app/settings/activity", label: "Activity", icon: Activity },
  { href: "/app/settings/billing", label: "Billing", icon: ReceiptText },
];

const adminItems = [
  { href: "/app/settings/payment", label: "Payment", icon: CreditCard },
  { href: "/app/settings/credits", label: "Credit Rules", icon: ShieldCheck },
  { href: "/app/settings/total-activity", label: "Total Activity", icon: Activity },
];

export function SettingsNav({ showAdmin = false }: { showAdmin?: boolean }) {
  const pathname = usePathname();
  const visibleItems = showAdmin ? [...items, ...adminItems] : items;

  return (
    <div className="border-b border-border bg-background px-5">
      <nav className="flex min-h-12 gap-1 overflow-x-auto" aria-label="Account sections">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
