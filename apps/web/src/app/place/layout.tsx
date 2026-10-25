import PlaceHeader from '@/components/place/PlaceHeader';

/**
 * /place layout — the banner frame shared by the index and every entry page.
 * Mirrors app/directory/layout.tsx so the two public surfaces render the same
 * chrome; the header carries the violet palette instead of the directory blue.
 */
export default function PlaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PlaceHeader />
      {children}
    </>
  );
}
