import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { CheckCircle2 } from 'lucide-react';
import { BrainLogo } from '@/app/components/shared/BrainLogo';
import { SketchBorder } from '@/app/components/shared/SketchBorder';

const NOTES = [
  { id: 1, style: { top: '6%', left: '2%', width: 178, rotate: -7 }, tone: 'var(--bg-highlight)', border: '#E6D96A',
    title: 'Patient #041', lines: ['Male, 25 y/o', 'Chief: headache × 3d', 'Brain MRI → WNL*', '─────────────', '*Within Normal Limits'] },
  { id: 2, style: { top: '4%', right: '3%', width: 200, rotate: 6 }, tone: 'var(--bg-surface)', border: 'var(--border)',
    title: '', lines: ['"SARa is actually', 'pretty good at DDx—', 'better than I expected"', '', '         — Dr. Nguyen T.'] },
  { id: 3, style: { top: '42%', left: '1%', width: 165, rotate: -5 }, tone: '#D4EDDA', border: '#88C99A',
    title: 'Case #107', lines: ['Female, 67 y/o', 'CXR: bilateral patchy', 'infiltrates', '→ DDx: CAP vs CHF?'] },
  { id: 4, style: { top: '38%', right: '2%', width: 185, rotate: 9 }, tone: 'var(--bg-surface)', border: 'var(--border)',
    title: '4-step pipeline', lines: ['① Observe', '② Reasoning', '③ DDx', '④ Conclude ✓'] },
  { id: 5, style: { bottom: '8%', left: '3%', width: 190, rotate: -9 }, tone: '#FFE4B5', border: '#DEB887',
    title: 'Pt: Nguyen Van A', lines: ['45M, CT abdomen', 'Hepatomegaly noted,', 'no focal lesion', '→ USG recommended'] },
  { id: 6, style: { bottom: '6%', right: '2%', width: 175, rotate: 7 }, tone: 'var(--bg-surface)', border: 'var(--border)',
    title: '', lines: ['Remember to check', 'lung BASES on every', 'single CXR!!!', '', "  (Dr. Nguyen's rule 📌)"] },
];

function MedNote({ n }: { n: typeof NOTES[0] }) {
  const [lifted, setLifted] = useState(false);
  const isSticky = n.tone !== 'var(--bg-surface)' && n.tone !== 'var(--bg-surface)';
  return (
    <div
      onMouseEnter={() => setLifted(true)}
      onMouseLeave={() => setLifted(false)}
      style={{
        position: 'absolute',
        top: (n.style as any).top, bottom: (n.style as any).bottom,
        left: (n.style as any).left, right: (n.style as any).right,
        width: n.style.width,
        backgroundColor: n.tone,
        border: `1px solid ${n.border}`,
        borderRadius: 2, padding: isSticky ? '28px 14px 14px' : '14px',
        transform: `rotate(${n.style.rotate}deg) translateY(${lifted ? -6 : 0}px)`,
        transition: 'transform 0.25s ease, box-shadow 0.25s ease',
        boxShadow: lifted ? '0 12px 28px rgba(44,24,16,0.22)' : '0 3px 10px rgba(44,24,16,0.13)',
        cursor: 'default', zIndex: lifted ? 5 : 1,
      }}
    >
      {isSticky && (
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 40, height: 12, background: 'rgba(255,255,255,0.45)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '0 0 2px 2px' }} />
      )}
      {n.title && <div style={{ fontFamily: "'Caveat', cursive", fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6, borderBottom: `1px solid ${n.border}`, paddingBottom: 4 }}>{n.title}</div>}
      {n.lines.map((line, i) => (
        <div key={i} style={{ fontFamily: "'Caveat', cursive", fontSize: 13, color: 'var(--ink)', lineHeight: 1.55, opacity: 0.88 }}>{line || ' '}</div>
      ))}
    </div>
  );
}

const INPUT_BASE: React.CSSProperties = {
  width: '100%', padding: '7px 2px',
  background: 'transparent', border: 'none',
  borderBottom: '1.5px solid var(--border)',
  fontFamily: "'Caveat', cursive",
  fontSize: 17, color: 'var(--ink)',
  outline: 'none', boxSizing: 'border-box',
  letterSpacing: '0.02em',
};

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setInfo('');
    if (!email.trim() || !password.trim()) { setError('Please fill in all required fields.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError("Passwords don't match :("); return; }
    setIsLoading(true);
    try {
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
      const res = await fetch(`${baseURL}/auth/register/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Đăng ký thất bại'); return; }
      if (data.requires_confirmation) { setInfo(data.message); return; }
      localStorage.setItem('sara_token', data.access_token);
      localStorage.setItem('sara_auth_state', 'true');
      localStorage.setItem('sara_user', JSON.stringify(data.user));
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  const W = 340;
  const H = info ? 380 : 530;

  const fieldStyle = (name: string): React.CSSProperties => ({
    ...INPUT_BASE,
    borderBottomColor: focused === name ? 'var(--accent-clay)' : 'var(--border)',
    borderBottomWidth: focused === name ? '2px' : '1.5px',
  });

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: 'var(--bg-page)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      backgroundImage: [
        'repeating-linear-gradient(transparent, transparent 27px, rgba(196,168,130,0.1) 27px, rgba(196,168,130,0.1) 28px)',
        'radial-gradient(ellipse at center, transparent 50%, rgba(44,24,16,0.1) 100%)',
      ].join(', '),
    }}>
      {NOTES.map(n => <MedNote key={n.id} n={n} />)}

      {/* Sheet */}
      <div style={{
        position: 'relative', width: W, minHeight: H,
        backgroundColor: 'var(--bg-surface)', padding: '40px 40px 32px', zIndex: 10,
        boxShadow: ['0 1px 1px','0 2px 2px','0 4px 4px','0 8px 8px','0 16px 16px'].map(s => `${s} rgba(44,24,16,0.06)`).join(', '),
        backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, rgba(196,168,130,0.25) 31px, rgba(196,168,130,0.25) 32px)',
        backgroundSize: '100% 32px',
      }}>
        <SketchBorder id="register-sheet" color="var(--ink-secondary)" opacity={0.6} />
        <div style={{ position: 'absolute', left: 28, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(192,57,43,0.2)', pointerEvents: 'none' }} />

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ marginBottom: 6 }}>
            <BrainLogo size={44} color="var(--ink)" filterId="register" opacity={0.82} />
          </div>
          <div style={{ fontFamily: "'Caveat', cursive", fontSize: 32, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>SARa</div>
          <div style={{ fontFamily: "'Caveat', cursive", fontSize: 12, color: 'var(--ink-secondary)', letterSpacing: '0.08em', marginTop: 2 }}>Smart AI Radiology</div>
          <svg width="100" height="6" style={{ marginTop: 6, display: 'block', margin: '6px auto 0' }}>
            <filter id="ul2"><feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="3" seed="7" result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G" /></filter>
            <line x1="5" y1="3" x2="95" y2="3" stroke="var(--accent-clay)" strokeWidth="1.5" filter="url(#ul2)" strokeLinecap="round" opacity="0.7" />
          </svg>
        </div>

        {info ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 20, textAlign: 'center' }}>
            <CheckCircle2 size={44} color="var(--accent-sage)" />
            <p style={{ fontFamily: "'Caveat', cursive", fontSize: 17, color: '#4A2E1A', lineHeight: 1.6 }}>{info}</p>
            <Link to="/login" style={{ fontFamily: "'Caveat', cursive", fontSize: 16, color: 'var(--accent-clay)', textDecoration: 'underline', textDecorationStyle: 'wavy' }}>
              ← back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[
              { name: 'name',    label: 'full name (optional)', type: 'text',     val: fullName,       set: setFullName,       ph: 'your name...' },
              { name: 'email',   label: 'email',               type: 'email',    val: email,          set: setEmail,          ph: 'your email...' },
              { name: 'pw',      label: 'password',            type: 'password', val: password,       set: setPassword,       ph: '••••••' },
              { name: 'cpw',     label: 'confirm password',    type: 'password', val: confirmPassword, set: setConfirmPassword, ph: '••••••' },
            ].map(f => (
              <div key={f.name}>
                <label style={{ display: 'block', fontFamily: "'Caveat', cursive", fontSize: 13, color: 'var(--ink-secondary)', letterSpacing: '0.08em', marginBottom: 3 }}>{f.label}</label>
                <input
                  type={f.type} value={f.val}
                  onChange={e => f.set(e.target.value)}
                  onFocus={() => setFocused(f.name)}
                  onBlur={() => setFocused(null)}
                  placeholder={f.ph} disabled={isLoading}
                  style={fieldStyle(f.name)}
                />
              </div>
            ))}

            {error && (
              <div style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: 'var(--accent-clay)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 18 }}>✗</span> {error}
              </div>
            )}

            <div style={{ position: 'relative', marginTop: 4 }}>
              <svg width="100%" height="46" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                <filter id="btn2"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4" seed="9" result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="2" xChannelSelector="R" yChannelSelector="G" /></filter>
                <rect x="2" y="2" width="calc(100% - 4)" height="42" rx="1" fill="none" stroke="var(--ink)" strokeWidth="1.8" filter="url(#btn2)" style={{ width: 'calc(100% - 4px)' } as any} opacity="0.7" />
              </svg>
              <button type="submit" disabled={isLoading} style={{ width: '100%', height: 46, background: 'transparent', border: 'none', fontFamily: "'Caveat', cursive", fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.06em', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.6 : 1, position: 'relative', zIndex: 1 }}>
                {isLoading ? 'creating account...' : 'create account →'}
              </button>
            </div>
          </form>
        )}

        {!info && (
          <div style={{ marginTop: 24, paddingTop: 12, borderTop: '1px dashed rgba(196,168,130,0.5)', textAlign: 'center' }}>
            <span style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: 'var(--ink-secondary)' }}>
              already have an account?{' '}
              <Link to="/login" style={{ color: 'var(--accent-clay)', fontWeight: 700, textDecoration: 'underline', textDecorationStyle: 'wavy' }}>sign in</Link>
            </span>
          </div>
        )}

        <div style={{ position: 'absolute', bottom: 10, right: 14, fontFamily: "'Caveat', cursive", fontSize: 12, color: 'rgba(139,99,85,0.4)' }}>p. 002</div>
      </div>
    </div>
  );
}
