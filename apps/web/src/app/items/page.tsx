import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tenantId?: string }> | { tenantId?: string };
}) {
  // Handle both async and sync searchParams (Next.js 15 compatibility)
  const resolvedParams = searchParams && typeof searchParams === 'object' && 'then' in searchParams 
    ? await searchParams 
    : searchParams;
  const tenantId = resolvedParams?.tenantId;
  if (!tenantId) {
    // Redirect to tenants page if no tenant selected
    redirect("/tenants");
  }

  // Canonicalize to /t/{tenantId}/items so the tenant app shell (sidebar) is applied
  redirect(`/t/${tenantId}/items`);
}
