export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
export const MAX_UPLOAD_ROWS = 100_000
export const MAX_UPLOAD_COLUMNS = 250

export function formatUploadBytes(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)}MB`
}
