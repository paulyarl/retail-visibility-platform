import Script from 'next/script';

/**
 * GA4 tag — loads gtag.js once sitewide when NEXT_PUBLIC_GA_MEASUREMENT_ID
 * is set; renders nothing otherwise (safe for dev/preview). Wired for the
 * GBP/Ads signal test: page views + key-driver events (see
 * docs/PLATFORM_GBP_GOOGLE_ADS_SPEC.md §5).
 */
export function GtagScript() {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!id) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${id}', { page_path: window.location.pathname });
        `}
      </Script>
    </>
  );
}
