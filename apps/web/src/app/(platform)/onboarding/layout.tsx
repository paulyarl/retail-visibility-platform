import PublicFooter from '@/components/PublicFooter';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        {children}
      </div>
      <PublicFooter />
    </div>
  );
}
