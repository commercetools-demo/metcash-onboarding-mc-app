import { bannerMeta } from '../lib/banners';
import type { BannerKey } from '../lib/types';

/**
 * Banner logo mark.
 *
 * SWAPPABLE: to use official brand logos, drop image files in and map them here —
 * e.g. `import bottleO from '../assets/banners/bottle-o.svg'` then
 * `LOGO_SRC.BOTTLE_O = bottleO`. Any banner present in LOGO_SRC renders as an <img>;
 * the rest fall back to a clean branded wordmark tile (real brand colours), so the UI
 * looks polished today and upgrades to official artwork with zero code changes.
 */
const LOGO_SRC: Partial<Record<BannerKey, string>> = {
  // BOTTLE_O: bottleOLogoUrl,
  // TOTAL_TOOLS: totalToolsLogoUrl,
  // MITRE10: mitre10LogoUrl,
  // IGA: igaLogoUrl,
};

interface Props {
  banner?: BannerKey | string;
  height?: number;
  /** Show the wordmark text (default) or just a compact colour tile. */
  variant?: 'wordmark' | 'mark';
}

export default function BannerLogo({ banner, height = 22, variant = 'wordmark' }: Props) {
  const meta = bannerMeta(banner);
  const key = meta?.key;
  const label = meta?.label ?? banner ?? 'Unknown';
  const bg = meta?.color ?? '#8f9db0';
  const fg = meta?.onColor ?? '#ffffff';

  // Official logo, if supplied.
  if (key && LOGO_SRC[key]) {
    return (
      <img
        src={LOGO_SRC[key]}
        alt={label}
        style={{ height, display: 'block', objectFit: 'contain' }}
      />
    );
  }

  // Compact square mark (initial on brand colour) — for tight rows.
  if (variant === 'mark') {
    return (
      <span
        title={label}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: height,
          height,
          borderRadius: 5,
          background: bg,
          color: fg,
          fontWeight: 800,
          fontSize: height * 0.5,
          lineHeight: 1,
        }}
      >
        {label[0]}
      </span>
    );
  }

  // Branded wordmark tile fallback.
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height,
        padding: `0 ${Math.round(height * 0.45)}px`,
        borderRadius: 6,
        background: bg,
        color: fg,
        fontWeight: 800,
        fontSize: Math.round(height * 0.52),
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
        fontFamily:
          '"Inter", -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      {label}
    </span>
  );
}
