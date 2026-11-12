import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { ProgramConfig, PartnerLevel } from "@/lib/partners/rules";
import type { BusinessApplication } from "@/lib/partners/application";

// User/code foreign keys are added in SQL to avoid a circular schema import.
export const referralCodeOwners = pgTable("ReferralCodeOwner", {
  userId: text("userId").primaryKey(),
  code: text("code").notNull().unique(),
});
export const partnerConfigs = pgTable("PartnerConfig", {
  id: text("id").primaryKey(),
  config: jsonb("config").$type<ProgramConfig>().notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  effectiveAt: timestamp("effectiveAt", { withTimezone: true }).defaultNow().notNull(),
  actor: text("actor").notNull(),
  reason: text("reason").notNull(),
});
export const partnerAccounts = pgTable(
  "PartnerAccount",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull().unique(),
    code: text("code")
      .notNull()
      .unique()
      .references(() => referralCodeOwners.code),
    name: text("name").notNull(),
    country: text("country").notNull(),
    market: text("market"),
    status: text("status").notNull().default("pending"),
    agreement: text("agreement").notNull(),
    application: jsonb("application").$type<{
      partnershipType?: BusinessApplication["partnershipType"];
      companyName?: string;
      businessEmail?: string;
      companyWebsite?: string;
      industry?: string;
      existingCustomers?: number;
      email: string;
      experience: string;
      privacyVersion: string;
      acceptedAt: string;
    }>(),
    commercialReview: jsonb("commercialReview").$type<{
      status: "pending" | "under_review" | "approved" | "rejected";
      evidence?: string;
    }>(),
    notes: text("notes").notNull().default(""),
    level: text("level").$type<PartnerLevel>().notNull().default("bronze"),
    candidateLevel: text("candidateLevel").$type<PartnerLevel>(),
    candidateSince: timestamp("candidateSince", { withTimezone: true }),
    approvedAt: timestamp("approvedAt", { withTimezone: true }),
    terminatedAt: timestamp("terminatedAt", { withTimezone: true }),
    payoutHold: boolean("payoutHold").notNull().default(false),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      "PartnerAccount_status_check",
      sql`${t.status} in ('pending','active','rejected','suspended','terminated')`,
    ),
  ],
);
export const partnerAttributions = pgTable(
  "PartnerAttribution",
  {
    id: text("id").primaryKey(),
    referralId: text("referralId").notNull().unique(),
    partnerId: text("partnerId")
      .notNull()
      .references(() => partnerAccounts.id),
    userId: text("userId").notNull().unique(),
    relatedParty: text("relatedParty").notNull().default("unknown"),
    signedUpAt: timestamp("signedUpAt", { withTimezone: true }).notNull(),
    eligibilityStart: timestamp("eligibilityStart", { withTimezone: true }),
    eligibilityEnd: timestamp("eligibilityEnd", { withTimezone: true }),
  },
  (t) => [index("PartnerAttribution_partner_idx").on(t.partnerId)],
);
export const partnerFxRates = pgTable(
  "PartnerFxRate",
  {
    id: text("id").primaryKey(),
    currency: text("currency").notNull(),
    day: text("day").notNull(),
    numerator: numeric("numerator", { precision: 30, scale: 0 }).notNull(),
    denominator: numeric("denominator", { precision: 30, scale: 0 }).notNull(),
    source: text("source").notNull(),
    actor: text("actor").notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("PartnerFxRate_currency_day_key").on(t.currency, t.day),
    check("PartnerFxRate_positive", sql`${t.numerator} > 0 and ${t.denominator} > 0`),
  ],
);
export type PartnerPaymentEvidence = {
  invoiceId: string;
  chargeId: string;
  subscriptionId: string;
  customerId: string;
  userId: string;
  currency: string;
  grossMinor: string;
  netMinor: string;
  paidAt: string;
  subscriptionStatus: string;
  subscriptionPeriodEnd: string;
};
export const partnerEvents = pgTable("PartnerEvent", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  objectId: text("objectId").notNull(),
  evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("held"),
  reason: text("reason"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});
export const partnerPayments = pgTable(
  "PartnerPayment",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoiceId").notNull().unique(),
    chargeId: text("chargeId").notNull().unique(),
    subscriptionId: text("subscriptionId").notNull(),
    attributionId: text("attributionId")
      .notNull()
      .references(() => partnerAttributions.id),
    partnerId: text("partnerId")
      .notNull()
      .references(() => partnerAccounts.id),
    currency: text("currency").notNull(),
    grossMinor: numeric("grossMinor", { precision: 20, scale: 0 }).notNull(),
    netMinor: numeric("netMinor", { precision: 20, scale: 0 }).notNull(),
    usdMinor: numeric("usdMinor", { precision: 20, scale: 0 }).notNull(),
    fxRateId: text("fxRateId").references(() => partnerFxRates.id),
    paidAt: timestamp("paidAt", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("PartnerPayment_revenue_idx").on(t.partnerId, t.paidAt),
    check(
      "PartnerPayment_amounts",
      sql`${t.grossMinor} > 0 and ${t.netMinor} >= 0 and ${t.netMinor} <= ${t.grossMinor} and ${t.usdMinor} >= 0`,
    ),
  ],
);
export const partnerCommissions = pgTable(
  "PartnerCommission",
  {
    id: text("id").primaryKey(),
    paymentId: text("paymentId")
      .notNull()
      .unique()
      .references(() => partnerPayments.id),
    partnerId: text("partnerId")
      .notNull()
      .references(() => partnerAccounts.id),
    configId: text("configId")
      .notNull()
      .references(() => partnerConfigs.id),
    level: text("level").$type<PartnerLevel>().notNull(),
    rateBps: integer("rateBps").notNull(),
    amountMinor: numeric("amountMinor", { precision: 20, scale: 0 }).notNull(),
    currency: text("currency").notNull(),
    state: text("state").notNull().default("pending"),
    earnedAt: timestamp("earnedAt", { withTimezone: true }).notNull(),
  },
  (t) => [
    check("PartnerCommission_state", sql`${t.state} in ('pending','approved','paid','reversed')`),
    check(
      "PartnerCommission_rate",
      sql`${t.rateBps} between 0 and 10000 and ${t.amountMinor} >= 0`,
    ),
  ],
);
export const partnerAdjustments = pgTable(
  "PartnerAdjustment",
  {
    id: text("id").primaryKey(),
    paymentId: text("paymentId")
      .notNull()
      .references(() => partnerPayments.id),
    eventId: text("eventId")
      .notNull()
      .references(() => partnerEvents.id),
    kind: text("kind").notNull(),
    grossTargetMinor: numeric("grossTargetMinor", { precision: 20, scale: 0 }).notNull(),
    grossDeltaMinor: numeric("grossDeltaMinor", { precision: 20, scale: 0 }).notNull(),
    commissionDeltaMinor: numeric("commissionDeltaMinor", { precision: 20, scale: 0 }).notNull(),
    netDeltaMinor: numeric("netDeltaMinor", { precision: 20, scale: 0 }).notNull(),
    usdDeltaMinor: numeric("usdDeltaMinor", { precision: 20, scale: 0 }).notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("PartnerAdjustment_event_payment").on(t.eventId, t.paymentId)],
);
export const partnerSubscriptions = pgTable("PartnerSubscription", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  status: text("status").notNull(),
  periodEnd: timestamp("periodEnd", { withTimezone: true }).notNull(),
  eventCreated: integer("eventCreated").notNull(),
  canceled: boolean("canceled").notNull().default(false),
});
export const partnerPayouts = pgTable("PartnerPayout", {
  id: text("id").primaryKey(),
  partnerId: text("partnerId")
    .notNull()
    .references(() => partnerAccounts.id),
  currency: text("currency").notNull(),
  amountMinor: numeric("amountMinor", { precision: 20, scale: 0 }).notNull(),
  reference: text("reference").notNull().unique(),
  actor: text("actor").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});
export const partnerPayoutItems = pgTable("PartnerPayoutItem", {
  id: text("id").primaryKey(),
  payoutId: text("payoutId")
    .notNull()
    .references(() => partnerPayouts.id),
  commissionId: text("commissionId")
    .notNull()
    .references(() => partnerCommissions.id),
  amountMinor: numeric("amountMinor", { precision: 20, scale: 0 }).notNull(),
});
export const partnerAudit = pgTable("PartnerAudit", {
  id: text("id").primaryKey(),
  partnerId: text("partnerId").references(() => partnerAccounts.id),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  reason: text("reason").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const partnerApplications = pgTable("PartnerProgramApplication", {
  id: text("id").primaryKey(),
  program: text("program").notNull(),
  category: text("category").notNull(),
  fullName: text("fullName").notNull(),
  email: text("email").notNull(),
  country: text("country").notNull(),
  companyName: text("companyName"),
  experience: text("experience").notNull(),
  privacyAcceptedAt: timestamp("privacyAcceptedAt", { withTimezone: true }).notNull(),
  privacyVersion: text("privacyVersion").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  reviewedBy: text("reviewedBy"),
  reviewedAt: timestamp("reviewedAt", { withTimezone: true }),
  linkedUserId: text("linkedUserId"),
  partnerAccountId: text("partnerAccountId"),
  onboardedAt: timestamp("onboardedAt", { withTimezone: true }),
  invitationHash: text("invitationHash"),
  invitationExpiresAt: timestamp("invitationExpiresAt", { withTimezone: true }),
  invitationUsedAt: timestamp("invitationUsedAt", { withTimezone: true }),
  rejectionReason: text("rejectionReason"),
});
export const partnerApplicationAudit = pgTable("PartnerProgramApplicationAudit", {
  id: text("id").primaryKey(),
  applicationId: text("applicationId").notNull(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  reason: text("reason"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});
export const partnerApplicationEmails = pgTable("PartnerProgramApplicationEmail", {
  id: text("id").primaryKey(),
  applicationId: text("applicationId").notNull(),
  kind: text("kind").notNull(),
  recipient: text("recipient"),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: timestamp("nextAttemptAt", { withTimezone: true }).defaultNow().notNull(),
  sentAt: timestamp("sentAt", { withTimezone: true }),
  providerId: text("providerId"),
  lastErrorCode: text("lastErrorCode"),
  payload: jsonb("payload").$type<Record<string, string>>(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

// One explicit review authorizes one historical payment; Stripe evidence remains immutable.
export const partnerEventReviews = pgTable("PartnerEventReview", {
  eventId: text("eventId")
    .primaryKey()
    .references(() => partnerEvents.id),
  partnerId: text("partnerId")
    .notNull()
    .references(() => partnerAccounts.id),
  configId: text("configId")
    .notNull()
    .references(() => partnerConfigs.id),
  level: text("level").$type<PartnerLevel>().notNull(),
  actor: text("actor").notNull(),
  reason: text("reason").notNull(),
  evidence: text("evidence").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});
