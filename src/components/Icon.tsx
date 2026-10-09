type IconProps = {
  name: 'microphone' | 'camera' | 'speaker' | 'play' | 'stop'
}

function Icon({ name }: IconProps) {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {name === 'microphone' && <>
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
      </>}
      {name === 'camera' && <>
        <rect x="3" y="6" width="12" height="12" rx="2" />
        <path d="m15 10 6-3v10l-6-3" />
      </>}
      {name === 'speaker' && <>
        <path d="M11 4 6 8H3v8h3l5 4V4ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" />
      </>}
      {name === 'play' && <path d="m8 5 11 7-11 7V5Z" />}
      {name === 'stop' && <rect x="6" y="6" width="12" height="12" rx="1" />}
    </svg>
  )
}

export default Icon
