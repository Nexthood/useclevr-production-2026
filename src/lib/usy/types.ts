export type SupportedUsyLanguage =
  | "english"
  | "german"
  | "dutch"
  | "spanish"
  | "hungarian"
  | "romanian";

export type UsyContactCategory =
  | "sales"
  | "technical_support"
  | "billing"
  | "management"
  | "executive";

export type HelpChatboxAudience = "public" | "dashboard" | "superadmin";

export type UsyRole = "public" | "user" | "admin" | "superadmin";

export type UsyUsageContext = {
  subscriptionTier?: string;
  analysisCount?: number;
  total?: number;
  limitReached?: boolean;
  unlimited?: boolean;
  unlimitedLabel?: string | null;
};

export type UsyContext = {
  audience: HelpChatboxAudience;
  role: UsyRole;
  route: string;
  plan?: string;
  usage?: UsyUsageContext | null;
};

export type UsyContactDraft = {
  category?: UsyContactCategory;
  message?: string;
  senderName?: string;
  company?: string;
  replyEmail?: string;
  language?: SupportedUsyLanguage;
  awaitingConfirmation?: boolean;
};

export type UsyChatSource = "knowledge";

export type UsyChatAction = "submit_contact" | "clear_contact";

export type UsyChatResponse = {
  answer: string;
  source: UsyChatSource;
  followUps: string[];
  contactDraft?: UsyContactDraft | null;
  action?: UsyChatAction;
};
