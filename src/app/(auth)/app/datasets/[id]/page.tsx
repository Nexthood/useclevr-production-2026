import { redirect } from "next/navigation";

export default async function DatasetDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/app/datasets/${encodeURIComponent(id)}/rows`);
}
