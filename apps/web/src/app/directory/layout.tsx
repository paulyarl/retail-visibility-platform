import DirectoryHeader from '@/components/directory/DirectoryHeader';

export default function DirectoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DirectoryHeader />
      {children}
    </>
  );
}
