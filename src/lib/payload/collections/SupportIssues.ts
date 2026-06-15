import type { CollectionConfig } from "payload"

import { isCmsSuperAdmin, withCollectionGroup } from "@/lib/payload/access"

export const SupportIssues: CollectionConfig = withCollectionGroup(
  {
    slug: "support-issues",
    labels: {
      singular: "Issue",
      plural: "Issues",
    },
    admin: {
      useAsTitle: "subject",
      defaultColumns: ["subject", "userEmail", "priority", "status", "updatedAt"],
      listSearchableFields: ["subject", "userEmail", "category", "message"],
      description: "Customer support issues managed by UseClevr operators.",
    },
    access: {
      read: isCmsSuperAdmin,
      create: isCmsSuperAdmin,
      update: isCmsSuperAdmin,
      delete: isCmsSuperAdmin,
    },
    fields: [
      {
        name: "id",
        type: "text",
        required: true,
        defaultValue: () => `ticket-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
        admin: {
          hidden: true,
        },
      },
      {
        name: "userId",
        type: "text",
        required: true,
        index: true,
        admin: {
          description: "Dashboard account ID that owns this issue.",
        },
      },
      {
        name: "userEmail",
        type: "email",
        required: true,
        index: true,
        label: "Customer email",
      },
      {
        name: "subject",
        type: "text",
        required: true,
        maxLength: 250,
      },
      {
        name: "message",
        type: "textarea",
        required: true,
        maxLength: 4000,
        admin: {
          rows: 8,
        },
      },
      {
        name: "category",
        type: "text",
        required: true,
        defaultValue: "General",
        maxLength: 80,
      },
      {
        name: "priority",
        type: "select",
        required: true,
        defaultValue: "normal",
        options: [
          { label: "Normal", value: "normal" },
          { label: "Urgent", value: "urgent" },
        ],
      },
      {
        name: "status",
        type: "select",
        required: true,
        defaultValue: "open",
        index: true,
        options: [
          { label: "Open", value: "open" },
          { label: "In progress", value: "in_progress" },
          { label: "Resolved", value: "resolved" },
        ],
      },
      {
        name: "adminNote",
        type: "textarea",
        label: "Operator note",
        maxLength: 4000,
        admin: {
          rows: 6,
        },
      },
      {
        name: "adminName",
        type: "text",
        label: "Last operator",
        maxLength: 255,
        admin: {
          readOnly: true,
        },
      },
      {
        name: "adminNoteUpdatedAt",
        type: "date",
        label: "Operator note updated",
        admin: {
          readOnly: true,
          date: {
            displayFormat: "dd MMM yyyy HH:mm",
          },
        },
      },
      {
        name: "resolvedAt",
        type: "date",
        admin: {
          readOnly: true,
          date: {
            displayFormat: "dd MMM yyyy HH:mm",
          },
        },
      },
    ],
    hooks: {
      beforeChange: [
        ({ data, originalDoc, operation, req }) => {
          if (operation !== "update") return data

          const nextStatus = data.status ?? originalDoc?.status
          const noteChanged =
            typeof data.adminNote === "string" && data.adminNote !== originalDoc?.adminNote

          const operatorEmail =
            req.user && "email" in req.user && typeof req.user.email === "string"
              ? req.user.email
              : ""

          return {
            ...data,
            adminName: operatorEmail || originalDoc?.adminName || "",
            adminNoteUpdatedAt: noteChanged ? new Date().toISOString() : originalDoc?.adminNoteUpdatedAt,
            resolvedAt:
              nextStatus === "resolved"
                ? originalDoc?.resolvedAt || new Date().toISOString()
                : null,
          }
        },
      ],
    },
    timestamps: true,
  },
  "Product operations",
)
