import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '@/api/authContext';
import { BrainLogo } from '@/app/components/shared/BrainLogo';

/* ─── Medical sticky notes scattered on desk ─── */
const NOTES = [
  {
    id: 1, type: 'sticky',
    style: { top: '6%', left: '2%', width: 178, rotate: -7 },
    tone: 'var(--bg-highlight)', border: '#E6D96A',
    title: 'Patient #041',
    lines: ['Male, 25 y/o', 'Chief: headache × 3d', 'Brain MRI → WNL*', '─────────────', '*Within Normal Limits'],
  },
  {
    id: 2, type: 'note',
    style: { top: '4%', right: '3%', width: 200, rotate: 6 },
    tone: 'var(--bg-surface)', border: 'var(--border)',
    title: '',
    lines: ['"SARa is actually', 'pretty good at DDx—', 'better than I expected"', '', '         — Dr. Nguyen T.'],
  },
  {
    id: 3, type: 'sticky',
    style: { top: '42%', left: '1%', width: 165, rotate: -5 },
    tone: '#D4EDDA', border: '#88C99A',
    title: 'Case #107',
    lines: ['Female, 67 y/o', 'CXR: bilateral patchy', 'infiltrates', '→ DDx: CAP vs CHF?'],
  },
  {
    id: 4, type: 'torn',
    style: { top: '38%', right: '2%', width: 185, rotate: 9 },
    tone: 'var(--bg-surface)', border: 'var(--border)',
    title: '4-step pipeline',
    lines: ['① Observe', '② Reasoning', '③ DDx', '④ Conclude ✓'],
  },
  {
    id: 5, type: 'sticky',
    style: { bottom: '8%', left: '3%', width: 190, rotate: -9 },
    tone: '#FFE4B5', border: '#DEB887',
    title: 'Pt: Nguyen Van A',
    lines: ['45M, referred for', 'CT abdomen WEDI', 'Hepatomegaly noted,', 'no focal lesion seen', '→ USG recommended'],
  },
  {
    id: 6, type: 'note',
    style: { bottom: '6%', right: '2%', width: 175, rotate: 7 },
    tone: 'var(--bg-surface)', border: 'var(--border)',
    title: '',
    lines: ['Remember to check', 'lung BASES on every', 'single CXR!!!', '', '  (Dr. Nguyen\'s rule 📌)'],
  },
  {
    id: 7, type: 'sticky',
    style: { top: '70%', left: '0.5%', width: 148, rotate: -4 },
    tone: '#E8F4FD', border: '#90BCD8',
    title: 'Quick score',
    lines: ['SARa AI: 87%', 'Human avg: 79%', '→ AI wins lol'],
  },
  {
    id: 8, type: 'torn',
    style: { top: '15%', right: '1%', width: 160, rotate: 11 },
    tone: 'var(--bg-surface)', border: 'var(--border)',
    title: '',
    lines: ['DICOM → AI analysis', '→ Structured report', '', '← this is the', '   future of radiology'],
  },
];

function MedNote({ n }: { n: typeof NOTES[0] }) {
  const [lifted, setLifted] = useState(false);
  const isSticky = n.type === 'sticky';

  return (
    <div
      onMouseEnter={() => setLifted(true)}
      onMouseLeave={() => setLifted(false)}
      style={{
        position: 'absolute',
        ...n.style as any,
        rotate: undefined,
        backgroundColor: n.tone,
        border: `1px solid ${n.border}`,
        borderRadius: isSticky ? 2 : 1,
        padding: isSticky ? '28px 14px 14px' : '14px 14px',
        transform: `rotate(${n.style.rotate}deg) translateY(${lifted ? -6 : 0}px)`,
        transition: 'transform 0.25s ease, box-shadow 0.25s ease',
        boxShadow: lifted
          ? '0 12px 28px rgba(44,24,16,0.22), 0 3px 8px rgba(44,24,16,0.12)'
          : '0 3px 10px rgba(44,24,16,0.13), 0 1px 3px rgba(44,24,16,0.08)',
        cursor: 'default',
        zIndex: lifted ? 5 : 1,
      }}
    >
      {/* Sticky tape strip on top for sticky notes */}
      {isSticky && (
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 40, height: 12,
          background: 'rgba(255,255,255,0.45)',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: '0 0 2px 2px',
        }} />
      )}

      {n.title && (
        <div style={{
          fontFamily: "'Caveat', cursive",
          fontSize: 15, fontWeight: 700,
          color: 'var(--ink)',
          marginBottom: 6,
          borderBottom: `1px solid ${n.border}`,
          paddingBottom: 4,
        }}>
          {n.title}
        </div>
      )}

      {n.lines.map((line, i) => (
        <div key={i} style={{
          fontFamily: "'Caveat', cursive",
          fontSize: line.startsWith('─') ? 11 : 13,
          color: line.startsWith('─') ? n.border : 'var(--ink)',
          lineHeight: 1.55,
          letterSpacing: '0.01em',
          opacity: line === '' ? 1 : 0.88,
        }}>
          {line || ' '}
        </div>
      ))}
    </div>
  );
}

/* ─── Sketch / hand-drawn SVG border for the form ─── */
function SketchRect({ w, h, color = 'var(--ink-secondary)' }: { w: number; h: number; color?: string }) {
  const o = 4; // offset for double-line sketch feel
  return (
    <svg
      width={w + 20} height={h + 20}
      style={{ position: 'absolute', top: -10, left: -10, pointerEvents: 'none', overflow: 'visible' }}
    >
      <filter id="pencil">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5" seed="3" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="10" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <g filter="url(#pencil)">
        {/* outer rough stroke */}
        <rect x={10} y={10} width={w} height={h+87}
          fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        {/* inner second stroke — sketch double-line effect */}
        <rect x={10 + o} y={10 + o} width={w - o * 2} height={h +87 - o * 2}
          fill="none" stroke={color} strokeWidth="0.8" strokeLinecap="round"
          strokeDasharray="6 3 12 4 8 6" opacity="0.35" />
      </g>
    </svg>
  );
}

const INPUT_BASE: React.CSSProperties = {
  width: '100%',
  padding: '8px 2px',
  background: 'transparent',
  border: 'none',
  borderBottom: '1.5px solid var(--border)',
  fontFamily: "'Caveat', cursive",
  fontSize: 17,
  color: 'var(--ink)',
  outline: 'none',
  boxSizing: 'border-box',
  letterSpacing: '0.02em',
};

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [focused, setFocused] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('Điền đầy đủ thông tin nhé!');
      return;
    }
    const success = await login(username, password);
    if (success) navigate('/');
    else setError('Wrong username or password :(');
  };

  const W = 340;
  const H = 450;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-page)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      backgroundImage: [
        'repeating-linear-gradient(transparent, transparent 27px, rgba(196,168,130,0.1) 27px, rgba(196,168,130,0.1) 28px)',
        'radial-gradient(ellipse at center, transparent 50%, rgba(44,24,16,0.1) 100%)',
      ].join(', '),
    }}>

      {/* Scattered medical notes */}
      {NOTES.map(n => <MedNote key={n.id} n={n} />)}

      {/* ── Login sheet ── */}
      <div style={{
        position: 'relative',
        width: W, minHeight: H,
        backgroundColor: 'var(--bg-surface)',
        padding: '44px 40px 36px',
        zIndex: 10,
        /* subtle paper shadow */
        boxShadow: [
          '0 1px 1px rgba(44,24,16,0.06)',
          '0 2px 2px rgba(44,24,16,0.06)',
          '0 4px 4px rgba(44,24,16,0.06)',
          '0 8px 8px rgba(44,24,16,0.06)',
          '0 16px 16px rgba(44,24,16,0.06)',
        ].join(', '),
        /* ruled lines on the paper */
        backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, rgba(196,168,130,0.25) 31px, rgba(196,168,130,0.25) 32px)',
        backgroundSize: '100% 32px',
      }}>

        {/* Hand-drawn border overlay */}
        <SketchRect w={W} h={H} color="var(--ink-secondary)" />

        {/* Red margin line */}
        <div style={{
          position: 'absolute', left: 28, top: 0, bottom: 0,
          width: 1, backgroundColor: 'rgba(192,57,43,0.2)',
          pointerEvents: 'none',
        }} />

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{ marginBottom: 8 }}>
            <BrainLogo size={52} color="var(--ink)" filterId="login" opacity={0.82} />
          </div>

          <div style={{
            fontFamily: "'Caveat', cursive",
            fontSize: 36, fontWeight: 700,
            color: 'var(--ink)', lineHeight: 1, letterSpacing: '0.04em',
          }}>
            SARa
          </div>
          <div style={{
            fontFamily: "'Caveat', cursive",
            fontSize: 13, color: 'var(--ink-secondary)',
            letterSpacing: '0.08em', marginTop: 2,
          }}>
            Smart AI Radiology
          </div>

          {/* pencil underline */}
          <svg width="120" height="6" style={{ marginTop: 8, display: 'block', marginLeft: 'auto', marginRight: 'auto' }}>
            <filter id="ul-rough">
              <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="3" seed="7" result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
            </filter>
            <line x1="5" y1="3" x2="115" y2="3" stroke="var(--accent-clay)" strokeWidth="1.5" filter="url(#ul-rough)" strokeLinecap="round" opacity="0.7" />
          </svg>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* Username */}
          <div>
            <label style={{
              display: 'block',
              fontFamily: "'Caveat', cursive",
              fontSize: 13, color: 'var(--ink-secondary)',
              letterSpacing: '0.08em', marginBottom: 4,
            }}>
              username / email
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onFocus={() => setFocused('u')}
              onBlur={() => setFocused(null)}
              placeholder="sign here..."
              disabled={isLoading}
              autoComplete="username"
              style={{
                ...INPUT_BASE,
                borderBottomColor: focused === 'u' ? 'var(--accent-clay)' : 'var(--border)',
                borderBottomWidth: focused === 'u' ? '2px' : '1.5px',
              }}
            />
          </div>

          {/* Password */}
          <div>
            <label style={{
              display: 'block',
              fontFamily: "'Caveat', cursive",
              fontSize: 13, color: 'var(--ink-secondary)',
              letterSpacing: '0.08em', marginBottom: 4,
            }}>
              password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onFocus={() => setFocused('p')}
              onBlur={() => setFocused(null)}
              placeholder="••••••••"
              disabled={isLoading}
              autoComplete="current-password"
              style={{
                ...INPUT_BASE,
                borderBottomColor: focused === 'p' ? 'var(--accent-clay)' : 'var(--border)',
                borderBottomWidth: focused === 'p' ? '2px' : '1.5px',
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              fontFamily: "'Caveat', cursive",
              fontSize: 15, color: 'var(--accent-clay)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 18 }}>✗</span> {error}
            </div>
          )}

          {/* Submit button — sketch rectangle style */}
          <div style={{ position: 'relative', marginTop: 6 }}>
            <svg width="100%" height="46" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
              <filter id="btn-rough">
                <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4" seed="9" result="n" />
                <feDisplacementMap in="SourceGraphic" in2="n" scale="2" xChannelSelector="R" yChannelSelector="G" />
              </filter>
              <rect x="2" y="2" width="calc(100% - 4)" height="42" rx="1"
                fill="none" stroke="var(--ink)" strokeWidth="1.8" filter="url(#btn-rough)"
                style={{ width: 'calc(100% - 4px)' } as any} opacity="0.7" />
            </svg>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%', height: 46,
                background: 'transparent',
                border: 'none',
                fontFamily: "'Caveat', cursive",
                fontSize: 18, fontWeight: 700,
                color: 'var(--ink)',
                letterSpacing: '0.06em',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1,
                position: 'relative', zIndex: 1,
                transition: 'opacity 0.15s',
              }}
            >
              {isLoading ? 'signing in...' : 'sign in →'}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div style={{
          marginTop: 28,
          paddingTop: 14,
          borderTop: '1px dashed rgba(196,168,130,0.5)',
          textAlign: 'center',
        }}>
          <span style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: 'var(--ink-secondary)' }}>
            don't have an account?{' '}
            <Link to="/register" style={{
              color: 'var(--accent-clay)', fontWeight: 700,
              textDecoration: 'underline',
              textDecorationStyle: 'wavy',
            }}>
              register
            </Link>
          </span>
        </div>

        {/* Corner page number */}
        <div style={{
          position: 'absolute', bottom: 10, right: 14,
          fontFamily: "'Caveat', cursive",
          fontSize: 12, color: 'rgba(139,99,85,0.4)',
        }}>
          p. 001
        </div>
      </div>
    </div>
  );
}
