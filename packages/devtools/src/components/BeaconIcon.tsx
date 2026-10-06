/** The Beacon mark, drawn inline so the bundle carries no asset. */
export const BeaconIcon = () => (
  <svg
    class="brand-icon"
    width="22"
    height="22"
    viewBox="0 0 64 64"
    fill="none"
    aria-hidden="true"
  >
    <rect width="64" height="64" rx="18" fill="currentColor" />
    <circle cx="32" cy="32" r="5.5" fill="#fff" />
    <path
      d="M22 22a14 14 0 0 0 0 20M42 22a14 14 0 0 1 0 20"
      stroke="#fff"
      stroke-width="4.5"
      stroke-linecap="round"
    />
    <path
      d="M15 17a22 22 0 0 0 0 30M49 17a22 22 0 0 1 0 30"
      stroke="#fff"
      stroke-opacity=".6"
      stroke-width="4.5"
      stroke-linecap="round"
    />
  </svg>
);
