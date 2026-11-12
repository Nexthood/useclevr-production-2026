export type ContractItem = {
  id: string;
  applicationId: string;
  partnerId: string;
  revision: number;
  agreementType: string;
  templateVersion: string;
  commercialTermsVersion: string;
  mode: string;
  status: string;
  partnerStatus: string;
  readyForActivation: boolean;
  partnerSignedAt: string | null;
  companySignedAt: string | null;
  executedAt: string | null;
  expiresAt: string;
  lastErrorCode: string | null;
  sourceAvailable: boolean;
  signedAvailable: boolean;
  auditAvailable: boolean;
  documentChecksum: string | null;
  signedDocumentChecksum: string | null;
  audit?: { id: string; action: string; reason: string; createdAt: string }[];
  deliveries?: {
    id: string;
    kind: string;
    recipientRole: string;
    status: string;
    attempts: number;
    lastErrorCode: string | null;
  }[];
};
export type ContractData = {
  enabled: boolean;
  owner: boolean;
  applications: {
    id: string;
    fullName: string;
    status: string;
    onboardedAt: string | null;
    category: string;
  }[];
  contracts: ContractItem[];
  profiles: {
    id: string;
    applicationId: string;
    version: number;
    checksum: string;
    identity: {
      legalName: string;
      address: string;
      country: string;
      signerName: string;
      signerTitle: string;
      registrationId?: string;
    };
    reviewedAt: string | null;
  }[];
  schedules: {
    id: string;
    applicationId: string;
    version: string;
    checksum: string;
    schedule: unknown;
    approvedAt: string | null;
    revokedAt: string | null;
  }[];
  templates: {
    id: string;
    title: string;
    version: string;
    checksum: string;
    body: string;
    approvedAt: string | null;
    revokedAt: string | null;
  }[];
  runtime?: { checksum: string; policy: unknown };
  financialConfig?: { id: string } | null;
};
export const contractLabels: Record<string, string> = {
  pending: "Contract Pending",
  generated: "Contract Pending",
  sending: "Contract Pending",
  send_uncertain: "Delivery Requires Review",
  sent: "Contract Sent",
  awaiting_partner_signature: "Awaiting Partner Signature",
  awaiting_company_signature: "Awaiting Company Signature",
  fully_executed: "Fully Executed",
  expired: "Expired",
  cancelled: "Cancelled",
  rejected: "Rejected",
};
export const contractDocument = (id: string, kind: string) =>
  `/api/partners/contracts/${encodeURIComponent(id)}/documents/${kind}`;
