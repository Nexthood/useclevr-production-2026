import type { SupportedUsyLanguage } from "./types";

export type UsyActionId =
  | "OPEN_PROFILE"
  | "OPEN_PREFERENCES"
  | "OPEN_AI_PROVIDERS"
  | "OPEN_AI_ACTIVITY"
  | "OPEN_DATA_CONNECTIONS"
  | "OPEN_SUBSCRIPTION"
  | "OPEN_BILLING"
  | "OPEN_AI_CREDITS"
  | "OPEN_TERMS"
  | "OPEN_DATASETS"
  | "OPEN_REPORTS"
  | "OPEN_DASHBOARD"
  | "OPEN_UPLOAD"
  | "OPEN_CLEVRSYNC"
  | "OPEN_AI_ASSISTANT"
  | "OPEN_RETAIL"
  | "OPEN_ACCOUNTANCY"
  | "OPEN_AI_GOVERNANCE"
  | "OPEN_SUPPORT"
  | "CONTACT_SALES"
  | "CONTACT_BILLING"
  | "CONTACT_SUPPORT"
  | "CONTACT_MANAGEMENT";

export type UsyAction = {
  id: UsyActionId;
  route: string;
  requiresAuth: boolean;
  requiresRole?: "admin" | "superadmin";
};

export const usyActionRegistry: Record<UsyActionId, UsyAction> = {
  OPEN_PROFILE: {
    id: "OPEN_PROFILE",
    route: "/app/settings/profile",
    requiresAuth: true,
  },
  OPEN_PREFERENCES: {
    id: "OPEN_PREFERENCES",
    route: "/app/settings/preferences",
    requiresAuth: true,
  },
  OPEN_AI_PROVIDERS: {
    id: "OPEN_AI_PROVIDERS",
    route: "/app/settings/ai-providers",
    requiresAuth: true,
  },
  OPEN_AI_ACTIVITY: {
    id: "OPEN_AI_ACTIVITY",
    route: "/app/settings/ai-activity",
    requiresAuth: true,
  },
  OPEN_DATA_CONNECTIONS: {
    id: "OPEN_DATA_CONNECTIONS",
    route: "/app/settings/data-connections",
    requiresAuth: true,
  },
  OPEN_SUBSCRIPTION: {
    id: "OPEN_SUBSCRIPTION",
    route: "/app/settings/subscription",
    requiresAuth: true,
  },
  OPEN_BILLING: {
    id: "OPEN_BILLING",
    route: "/app/settings/subscription?tab=billing",
    requiresAuth: true,
  },
  OPEN_AI_CREDITS: {
    id: "OPEN_AI_CREDITS",
    route: "/app/settings/subscription?tab=usage",
    requiresAuth: true,
  },
  OPEN_TERMS: {
    id: "OPEN_TERMS",
    route: "/app/settings/subscription?tab=terms",
    requiresAuth: true,
  },
  OPEN_DATASETS: {
    id: "OPEN_DATASETS",
    route: "/app/datasets",
    requiresAuth: true,
  },
  OPEN_REPORTS: {
    id: "OPEN_REPORTS",
    route: "/app/reports",
    requiresAuth: true,
  },
  OPEN_DASHBOARD: {
    id: "OPEN_DASHBOARD",
    route: "/app/dashboard",
    requiresAuth: true,
  },
  OPEN_UPLOAD: {
    id: "OPEN_UPLOAD",
    route: "/app/upload",
    requiresAuth: true,
  },
  OPEN_CLEVRSYNC: {
    id: "OPEN_CLEVRSYNC",
    route: "/app/settings/data-connections",
    requiresAuth: true,
  },
  OPEN_AI_ASSISTANT: {
    id: "OPEN_AI_ASSISTANT",
    route: "/app/assistant/hybrid",
    requiresAuth: true,
  },
  OPEN_RETAIL: {
    id: "OPEN_RETAIL",
    route: "/app/retail",
    requiresAuth: true,
  },
  OPEN_ACCOUNTANCY: {
    id: "OPEN_ACCOUNTANCY",
    route: "/app/accountancy",
    requiresAuth: true,
  },
  OPEN_AI_GOVERNANCE: {
    id: "OPEN_AI_GOVERNANCE",
    route: "/app/admin/ai-governance",
    requiresAuth: true,
    requiresRole: "admin",
  },
  OPEN_SUPPORT: {
    id: "OPEN_SUPPORT",
    route: "/app/settings/activity",
    requiresAuth: true,
  },
  CONTACT_SALES: {
    id: "CONTACT_SALES",
    route: "contact",
    requiresAuth: false,
  },
  CONTACT_BILLING: {
    id: "CONTACT_BILLING",
    route: "contact",
    requiresAuth: false,
  },
  CONTACT_SUPPORT: {
    id: "CONTACT_SUPPORT",
    route: "contact",
    requiresAuth: false,
  },
  CONTACT_MANAGEMENT: {
    id: "CONTACT_MANAGEMENT",
    route: "contact",
    requiresAuth: false,
  },
};

export type UsyActionButton = {
  actionId: UsyActionId;
  label: string;
  type: "navigation" | "contact" | "conversation";
};

const actionLabels: Record<SupportedUsyLanguage, Record<UsyActionId, string>> = {
  english: {
    OPEN_PROFILE: "Open profile",
    OPEN_PREFERENCES: "Open preferences",
    OPEN_AI_PROVIDERS: "Open AI providers",
    OPEN_AI_ACTIVITY: "Open AI activity",
    OPEN_DATA_CONNECTIONS: "Open data connections",
    OPEN_SUBSCRIPTION: "Open subscription",
    OPEN_BILLING: "Open billing",
    OPEN_AI_CREDITS: "Open AI credits",
    OPEN_TERMS: "Open terms",
    OPEN_DATASETS: "Open datasets",
    OPEN_REPORTS: "Open reports",
    OPEN_DASHBOARD: "Open dashboard",
    OPEN_UPLOAD: "Open upload",
    OPEN_CLEVRSYNC: "Open ClevrSync",
    OPEN_AI_ASSISTANT: "Open AI Assistant",
    OPEN_RETAIL: "Open retail",
    OPEN_ACCOUNTANCY: "Open accountancy",
    OPEN_AI_GOVERNANCE: "Open AI governance",
    OPEN_SUPPORT: "Open support",
    CONTACT_SALES: "Contact Sales",
    CONTACT_BILLING: "Contact Billing",
    CONTACT_SUPPORT: "Contact Support",
    CONTACT_MANAGEMENT: "Contact Management",
  },
  german: {
    OPEN_PROFILE: "Profil öffnen",
    OPEN_PREFERENCES: "Einstellungen öffnen",
    OPEN_AI_PROVIDERS: "AI-Provider öffnen",
    OPEN_AI_ACTIVITY: "AI-Aktivität öffnen",
    OPEN_DATA_CONNECTIONS: "Datenverbindungen öffnen",
    OPEN_SUBSCRIPTION: "Abonnement öffnen",
    OPEN_BILLING: "Billing öffnen",
    OPEN_AI_CREDITS: "AI-Credits öffnen",
    OPEN_TERMS: "Bedingungen öffnen",
    OPEN_DATASETS: "Datasets öffnen",
    OPEN_REPORTS: "Reports öffnen",
    OPEN_DASHBOARD: "Dashboard öffnen",
    OPEN_UPLOAD: "Upload öffnen",
    OPEN_CLEVRSYNC: "ClevrSync öffnen",
    OPEN_AI_ASSISTANT: "AI Assistant öffnen",
    OPEN_RETAIL: "Retail öffnen",
    OPEN_ACCOUNTANCY: "Accountancy öffnen",
    OPEN_AI_GOVERNANCE: "AI Governance öffnen",
    OPEN_SUPPORT: "Support öffnen",
    CONTACT_SALES: "Sales kontaktieren",
    CONTACT_BILLING: "Billing kontaktieren",
    CONTACT_SUPPORT: "Support kontaktieren",
    CONTACT_MANAGEMENT: "Management kontaktieren",
  },
  spanish: {
    OPEN_PROFILE: "Abrir perfil",
    OPEN_PREFERENCES: "Abrir preferencias",
    OPEN_AI_PROVIDERS: "Abrir proveedores AI",
    OPEN_AI_ACTIVITY: "Abrir actividad AI",
    OPEN_DATA_CONNECTIONS: "Abrir conexiones de datos",
    OPEN_SUBSCRIPTION: "Abrir suscripción",
    OPEN_BILLING: "Abrir facturación",
    OPEN_AI_CREDITS: "Abrir créditos AI",
    OPEN_TERMS: "Abrir términos",
    OPEN_DATASETS: "Abrir datasets",
    OPEN_REPORTS: "Abrir informes",
    OPEN_DASHBOARD: "Abrir dashboard",
    OPEN_UPLOAD: "Abrir upload",
    OPEN_CLEVRSYNC: "Abrir ClevrSync",
    OPEN_AI_ASSISTANT: "Abrir AI Assistant",
    OPEN_RETAIL: "Abrir retail",
    OPEN_ACCOUNTANCY: "Abrir accountancy",
    OPEN_AI_GOVERNANCE: "Abrir AI governance",
    OPEN_SUPPORT: "Abrir soporte",
    CONTACT_SALES: "Contactar Ventas",
    CONTACT_BILLING: "Contactar Facturación",
    CONTACT_SUPPORT: "Contactar Soporte",
    CONTACT_MANAGEMENT: "Contactar Gestión",
  },
  romanian: {
    OPEN_PROFILE: "Deschide profilul",
    OPEN_PREFERENCES: "Deschide preferințe",
    OPEN_AI_PROVIDERS: "Deschide providerii AI",
    OPEN_AI_ACTIVITY: "Deschide activitatea AI",
    OPEN_DATA_CONNECTIONS: "Deschide conexiunile de date",
    OPEN_SUBSCRIPTION: "Deschide abonamentul",
    OPEN_BILLING: "Deschide facturarea",
    OPEN_AI_CREDITS: "Deschide creditele AI",
    OPEN_TERMS: "Deschide termenii",
    OPEN_DATASETS: "Deschide seturile de date",
    OPEN_REPORTS: "Deschide rapoartele",
    OPEN_DASHBOARD: "Deschide dashboardul",
    OPEN_UPLOAD: "Deschide uploadul",
    OPEN_CLEVRSYNC: "Deschide ClevrSync",
    OPEN_AI_ASSISTANT: "Deschide AI Assistant",
    OPEN_RETAIL: "Deschide retail",
    OPEN_ACCOUNTANCY: "Deschide accountancy",
    OPEN_AI_GOVERNANCE: "Deschide AI governance",
    OPEN_SUPPORT: "Deschide suportul",
    CONTACT_SALES: "Contactează Vânzări",
    CONTACT_BILLING: "Contactează Facturare",
    CONTACT_SUPPORT: "Contactează Suport",
    CONTACT_MANAGEMENT: "Contactează Management",
  },
  hungarian: {
    OPEN_PROFILE: "Profil megnyitása",
    OPEN_PREFERENCES: "Beállítások megnyitása",
    OPEN_AI_PROVIDERS: "AI providerek megnyitása",
    OPEN_AI_ACTIVITY: "AI aktivitás megnyitása",
    OPEN_DATA_CONNECTIONS: "Adatkapcsolatok megnyitása",
    OPEN_SUBSCRIPTION: "Előfizetés megnyitása",
    OPEN_BILLING: "Billing megnyitása",
    OPEN_AI_CREDITS: "AI kreditek megnyitása",
    OPEN_TERMS: "Feltételek megnyitása",
    OPEN_DATASETS: "Datasetek megnyitása",
    OPEN_REPORTS: "Riportok megnyitása",
    OPEN_DASHBOARD: "Dashboard megnyitása",
    OPEN_UPLOAD: "Upload megnyitása",
    OPEN_CLEVRSYNC: "ClevrSync megnyitása",
    OPEN_AI_ASSISTANT: "AI Assistant megnyitása",
    OPEN_RETAIL: "Retail megnyitása",
    OPEN_ACCOUNTANCY: "Accountancy megnyitása",
    OPEN_AI_GOVERNANCE: "AI Governance megnyitása",
    OPEN_SUPPORT: "Support megnyitása",
    CONTACT_SALES: "Sales kapcsolat",
    CONTACT_BILLING: "Billing kapcsolat",
    CONTACT_SUPPORT: "Support kapcsolat",
    CONTACT_MANAGEMENT: "Management kapcsolat",
  },
  dutch: {
    OPEN_PROFILE: "Profiel openen",
    OPEN_PREFERENCES: "Voorkeuren openen",
    OPEN_AI_PROVIDERS: "AI-providers openen",
    OPEN_AI_ACTIVITY: "AI-activiteit openen",
    OPEN_DATA_CONNECTIONS: "Dataconnecties openen",
    OPEN_SUBSCRIPTION: "Abonnement openen",
    OPEN_BILLING: "Billing openen",
    OPEN_AI_CREDITS: "AI-credits openen",
    OPEN_TERMS: "Voorwaarden openen",
    OPEN_DATASETS: "Datasets openen",
    OPEN_REPORTS: "Rapporten openen",
    OPEN_DASHBOARD: "Dashboard openen",
    OPEN_UPLOAD: "Upload openen",
    OPEN_CLEVRSYNC: "ClevrSync openen",
    OPEN_AI_ASSISTANT: "AI Assistant openen",
    OPEN_RETAIL: "Retail openen",
    OPEN_ACCOUNTANCY: "Accountancy openen",
    OPEN_AI_GOVERNANCE: "AI governance openen",
    OPEN_SUPPORT: "Support openen",
    CONTACT_SALES: "Contact Sales",
    CONTACT_BILLING: "Contact Billing",
    CONTACT_SUPPORT: "Contact Support",
    CONTACT_MANAGEMENT: "Contact Management",
  },
};

const actionTypes: Record<UsyActionId, "navigation" | "contact" | "conversation"> = {
  OPEN_PROFILE: "navigation",
  OPEN_PREFERENCES: "navigation",
  OPEN_AI_PROVIDERS: "navigation",
  OPEN_AI_ACTIVITY: "navigation",
  OPEN_DATA_CONNECTIONS: "navigation",
  OPEN_SUBSCRIPTION: "navigation",
  OPEN_BILLING: "navigation",
  OPEN_AI_CREDITS: "navigation",
  OPEN_TERMS: "navigation",
  OPEN_DATASETS: "navigation",
  OPEN_REPORTS: "navigation",
  OPEN_DASHBOARD: "navigation",
  OPEN_UPLOAD: "navigation",
  OPEN_CLEVRSYNC: "navigation",
  OPEN_AI_ASSISTANT: "navigation",
  OPEN_RETAIL: "navigation",
  OPEN_ACCOUNTANCY: "navigation",
  OPEN_AI_GOVERNANCE: "navigation",
  OPEN_SUPPORT: "navigation",
  CONTACT_SALES: "contact",
  CONTACT_BILLING: "contact",
  CONTACT_SUPPORT: "contact",
  CONTACT_MANAGEMENT: "contact",
};

export function getLocalizedActionButton(
  actionId: UsyActionId,
  language: SupportedUsyLanguage
): UsyActionButton {
  const normalizedLanguage = language === "dutch" ? "dutch" : language;
  const labels = actionLabels[normalizedLanguage] || actionLabels.english;
  return {
    actionId,
    label: labels[actionId] || actionLabels.english[actionId] || actionId,
    type: actionTypes[actionId],
  };
}

export function getActionById(actionId: UsyActionId): UsyAction | undefined {
  return usyActionRegistry[actionId];
}
