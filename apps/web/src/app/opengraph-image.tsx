import { ImageResponse } from 'next/og';

/**
 * Default social card for every public route (file-based metadata convention
 * — descendants inherit it unless they set their own `opengraph-image`).
 *
 * Replaces the previous `/favicon.ico` and 512×512 app-icon fallbacks, which
 * rendered as a stretched icon in link previews.
 */
export const alt = 'VisibleShelf — make your products visible';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const SURFACES = ['The directory', 'Google Search & Shopping', 'Your own storefront'];

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0a0a0f',
          padding: 72,
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: '#34d399',
              marginRight: 14,
            }}
          />
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>VisibleShelf</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
            Make your products visible.
          </div>
          <div style={{ fontSize: 32, color: '#a3a3a3', marginTop: 24, lineHeight: 1.3 }}>
            Local shops listed from public information — claim yours free.
          </div>
        </div>

        <div style={{ display: 'flex' }}>
          {SURFACES.map((label) => (
            <div
              key={label}
              style={{
                display: 'flex',
                padding: '12px 22px',
                marginRight: 14,
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.06)',
                fontSize: 24,
                color: '#d4d4d4',
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
