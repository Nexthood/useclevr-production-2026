import { CsvUpload } from "@/components/csv-upload"

export const metadata = {
  title: "Upload - UseClevr",
  description: "Upload your CSV",
}

export default function UploadPage() {
  return (
    <div className="flex flex-col">
      <header className="border-b border-border/40 bg-background">
        <div className="flex h-16 items-center px-6">
          <h1 className="text-2xl font-bold">Upload Dataset</h1>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
          <CsvUpload />
        </div>
      </main>
    </div>
  )
}
