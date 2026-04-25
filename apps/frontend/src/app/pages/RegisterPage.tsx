import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { CheckCircle2 } from 'lucide-react';

const NOTES = [
  { id: 1, style: { top: '6%', left: '2%', width: 178, rotate: -7 }, tone: '#FFF9C4', border: '#E6D96A',
    title: 'Patient #041', lines: ['Male, 25 y/o', 'Chief: headache × 3d', 'Brain MRI → WNL*', '─────────────', '*Within Normal Limits'] },
  { id: 2, style: { top: '4%', right: '3%', width: 200, rotate: 6 }, tone: '#FEFCF3', border: '#C4A882',
    title: '', lines: ['"SARa is actually', 'pretty good at DDx—', 'better than I expected"', '', '         — Dr. Nguyen T.'] },
  { id: 3, style: { top: '42%', left: '1%', width: 165, rotate: -5 }, tone: '#D4EDDA', border: '#88C99A',
    title: 'Case #107', lines: ['Female, 67 y/o', 'CXR: bilateral patchy', 'infiltrates', '→ DDx: CAP vs CHF?'] },
  { id: 4, style: { top: '38%', right: '2%', width: 185, rotate: 9 }, tone: '#FEFDF8', border: '#BEB0A0',
    title: '6-step pipeline', lines: ['① Observe', '② Describe', '③ Interpret', '④ Hypothesis', '⑤ DDx', '⑥ Conclude ✓'] },
  { id: 5, style: { bottom: '8%', left: '3%', width: 190, rotate: -9 }, tone: '#FFE4B5', border: '#DEB887',
    title: 'Pt: Nguyen Van A', lines: ['45M, CT abdomen', 'Hepatomegaly noted,', 'no focal lesion', '→ USG recommended'] },
  { id: 6, style: { bottom: '6%', right: '2%', width: 175, rotate: 7 }, tone: '#FEFCF3', border: '#C4A882',
    title: '', lines: ['Remember to check', 'lung BASES on every', 'single CXR!!!', '', "  (Dr. Nguyen's rule 📌)"] },
];

function MedNote({ n }: { n: typeof NOTES[0] }) {
  const [lifted, setLifted] = useState(false);
  const isSticky = n.tone !== '#FEFCF3' && n.tone !== '#FEFDF8';
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
      {n.title && <div style={{ fontFamily: "'Caveat', cursive", fontSize: 15, fontWeight: 700, color: '#2C1810', marginBottom: 6, borderBottom: `1px solid ${n.border}`, paddingBottom: 4 }}>{n.title}</div>}
      {n.lines.map((line, i) => (
        <div key={i} style={{ fontFamily: "'Caveat', cursive", fontSize: 13, color: '#3D2810', lineHeight: 1.55, opacity: 0.88 }}>{line || ' '}</div>
      ))}
    </div>
  );
}

function SketchRect({ w, h }: { w: number; h: number }) {
  const o = 4;
  return (
    <svg width={w + 20} height={h + 20} style={{ position: 'absolute', top: -10, left: -10, pointerEvents: 'none', overflow: 'visible' }}>
      <filter id="pencil2">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5" seed="3" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <g filter="url(#pencil2)">
        <rect x={10} y={10} width={w} height={h} fill="none" stroke="#7A6248" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <rect x={10 + o} y={10 + o} width={w - o * 2} height={h - o * 2} fill="none" stroke="#7A6248" strokeWidth="0.8" strokeLinecap="round" strokeDasharray="6 3 12 4 8 6" opacity="0.35" />
      </g>
    </svg>
  );
}

const INPUT_BASE: React.CSSProperties = {
  width: '100%', padding: '7px 2px',
  background: 'transparent', border: 'none',
  borderBottom: '1.5px solid #BEB0A0',
  fontFamily: "'Caveat', cursive",
  fontSize: 17, color: '#2C1810',
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
    if (!email.trim() || !password.trim()) { setError('Điền đầy đủ thông tin nhé!'); return; }
    if (password.length < 6) { setError('Mật khẩu cần ít nhất 6 ký tự'); return; }
    if (password !== confirmPassword) { setError('Mật khẩu xác nhận chưa khớp rồi :('); return; }
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
    borderBottomColor: focused === name ? '#C0392B' : '#BEB0A0',
    borderBottomWidth: focused === name ? '2px' : '1.5px',
  });

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#F5EDD6',
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
        backgroundColor: '#FEFDF5', padding: '40px 40px 32px', zIndex: 10,
        boxShadow: ['0 1px 1px','0 2px 2px','0 4px 4px','0 8px 8px','0 16px 16px'].map(s => `${s} rgba(44,24,16,0.06)`).join(', '),
        backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, rgba(196,168,130,0.25) 31px, rgba(196,168,130,0.25) 32px)',
        backgroundSize: '100% 32px',
      }}>
        <SketchRect w={W} h={H} />
        <div style={{ position: 'absolute', left: 28, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(192,57,43,0.2)', pointerEvents: 'none' }} />

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <svg width="40" height="40" viewBox="0 0 48 48" fill="none" style={{ marginBottom: 6, opacity: 0.82 }}>
            <filter id="psk2"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4" seed="5" result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G" /></filter>
            <g filter="url(#psk2)">
              <circle cx="24" cy="24" r="20" stroke="#4A3020" strokeWidth="1.4" fill="none" />
              <line x1="24" y1="7" x2="24" y2="40" stroke="#4A3020" strokeWidth="1.6" />
              <path d="M24 11 C18 9 13 13 15.5 18.5 C18 24 24 22 24 22" stroke="#4A3020" strokeWidth="1.1" fill="none" />
              <path d="M24 11 C30 9 35 13 32.5 18.5 C30 24 24 22 24 22" stroke="#4A3020" strokeWidth="1.1" fill="none" />
              <path d="M18 16.5 C13.5 20 13.5 26 18 28.5 C22 31 26 36 22.5 42" stroke="#4A3020" strokeWidth="0.9" fill="none" />
              <path d="M30 16.5 C34.5 20 34.5 26 30 28.5 C26 31 22 36 25.5 42" stroke="#4A3020" strokeWidth="0.9" fill="none" />
            </g>
          </svg>
          <div style={{ fontFamily: "'Caveat', cursive", fontSize: 32, fontWeight: 700, color: '#2C1810', lineHeight: 1 }}>SARa</div>
          <div style={{ fontFamily: "'Caveat', cursive", fontSize: 12, color: '#8B6355', letterSpacing: '0.08em', marginTop: 2 }}>Smart AI Radiology</div>
          <svg width="100" height="6" style={{ marginTop: 6, display: 'block', margin: '6px auto 0' }}>
            <filter id="ul2"><feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="3" seed="7" result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G" /></filter>
            <line x1="5" y1="3" x2="95" y2="3" stroke="#C0392B" strokeWidth="1.5" filter="url(#ul2)" strokeLinecap="round" opacity="0.7" />
          </svg>
        </div>

        {info ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 20, textAlign: 'center' }}>
            <CheckCircle2 size={44} color="#7D9B76" />
            <p style={{ fontFamily: "'Caveat', cursive", fontSize: 17, color: '#4A2E1A', lineHeight: 1.6 }}>{info}</p>
            <Link to="/login" style={{ fontFamily: "'Caveat', cursive", fontSize: 16, color: '#C0392B', textDecoration: 'underline', textDecorationStyle: 'wavy' }}>
              ← quay lại đăng nhập
            </Link>
          </div>
        ) : (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[
              { name: 'name',    label: 'họ tên (tùy chọn)',  type: 'text',     val: fullName,       set: setFullName,       ph: 'viết vào đây...' },
              { name: 'email',   label: 'email',               type: 'email',    val: email,          set: setEmail,          ph: 'email của bạn...' },
              { name: 'pw',      label: 'mật khẩu',            type: 'password', val: password,       set: setPassword,       ph: '••••••' },
              { name: 'cpw',     label: 'xác nhận mật khẩu',  type: 'password', val: confirmPassword, set: setConfirmPassword, ph: '••••••' },
            ].map(f => (
              <div key={f.name}>
                <label style={{ display: 'block', fontFamily: "'Caveat', cursive", fontSize: 13, color: '#8B6355', letterSpacing: '0.08em', marginBottom: 3 }}>{f.label}</label>
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
              <div style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: '#C0392B', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 18 }}>✗</span> {error}
              </div>
            )}

            <div style={{ position: 'relative', marginTop: 4 }}>
              <svg width="100%" height="46" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                <filter id="btn2"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4" seed="9" result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="2" xChannelSelector="R" yChannelSelector="G" /></filter>
                <rect x="2" y="2" width="calc(100% - 4)" height="42" rx="1" fill="none" stroke="#2C1810" strokeWidth="1.8" filter="url(#btn2)" style={{ width: 'calc(100% - 4px)' } as any} opacity="0.7" />
              </svg>
              <button type="submit" disabled={isLoading} style={{ width: '100%', height: 46, background: 'transparent', border: 'none', fontFamily: "'Caveat', cursive", fontSize: 18, fontWeight: 700, color: '#2C1810', letterSpacing: '0.06em', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.6 : 1, position: 'relative', zIndex: 1 }}>
                {isLoading ? 'đang tạo hồ sơ...' : 'tạo tài khoản →'}
              </button>
            </div>
          </form>
        )}

        {!info && (
          <div style={{ marginTop: 24, paddingTop: 12, borderTop: '1px dashed rgba(196,168,130,0.5)', textAlign: 'center' }}>
            <span style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: '#8B6355' }}>
              đã có tài khoản?{' '}
              <Link to="/login" style={{ color: '#C0392B', fontWeight: 700, textDecoration: 'underline', textDecorationStyle: 'wavy' }}>đăng nhập</Link>
            </span>
          </div>
        )}

        <div style={{ position: 'absolute', bottom: 10, right: 14, fontFamily: "'Caveat', cursive", fontSize: 12, color: 'rgba(139,99,85,0.4)' }}>p. 002</div>
      </div>
    </div>
  );
}
