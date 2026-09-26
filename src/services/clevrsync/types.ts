import type {
  ClevrSyncConnectorStatus,
  ClevrSyncConnectorType,
  ClevrSyncStatus,
} from "@/lib/db/schema";

export type { ClevrSyncConnectorStatus, ClevrSyncConnectorType, ClevrSyncStatus };

export type ClevrSyncColumnType = "empty" | "boolean" | "number" | "date" | "string" | "mixed";

export type ClevrSyncRow = Record<string, string | number | boolean | Date | null>;

export type ClevrSyncColumn = {
  name: string;
  originalName: string;
  type: ClevrSyncColumnType;
  emptyCount: number;
  sampleValues: Array<string | number | boolean>;
};

export type ClevrSyncWorksheetPreview = {
  name: string;
  columns: ClevrSyncColumn[];
  rows: ClevrSyncRow[];
  rowCount: number;
  columnCount: number;
};

export type ClevrSyncPreview = {
  sourceType: "google_sheets";
  fileName: string;
  fileSize: number;
  mimeType: string;
  activeWorksheet: string | null;
  worksheets: ClevrSyncWorksheetPreview[];
  googleSheets?: {
    spreadsheetId: string;
    spreadsheetName: string;
    worksheetName: string;
    worksheets: Array<{
      id: number | null;
      title: string;
      index: number;
    }>;
  };
  columns: ClevrSyncColumn[];
  rows: ClevrSyncRow[];
  rowCount: number;
  columnCount: number;
};

export type ClevrSyncDatasetPayload = {
  name: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  columns: string[];
  rows: ClevrSyncRow[];
  columnTypes: Record<string, ClevrSyncColumnType>;
  datasetType: "standard";
  source: "clevrsync";
};

export type ClevrSyncConnectorRecord = {
  id: string;
  userId: string;
  organizationId: string;
  type: ClevrSyncConnectorType;
  status: ClevrSyncConnectorStatus;
  displayName: string;
  sourceMeta: Record<string, unknown>;
  providerAccountLabel?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ClevrSyncRunRecord = {
  id: string;
  connectorId: string;
  userId: string;
  lastSync: Date | null;
  rowCount: number;
  columnMapping: Record<string, string>;
  status: ClevrSyncStatus;
  datasetId: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateClevrSyncConnectorInput = {
  userId: string;
  organizationId?: string | null;
  type: ClevrSyncConnectorType;
  displayName?: string | null;
  sourceMeta?: Record<string, unknown>;
};
