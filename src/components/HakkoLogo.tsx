import type { SVGProps } from "react";

/**
 * Hakko brand mark: isometric box silhouette with an inner dot
 * representing a live service. Single-stroke design, scales cleanly
 * from 16px to 256px. Color is inherited via currentColor.
 */
export function HakkoLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M4 7 L12 3 L20 7 L20 17 L12 21 L4 17 Z" />
      <path d="M4 7 L12 11 L20 7" />
      <path d="M12 11 L12 21" />
      <circle
        cx="12"
        cy="15.5"
        r="1.6"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
