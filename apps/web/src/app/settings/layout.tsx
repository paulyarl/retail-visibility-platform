import SettingsFooter from '@/components/SettingsFooter';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        {children}
      </div>
      <SettingsFooter />
    </div>
  );
}
