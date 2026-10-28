import type { ShapeId, Tool } from './types';

export function PumpkinIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 10c0-4 2-6 5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M16 11C5 5 2 17 7 24c3 4 6 2 9 3 3-1 6 1 9-3 5-7 2-19-9-13Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <ellipse cx="16" cy="19" rx="5.5" ry="8" stroke="currentColor" strokeWidth="1.3" />
      <path d="M16 11v16" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function PumpkinThumbnail({
  shape,
  className = '',
}: {
  shape: ShapeId;
  className?: string;
}) {
  const colors =
    shape === 'ghost'
      ? ['#fff6d6', '#b8ad8d', '#e1d5ae']
      : shape === 'sage'
        ? ['#c3c9a8', '#59664b', '#9ba77b']
        : shape === 'heirloom'
          ? ['#ed9152', '#81391e', '#c46735']
          : ['#ffad4e', '#9f3c10', '#e57922'];
  const sy = shape === 'heirloom' || shape === 'sage' ? 0.74 : shape === 'tall' ? 1.1 : 0.94;
  const sx = shape === 'tall' ? 0.82 : 1;
  return (
    <svg className={className} viewBox="0 0 110 100" role="img" aria-label={`${shape} pumpkin`}>
      <ellipse cx="56" cy="86" rx="43" ry="9" fill="#171b15" fillOpacity=".22" />
      <g transform={`translate(55 80) scale(${sx} ${sy}) translate(-55 -80)`}>
        <path
          d="M55 29c-13-10-35-3-38 15-4 22 8 40 25 41 5 2 10 0 13 0 6 2 10 2 16 0 20-2 28-19 23-40-4-18-23-23-39-16Z"
          fill={colors[2]}
        />
        <path
          d="M50 29C30 33 28 69 43 84M59 29c20 4 23 36 10 54M36 30C19 45 24 69 33 78M73 30c16 14 16 33 7 47"
          stroke={colors[1]}
          strokeOpacity=".35"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M53 28C43 40 43 70 50 85M58 29c9 17 10 37 3 56"
          stroke={colors[0]}
          strokeOpacity=".35"
          strokeWidth="2.5"
          fill="none"
        />
        <path d="M51 31c2-9 0-14 8-20l6 3c-7 7-7 11-6 17l-4 4Z" fill="#69704a" />
        <path d="m56 28 4-13" stroke="#bbb18b" strokeWidth="1" opacity=".5" />
      </g>
    </svg>
  );
}

export function ToolIllustration({ tool }: { tool: Tool }) {
  return (
    <svg viewBox="0 0 60 68" aria-hidden="true" className="tool-illustration">
      <g transform="rotate(24 30 34)">
        {['saw', 'drill', 'gouge', 'scraper'].includes(tool) && (
          <>
            <rect x="24" y="38" width="12" height="26" rx="4" fill="#926444" />
            <rect x="24" y="35" width="12" height="5" rx="1" fill="#bac2bd" />
            {tool === 'saw' && (
              <path
                d="M26 36V5l5-3 1 4 5 2-5 2 5 2-5 2 5 2-5 2 5 2-5 2 5 2-5 2 5 2-5 2 5 2-5 2v4Z"
                fill="#bac2bd"
                stroke="#89969a"
                strokeWidth=".4"
              />
            )}
            {tool === 'drill' && (
              <>
                <path d="m27 34 1-26 2-5 3 5v26Z" fill="#bac2bd" />
                <path
                  d="m27 11 6 3m-6 2 6 3m-6 2 6 3m-6 2 6 3m-6 2 6 3"
                  stroke="#515f65"
                  strokeWidth="1.6"
                />
                <rect x="25" y="30" width="10" height="7" rx="2" fill="#bac2bd" />
              </>
            )}
            {tool === 'gouge' && (
              <>
                <path d="M28 36V20l-8-6V5l10 6L40 5v9l-8 6v16Z" fill="#bac2bd" />
                <path d="M30 11v10m-10-7 10 7 10-7" stroke="#647379" strokeWidth=".8" />
              </>
            )}
            {tool === 'scraper' && (
              <>
                <path d="M28 36V28L15 17V5q15-4 30 0v12L32 28v8Z" fill="#bac2bd" />
                <path d="M15 7q15-4 30 0" fill="none" stroke="#f4f6f2" strokeWidth="1.3" />
              </>
            )}
          </>
        )}
        {['knife', 'cut'].includes(tool) && (
          <>
            <path d="M25 34V5c10 6 13 18 8 29Z" fill="#bac2bd" stroke="#7c8786" strokeWidth=".45" />
            <rect x="23" y="33" width="12" height="29" rx="4" fill="#926444" />
            <path d="M23 34h12" stroke="#c0c6c3" strokeWidth="3" />
            <circle cx="29" cy="42" r="1.6" fill="#c7c4b2" />
            <circle cx="29" cy="54" r="1.6" fill="#c7c4b2" />
          </>
        )}
        {tool === 'scoop' && (
          <>
            <ellipse
              cx="29"
              cy="16"
              rx="13"
              ry="17"
              fill="#bac2bd"
              stroke="#8b9695"
              strokeWidth=".5"
            />
            <ellipse cx="28" cy="14" rx="9" ry="12" fill="none" stroke="#8c9698" strokeWidth=".9" />
            <path d="M27 31h4v12h-4z" fill="#bac2bd" />
            <rect x="24" y="39" width="10" height="25" rx="4" fill="#926444" />
          </>
        )}
        {tool === 'paint' && (
          <>
            <path d="M21 7q8 4 16 0l-2 22H23Z" fill="#c4a579" />
            <path d="M24 8v17m4-16v16m4-17v17" stroke="#877353" strokeWidth=".8" />
            <rect x="22" y="25" width="14" height="13" rx="1" fill="#bac2bd" />
            <path d="M25 38h8l-1 25h-6Z" fill="#52624c" />
          </>
        )}
        {tool === 'marker' && (
          <>
            <path d="M27 10h4l2 7h-8Z" fill="#222623" />
            <rect x="23" y="17" width="12" height="42" rx="3" fill="#343a35" />
            <rect x="23" y="29" width="12" height="18" rx="1" fill="#eee7d5" />
            <path d="M26 34h6m-6 3h6m-6 3h4" stroke="#64695c" strokeWidth="1" />
            <path d="M23 53h12" stroke="#b9bdaf" strokeWidth="1" />
          </>
        )}
        {tool === 'stamp' && (
          <>
            <path
              d="M29 8 8 43h42Z"
              fill="none"
              stroke="#bac2bd"
              strokeWidth="6"
              strokeLinejoin="round"
            />
            <path d="M29 13 12 42h34Z" fill="none" stroke="#7f8988" strokeWidth=".6" />
            <rect x="22" y="47" width="14" height="12" rx="4" fill="#926444" />
          </>
        )}
        {tool === 'eraser' && (
          <>
            <rect x="18" y="16" width="24" height="38" rx="5" fill="#d8ad8f" />
            <path d="M18 26h24v17H18Z" fill="#f0e5ce" />
            <path d="M23 33h14m-14 4h8" stroke="#a69b83" strokeWidth="1" />
          </>
        )}
        {tool === 'orbit' && (
          <>
            <path
              d="M23 33V18q0-5 4-5t4 5v13-17q0-4 4-4t4 4v20-15q0-4 4-4t4 4v25q0 15-15 15H21L9 41q-2-5 2-7t8 4l4 6"
              fill="#d6b28e"
              stroke="#a68768"
              strokeWidth="1"
            />
          </>
        )}
      </g>
    </svg>
  );
}
