import { redirect } from "next/navigation";

export default async function AppReportPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/report/${encodeURIComponent(id)}`);
}
