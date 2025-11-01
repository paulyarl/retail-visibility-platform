import SetTenantId from "@/components/client/SetTenantId";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";

export default async function TenantScopedOnboarding({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <OnboardingWizard tenantId={tenantId} />
      </div>
    </>
  );
}
