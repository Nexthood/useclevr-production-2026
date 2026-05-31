import { z } from "zod"

export const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]).default("user"),
    content: z.string(),
  })).min(1, "messages array is required"),
  datasetId: z.string().optional(),
  processedData: z.any().optional(),
})

export const analyzeRequestSchema = z.object({
  question: z.string().min(1, "question is required"),
  datasetId: z.string().min(1, "datasetId is required"),
  data: z.array(z.record(z.string(), z.any())).optional(),
  columns: z.array(z.string()).optional(),
  analysis: z.any().optional(),
})

export const queryRequestSchema = z.object({
  datasetId: z.string().min(1, "datasetId is required"),
  question: z.string().min(1, "question is required"),
})

export const datasetCreateSchema = z.object({
  name: z.string().optional(),
  fileName: z.string().min(1, "fileName is required"),
  fileSize: z.number().optional(),
  columns: z.array(z.any()).optional().default([]),
  rows: z.array(z.any()).optional().default([]),
})

export const ticketCreateSchema = z.object({
  subject: z.string().min(1, "subject is required"),
  message: z.string().min(1, "message is required"),
  category: z.string().optional(),
  priority: z.string().optional(),
})

export const ticketUpdateSchema = z.object({
  id: z.string().min(1, "id is required"),
  status: z.string().optional(),
  adminNote: z.string().optional(),
})

export interface ValidationResult<T> {
  success: true
  data: T
}

export interface ValidationError {
  success: false
  error: string
}

export function validateOrError<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> | ValidationError {
  const result = schema.safeParse(data)
  if (!result.success) {
    const firstError = result.error.issues[0]
    const message = firstError?.message || "Invalid request"
    return { success: false, error: message }
  }
  return { success: true, data: result.data }
}
