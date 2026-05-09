import { useLocation, useNavigate } from 'react-router';
import {
  Home, Upload, FolderOpen, User, Settings, LogOut, MessagesSquare
} from 'lucide-react';
import { useAuth } from '@/api/authContext';
import { SketchBorder } from '@/app/components/shared/SketchBorder';

type NavItem = {
  name: string;
  path: string;
  icon: typeof Home;
  accent: string;
};

const NAV_ITEMS: NavItem[] = [
  { name: 'Home',     path: '/home',        icon: Home,           accent: 'var(--accent-ochre)' },
  { name: 'My Cases', path: '/',            icon: FolderOpen,     accent: 'var(--accent-ink)' },
  { name: 'Upload',   path: '/upload',      icon: Upload,         accent: 'var(--accent-clay)' },
  { name: 'Swap',     path: '/swap',        icon: MessagesSquare, accent: 'var(--accent-sage)' },
  { name: 'Profile',  path: '/performance', icon: User,           accent: 'var(--accent-gold)' },
  { name: 'Settings', path: '/settings',    icon: Settings,       accent: 'var(--ink-secondary)' },
];

const SIDEBAR_WIDTH = 240;

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (item: NavItem) => {
    if (item.path === '/') {
      return (
        location.pathname === '/' ||
        location.pathname.startsWith('/session/') ||
        location.pathname.startsWith('/answer-key/')
      );
    }
    if (item.path === '/swap') return location.pathname.startsWith('/swap');
    if (item.path === '/home') return location.pathname === '/home';
    return location.pathname.startsWith(item.path);
  };

  return (
    <>
      {/* ─── DESKTOP SIDEBAR ─── */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0 sticky top-0"
        style={{
          width: SIDEBAR_WIDTH,
          height: '100vh',
          background: 'var(--bg-surface-alt)',
          position: 'sticky',
          zIndex: 20,
          overflow: 'visible',
        }}
      >
        {/* Ruled lines paper texture */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `repeating-linear-gradient(
              transparent, transparent 27px,
              rgba(184,144,66,0.16) 27px, rgba(184,144,66,0.16) 28px
            )`,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Red margin line — typical school notebook */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 28, top: 0, bottom: 0, width: 1,
            backgroundColor: 'rgba(181,106,82,0.28)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Sketch border around the whole sidebar (right edge mostly visible) */}
        <SketchBorder id="sidebar-paper" color="var(--ink-secondary)" opacity={0.55} />

        {/* ── Logo ── */}
        <div className="flex flex-col items-center pt-6 pb-4 px-5" style={{ position: 'relative', zIndex: 1 }}>
          <svg width="56" height="56" viewBox="0 0 72 72" fill="none">
            <defs>
              <filter id="logo-sketch" x="-8%" y="-8%" width="116%" height="116%">
                <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="9" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.0" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </defs>
            <g filter="url(#logo-sketch)" stroke="var(--accent-gold)" fill="none">
              <circle cx="36" cy="36" r="26" strokeWidth="1.4" opacity="0.9" />
              <line x1="36" y1="14" x2="36" y2="22" strokeWidth="1.1" strokeLinecap="round" opacity="0.7" />
              <line x1="36" y1="50" x2="36" y2="58" strokeWidth="1.1" strokeLinecap="round" opacity="0.7" />
              <line x1="14" y1="36" x2="22" y2="36" strokeWidth="1.1" strokeLinecap="round" opacity="0.7" />
              <line x1="50" y1="36" x2="58" y2="36" strokeWidth="1.1" strokeLinecap="round" opacity="0.7" />
              <circle cx="36" cy="36" r="2" fill="var(--accent-gold)" stroke="none" />
              <circle cx="36" cy="36" r="10" strokeWidth="0.7" strokeDasharray="4 3" opacity="0.4" />
            </g>
          </svg>

          <div className="mt-2 text-center">
            <div
              style={{
                fontFamily: "'Caveat', cursive",
                fontSize: 32,
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: 'var(--ink)',
                lineHeight: 1,
              }}
            >
              SARa
            </div>

            {/* Sketchy underline */}
            <svg viewBox="0 0 90 10" style={{ width: 90, height: 10, display: 'block', margin: '2px auto 0' }}>
              <defs>
                <filter id="line-jitter" x="-5%" y="-50%" width="110%" height="200%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="3" result="noise" />
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
                </filter>
              </defs>
              <g filter="url(#line-jitter)">
                <path d="M8,6 Q30,3 45,5 Q60,7 82,4" fill="none" stroke="var(--accent-gold)" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
                <path d="M12,8 Q35,6 45,7 Q58,8 78,6" fill="none" stroke="var(--accent-gold)" strokeWidth="0.7" strokeLinecap="round" opacity="0.3" />
              </g>
            </svg>

            <div
              style={{
                marginTop: 4,
                fontFamily: 'var(--font-typewriter)',
                fontSize: 9,
                letterSpacing: '0.22em',
                color: 'var(--ink-secondary)',
                textTransform: 'uppercase',
                opacity: 0.7,
              }}
            >
              Smart AI Radiology
            </div>
          </div>
        </div>

        {/* Hairline divider */}
        <div style={{ margin: '0 24px 8px', height: 1, background: 'rgba(184,144,66,0.35)', position: 'relative', zIndex: 1 }} />

        {/* ── Navigation ── */}
        <nav className="flex-1 mt-2 px-3" style={{ position: 'relative', zIndex: 1 }}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            return (
              <button
                key={item.name}
                data-active={active}
                onClick={() => navigate(item.path)}
                className="sidebar-nav-item w-full flex items-center gap-3 mb-1"
                style={{
                  position: 'relative',
                  padding: '8px 14px',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  overflow: 'visible',
                  borderRadius: 4,
                }}
                title={item.name}
              >
                {/* Sketch border around active item */}
                {active && (
                  <SketchBorder id={`sidebar-${item.name}`} color={item.accent} opacity={0.85} />
                )}

                {/* Highlighter pen sweep */}
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 6, right: 6,
                    top: '22%', bottom: '20%',
                    width: active ? 'calc(100% - 12px)' : 0,
                    background: 'var(--bg-highlight-marker)',
                    mixBlendMode: 'multiply',
                    opacity: 0.78,
                    borderRadius: '14px 9px 16px 7px / 9px 16px 7px 14px',
                    transform: 'rotate(-0.6deg)',
                    boxShadow: 'inset 0 -2px 0 rgba(184,144,66,0.18), inset 0 1px 0 rgba(255,255,255,0.25)',
                    transition: 'width 0.6s cubic-bezier(0.4, 0.1, 0.3, 1)',
                    pointerEvents: 'none',
                    zIndex: 0,
                  }}
                />

                <item.icon
                  size={18}
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    flexShrink: 0,
                    color: active ? item.accent : 'var(--ink-secondary)',
                    opacity: active ? 1 : 0.85,
                    transition: 'color 0.3s ease 0.2s',
                  }}
                />
                <span
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    fontFamily: "'Caveat', cursive",
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    lineHeight: 1,
                    color: active ? 'var(--ink)' : 'var(--ink-secondary)',
                    transition: 'color 0.3s ease 0.2s',
                  }}
                >
                  {item.name}
                </span>
              </button>
            );
          })}
        </nav>

        {/* ── Bottom user strip ── */}
        <div
          style={{
            margin: '8px 14px 14px',
            padding: '11px 12px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <SketchBorder id="sidebar-user" color="var(--ink-secondary)" opacity={0.6} />

          <div className="flex items-center gap-3" style={{ position: 'relative', zIndex: 1 }}>
            <div
              className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
              style={{
                background: 'var(--accent-gold-soft)',
                border: '1px solid var(--accent-gold)',
              }}
            >
              <User size={15} style={{ color: 'var(--accent-gold-hover)' }} />
            </div>

            <div className="flex-1 min-w-0">
              <div
                className="truncate"
                style={{
                  fontFamily: "'Caveat', cursive",
                  fontSize: 18, fontWeight: 700,
                  color: 'var(--ink)',
                  lineHeight: 1.1,
                }}
              >
                {user?.username ?? 'User'}
              </div>
              <button
                onClick={handleLogout}
                style={{
                  fontFamily: "'Caveat', cursive",
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--ink-secondary)',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textDecorationStyle: 'dotted',
                  textDecorationColor: 'var(--ink-muted)',
                }}
              >
                Sign out
              </button>
            </div>

            <button
              onClick={handleLogout}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              title="Sign Out"
            >
              <LogOut size={16} style={{ color: 'var(--accent-clay)' }} />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── MOBILE BOTTOM TAB BAR ─── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around"
        style={{
          height: 60,
          background: 'var(--bg-surface-alt)',
          borderTop: '1px solid var(--border-strong)',
          boxShadow: '0 -2px 12px rgba(74,64,50,0.08)',
        }}
      >
        {NAV_ITEMS.slice(0, 5).map((item) => {
          const active = isActive(item);
          return (
            <button
              key={item.name}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center gap-1 p-2 relative"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <item.icon
                size={20}
                style={{
                  color: active ? item.accent : 'var(--ink-muted)',
                  transition: 'color 0.15s',
                  position: 'relative',
                  zIndex: 1,
                }}
              />
              {active && (
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: item.accent, position: 'relative', zIndex: 1 }}
                />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
