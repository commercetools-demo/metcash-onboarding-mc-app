import { bannerMeta } from '../lib/banners';
import type { BannerKey } from '../lib/types';

interface Props {
  banner?: BannerKey | string;
  /** Small = compact chip for lists; regular = default. */
  size?: 'small' | 'regular';
}

/**
 * A branded banner chip — colour-coded per Metcash banner so the network reads
 * visually at a glance (IGA red, Bottle-O red, Total Tools black/yellow, Mitre 10 blue).
 */
export default function BannerChip({ banner, size = 'regular' }: Props) {
  const meta = bannerMeta(banner);
  const label = meta?.label ?? banner ?? 'Unknown';
  const bg = meta?.color ?? '#8f9db0';
  const fg = meta?.onColor ?? '#ffffff';
  const isSmall = size === 'small';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        backgroundColor: bg,
        color: fg,
        borderRadius: '4px',
        fontWeight: 600,
        lineHeight: 1,
        letterSpacing: '0.02em',
        padding: isSmall ? '3px 8px' : '5px 10px',
        fontSize: isSmall ? '11px' : '13px',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
