import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export const ChevronDown = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const ArrowUpRight = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M7 17 17 7" />
    <path d="M7 7h10v10" />
  </svg>
);

export const ArrowDown = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M12 5v14" />
    <path d="m19 12-7 7-7-7" />
  </svg>
);

export const ArrowUp = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M12 19V5" />
    <path d="m5 12 7-7 7 7" />
  </svg>
);

export const BtcIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M10 4V6H12V18H10V20H14V18H11.5V13H14C15.93 13 17.5 11.43 17.5 9.5C17.5 7.57 15.93 6 14 6H11.5V4H10ZM11.5 7.5H14C14.83 7.5 15.5 8.17 15.5 9.5C15.5 10.83 14.83 11.5 14 11.5H11.5V7.5Z"
      fill="#F7931A"
    />
  </svg>
);

export const EthIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 1.75L11.5 2.5V14.5L12 15L18 11.5L12 1.75Z"
      fill="#627EEA"
    />
    <path d="M12 1.75L6 11.5L12 15V1.75Z" fill="#4556A5" />
    <path
      d="M12 16.25L11.5 16.5V22.25L12 22.5L18 12.75L12 16.25Z"
      fill="#627EEA"
    />
    <path d="M12 22.5V16.25L6 12.75L12 22.5Z" fill="#4556A5" />
    <path d="M12 15L18 11.5L12 8.25V15Z" fill="#C0C0C0" />
    <path d="M6 11.5L12 15V8.25L6 11.5Z" fill="#E0E0E0" />
  </svg>
);

export const SolIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M3 4H21V6H3V4ZM3 9H21V11H3V9ZM3 14H21V16H3V14ZM3 19H21V21H3V19Z"
      fill="url(#sol-gradient)"
    />
    <defs>
      <linearGradient
        id="sol-gradient"
        x1="3"
        y1="12.5"
        x2="21"
        y2="12.5"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#00FFA3" />
        <stop offset="1" stopColor="#DC1FFF" />
      </linearGradient>
    </defs>
  </svg>
);

export const BnbIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="#F3BA2F"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 2L6 8V16L12 22L18 16V8L12 2ZM11 7.17L12 6.17L13 7.17V9.5H15.83L16.83 8.5L15.83 7.5H13V5.17L12 4.17L11 5.17V7.5H8.17L7.17 8.5L8.17 9.5H11V7.17ZM12 10.5L14.5 13L12 15.5L9.5 13L12 10.5ZM13 14.5V18.83L12 19.83L11 18.83V14.5H8.17L7.17 15.5L8.17 16.5H11V18.83L12 19.83L13 18.83V16.5H15.83L16.83 15.5L15.83 14.5H13Z" />
  </svg>
);

export const DogeIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="#C2A633"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="10" />
    <path
      d="M10 8H14V16H10V14H12V12H10V10H12V8H10Z"
      fill="white"
    />
  </svg>
);

export const XrpIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="#23292F"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M6 12L8.5 9.5L11 12L8.5 14.5L6 12ZM13 12L15.5 9.5L18 12L15.5 14.5L13 12ZM12 6L9.5 8.5L12 11L14.5 8.5L12 6ZM12 13L9.5 15.5L12 18L14.5 15.5L12 13Z" />
  </svg>
);

export const ModelIcon = ({
  color,
  className,
}: {
  color: string;
  className?: string;
}) => (
  <div
    className={`flex h-6 w-6 items-center justify-center rounded-full ${className ?? ""}`}
    style={{ backgroundColor: `${color}20` }}
  >
    <svg
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
    >
      <path d="M12 2L2 7V17L12 22L22 17V7L12 2ZM19.6 8.25L12 12.5L4.4 8.25L12 4L19.6 8.25Z" />
    </svg>
  </div>
);

export const GeminiIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z"
      fill="url(#gemini-grad)"
    />
    <path d="M12 6L9.5 10H14.5L12 6Z" fill="#4285F4" />
    <path d="M18 12L14 14.5V9.5L18 12Z" fill="#34A853" />
    <path d="M6 12L10 9.5V14.5L6 12Z" fill="#FBBC05" />
    <path d="M12 18L14.5 14H9.5L12 18Z" fill="#EA4335" />
    <defs>
      <linearGradient
        id="gemini-grad"
        x1="2"
        y1="12"
        x2="22"
        y2="12"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#4285F4" />
        <stop offset="0.33" stopColor="#EA4335" />
        <stop offset="0.66" stopColor="#FBBC05" />
        <stop offset="1" stopColor="#34A853" />
      </linearGradient>
    </defs>
  </svg>
);
