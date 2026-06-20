import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tenantId?: string }>;
}) {
  const resolvedParams = await searchParams;
  const tenantId = resolvedParams?.tenantId;
  if (!tenantId) {
    // Redirect to tenants page if no tenant selected
    redirect("/tenants");
  }

  // Canonicalize to /t/{tenantId}/items so the tenant app shell (sidebar) is applied
  redirect(`/t/${tenantId}/items`);
}
