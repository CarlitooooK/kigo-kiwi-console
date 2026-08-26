const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function Svg({ children, size, ...props }) {
  return (
    <svg {...base} width={size ?? base.width} height={size ?? base.height} {...props}>
      {children}
    </svg>
  )
}

export const IconShield = (p) => (
  <Svg {...p}>
    <path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3z" />
    <path d="M9.5 12l1.8 1.8L15 10" />
  </Svg>
)

export const IconGrid = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
  </Svg>
)

export const IconUsers = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
    <path d="M16 8.5a3 3 0 110-6" />
    <path d="M15 14.3c2.6.3 4.5 2.3 4.5 5.2" />
  </Svg>
)

export const IconRefresh = (p) => (
  <Svg {...p}>
    <path d="M4 10a8 8 0 0114-4.9M20 5v5h-5" />
    <path d="M20 14a8 8 0 01-14 4.9M4 19v-5h5" />
  </Svg>
)

export const IconChevronRight = (p) => (
  <Svg {...p}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
)

export const IconArrowLeft = (p) => (
  <Svg {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
)

export const IconCheck = (p) => (
  <Svg {...p}>
    <path d="M20 6L9 17l-5-5" />
  </Svg>
)

export const IconX = (p) => (
  <Svg {...p}>
    <path d="M18 6L6 18M6 6l12 12" />
  </Svg>
)

export const IconLogout = (p) => (
  <Svg {...p}>
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </Svg>
)

export const IconEye = (p) => (
  <Svg {...p}>
    <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
)

export const IconEyeOff = (p) => (
  <Svg {...p}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.2A10.6 10.6 0 0112 5c7 0 10.5 7 10.5 7a13.5 13.5 0 01-3.4 4.2M6.7 6.7C4 8.5 1.5 12 1.5 12s3.5 7 10.5 7c1.4 0 2.7-.3 3.9-.7" />
    <path d="M9.9 9.9a3 3 0 004.2 4.2" />
  </Svg>
)

export const IconMail = (p) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </Svg>
)

export const IconLock = (p) => (
  <Svg {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
    <path d="M8 10.5V7a4 4 0 018 0v3.5" />
  </Svg>
)

export const IconAlertCircle = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 8v5" />
    <path d="M12 16.2v.1" />
  </Svg>
)

export const IconCalendar = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="16" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Svg>
)

export const IconPin = (p) => (
  <Svg {...p}>
    <path d="M12 21s7-6.3 7-11.5A7 7 0 105 9.5C5 14.7 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.3" />
  </Svg>
)

export const IconClock = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 7v5l3.5 2" />
  </Svg>
)

export const IconCheckCircle = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M8 12.5l2.5 2.5L16 9.5" />
  </Svg>
)

export const IconImage = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M20.5 16l-5-5-9 9" />
  </Svg>
)

export const IconInbox = (p) => (
  <Svg {...p}>
    <path d="M4 12.5V7a2 2 0 012-2h12a2 2 0 012 2v5.5" />
    <path d="M4 12.5h4.5l1.2 2.5h4.6l1.2-2.5H20" />
    <path d="M4 12.5V18a2 2 0 002 2h12a2 2 0 002-2v-5.5" />
  </Svg>
)

export const IconBuilding = (p) => (
  <Svg {...p}>
    <rect x="5" y="3.5" width="10" height="17" rx="1" />
    <path d="M15 8h4v13h-4" />
    <path d="M8 7.5h.01M11.5 7.5h.01M8 11h.01M11.5 11h.01M8 14.5h.01M11.5 14.5h.01" />
  </Svg>
)

export const IconPhone = (p) => (
  <Svg {...p}>
    <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 005.5 5.5l1.5-2 4 1.5v3a2 2 0 01-2.2 2A16.5 16.5 0 014.5 5.7a2 2 0 012-2.2z" />
  </Svg>
)

export const IconUser = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6" />
  </Svg>
)

export const IconTag = (p) => (
  <Svg {...p}>
    <path d="M20 12.5L12.5 20a1.5 1.5 0 01-2.1 0l-6.4-6.4a1.5 1.5 0 010-2.1L11.5 4H18a2 2 0 012 2v6.5z" />
    <path d="M15.5 8.5h.01" />
  </Svg>
)

export const IconSearch = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </Svg>
)
