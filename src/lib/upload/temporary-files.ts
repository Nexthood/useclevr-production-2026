export function isTemporaryUploadFileName(fileName: string | null | undefined) {
  const baseName = String(fileName || "")
    .split(/[\\/]/)
    .pop()
    ?.trim() || ""
  return baseName.startsWith("~") || baseName.startsWith(".~")
}

export function temporaryUploadFileMessage() {
  return "Temporary spreadsheet lock files cannot be uploaded. Close the source file and upload the real CSV or Excel file."
}
