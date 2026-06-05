import { Metadata } from "next";
import SetTenantId from "@/components/client/SetTenantId";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";

export const metadata: Metadata = {
  title: "Onboarding Settings",
  description: "Configure your onboarding settings and complete your profile setup",
};

export default async function TenantOnboardingSettings({ 
  params 
}: { 
  params: Promise<{ tenantId: string }> 
}) {
  const { tenantId } = await params;
  
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Onboarding Settings</h1>
          <p className="mt-1 text-sm text-gray-600">
            Complete your profile setup and configure your store preferences
          </p>
        </div>
        
        <OnboardingWizard tenantId={tenantId} />
      </div>
    </>
  );
}
