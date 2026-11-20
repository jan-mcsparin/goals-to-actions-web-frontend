import './LogoMark.css'

// The mark from ../docs/brand/logo-mark.svg: three dots rising to a star. The
// colors switch for dark backgrounds (logo-mark-on-dark.svg) in the CSS.
// Decorative: the name always sits beside it or is the page's heading.
export function LogoMark({ size }: { size: number }) {
  return (
    <svg className="logo-mark" viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" focusable="false">
      <circle className="logo-mark-dot" cx="14" cy="86" r="5" opacity="0.4" />
      <circle className="logo-mark-dot" cx="30" cy="70" r="7" opacity="0.7" />
      <circle className="logo-mark-dot" cx="48" cy="52" r="9" />
      <path className="logo-mark-star" d="M76 4 Q79.5 22.5 98 26 Q79.5 29.5 76 48 Q72.5 29.5 54 26 Q72.5 22.5 76 4 Z" />
    </svg>
  )
}
