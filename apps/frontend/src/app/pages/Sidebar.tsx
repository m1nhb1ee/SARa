import { useLocation, useNavigate } from 'react-router';
import {
  Home, Upload, FolderOpen, User, Settings, LogOut, MessagesSquare
} from 'lucide-react';
import { useAuth } from '@/api/authContext';

const NAV_ITEMS = [
  { name: 'Home',     path: '/home',        tabColor: '#C9882A', icon: Home },
  { name: 'My Cases', path: '/',            tabColor: '#1B3A5C', icon: FolderOpen },
  { name: 'Upload',   path: '/upload',      tabColor: '#C0392B', icon: Upload },
  { name: 'Swap',     path: '/swap',        tabColor: '#1B5C4A', icon: MessagesSquare },
  { name: 'Profile',  path: '/performance', tabColor: '#8B6355', icon: User },
  { name: 'Settings', path: '/settings',    tabColor: '#4A4A4A', icon: Settings },
];


export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (item: typeof NAV_ITEMS[0]) => {
    if (item.path === '/') {
      return (
        location.pathname === '/' ||
        location.pathname.startsWith('/session/') ||
        location.pathname.startsWith('/answer-key/')
      );
    }
    if (item.path === '/swap') {
      return location.pathname.startsWith('/swap');
    }
    if (item.path === '/home') {
      return location.pathname === '/home';
    }
    return location.pathname.startsWith(item.path);
  };

  return (
    <>
      {/* ─── DESKTOP SIDEBAR ─── */}
      <aside
        className="hidden md:flex flex-col w-[260px] h-screen flex-shrink-0 relative sticky top-0 overflow-y-auto"
        style={{ background: '#3E1F0D', overflow: 'visible', zIndex: 20 }}
      >
        {/* Leather noise texture overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Left stitching */}
        <div
          className="absolute left-[7px] top-0 bottom-0 pointer-events-none"
          style={{
            width: '1px',
            backgroundImage: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.13) 0px, rgba(255,255,255,0.13) 4px, transparent 4px, transparent 9px)',
          }}
        />
        {/* Right stitching */}
        <div
          className="absolute right-[7px] top-0 bottom-0 pointer-events-none"
          style={{
            width: '1px',
            backgroundImage: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 4px, transparent 4px, transparent 9px)',
          }}
        />
        {/* Right edge depth vignette */}
        <div
          className="absolute right-0 top-0 bottom-0 w-6 pointer-events-none"
          style={{ background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.22))' }}
        />
        {/* Top worn corners */}
        <div className="absolute top-0 left-0 w-14 h-14 pointer-events-none"
          style={{ background: 'radial-gradient(circle at top left, rgba(0,0,0,0.18) 0%, transparent 70%)' }} />
        <div className="absolute top-0 right-0 w-14 h-14 pointer-events-none"
          style={{ background: 'radial-gradient(circle at top right, rgba(0,0,0,0.15) 0%, transparent 70%)' }} />

        {/* ── Logo / App Identity ── */}
        <div className="relative z-10 flex flex-col items-center pt-8 pb-5 px-5">

          {/* Minimal modern logo mark */}
          <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
            <defs>
              <filter id="logo-sketch" x="-8%" y="-8%" width="116%" height="116%">
                <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="9" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.2" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </defs>
            <g filter="url(#logo-sketch)">
              {/* Outer ring */}
              <circle cx="36" cy="36" r="28" stroke="#C9A84C" strokeWidth="1.6" opacity="0.9" />
              {/* Cross-hair lines — stop short of ring */}
              <line x1="36" y1="12" x2="36" y2="22" stroke="#C9A84C" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
              <line x1="36" y1="50" x2="36" y2="60" stroke="#C9A84C" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
              <line x1="12" y1="36" x2="22" y2="36" stroke="#C9A84C" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
              <line x1="50" y1="36" x2="60" y2="36" stroke="#C9A84C" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
              {/* Center dot */}
              <circle cx="36" cy="36" r="2.2" fill="#C9A84C" opacity="0.9" />
              {/* Corner brackets — top-left */}
              <path d="M6,14 L6,6 L14,6" stroke="#C9A84C" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
              {/* top-right */}
              <path d="M66,14 L66,6 L58,6" stroke="#C9A84C" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
              {/* bottom-left */}
              <path d="M6,58 L6,66 L14,66" stroke="#C9A84C" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
              {/* bottom-right */}
              <path d="M66,58 L66,66 L58,66" stroke="#C9A84C" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
              {/* Inner thin ring */}
              <circle cx="36" cy="36" r="10" stroke="#C9A84C" strokeWidth="0.8" strokeDasharray="5 3" opacity="0.35" />
            </g>
          </svg>

          {/* SARa wordmark */}
          <div className="mt-3 text-center">
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '22px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: '#C9A84C',
              }}
            >
              SARa
            </div>

            {/* Sketch underline */}
            <svg viewBox="0 0 90 10" style={{ width: 90, height: 10, display: 'block', margin: '3px auto 0' }}>
              <defs>
                <filter id="line-jitter" x="-5%" y="-50%" width="110%" height="200%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="3" result="noise" />
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
                </filter>
              </defs>
              <g filter="url(#line-jitter)">
                <path d="M8,6 Q30,3 45,5 Q60,7 82,4" fill="none" stroke="#C9A84C" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
                <path d="M12,8 Q35,6 45,7 Q58,8 78,6" fill="none" stroke="#C9A84C" strokeWidth="0.7" strokeLinecap="round" opacity="0.25" />
              </g>
            </svg>

            <div
              className="mt-2"
              style={{
                fontFamily: "'Special Elite', cursive",
                fontSize: '8px',
                letterSpacing: '0.24em',
                color: 'rgba(201,168,76,0.5)',
              }}
            >
              SMART AI RADIOLOGY
            </div>
          </div>

          <div className="mt-4" style={{ color: 'rgba(201,168,76,0.25)', fontSize: '11px', letterSpacing: '3px' }}>
            — ✦ —
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 relative z-10 mt-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            return (
              <div key={item.name} className="relative mb-[3px]" style={{ overflow: 'visible' }}>
                <button
                  onClick={() => navigate(item.path)}
                  className="w-full flex items-stretch relative group transition-transform duration-200"
                  style={{ transform: active ? 'translateX(3px)' : 'none' }}
                  title={item.name}
                >
                  {/* Colored tab strip on left */}
                  <div
                    style={{
                      width: '10px',
                      flexShrink: 0,
                      background: item.tabColor,
                      opacity: active ? 1 : 0.65,
                      transition: 'opacity 0.15s',
                    }}
                  />

                  {/* Tab body */}
                  <div
                    className="flex items-center gap-3 flex-1"
                    style={{
                      padding: '11px 16px',
                      background: active ? '#F5EDD6' : 'transparent',
                      boxShadow: active
                        ? '4px 0 14px rgba(62,31,13,0.38), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(62,31,13,0.1)'
                        : 'none',
                      borderTop: active ? '1px solid rgba(196,168,130,0.5)' : '1px solid transparent',
                      borderBottom: active ? '1px solid rgba(196,168,130,0.5)' : '1px solid transparent',
                      transition: 'background 0.15s, box-shadow 0.15s',
                    }}
                  >
                    <item.icon
                      style={{
                        width: '17px',
                        height: '17px',
                        flexShrink: 0,
                        color: active ? item.tabColor : '#D4C4A8',
                        opacity: active ? 1 : 0.8,
                      }}
                    />

                    <span
                      style={{
                        fontFamily: "'Special Elite', cursive",
                        fontSize: '12.5px',
                        letterSpacing: '0.08em',
                        color: active ? '#2C1810' : '#D4C4A8',
                        opacity: active ? 1 : 0.85,
                      }}
                    >
                      {item.name}
                    </span>

                    {active && (
                      <span
                        className="ml-auto"
                        style={{ color: item.tabColor, fontSize: '9px', marginRight: '2px' }}
                      >
                        ▶
                      </span>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </nav>

        {/* Thin gold separator */}
        <div className="relative z-10 mx-5 my-3">
          <div style={{
            height: '1px',
            background: 'linear-gradient(to right, transparent, rgba(201,168,76,0.28), transparent)',
          }} />
        </div>

        {/* ── Bottom User Strip ── */}
        <div
          className="relative z-10 mx-3 mb-3 p-3 rounded"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
            >
              <User style={{ width: '14px', height: '14px', color: '#D4B896' }} />
            </div>

            <div className="flex-1 min-w-0">
              <div
                className="truncate"
                style={{
                  fontFamily: "'Courier Prime', monospace",
                  fontSize: '11.5px',
                  color: '#D4B896',
                  letterSpacing: '0.01em',
                }}
              >
                {user?.username ?? 'User'}
              </div>
              <button
                onClick={handleLogout}
                className="hover:opacity-80 transition-opacity"
                style={{
                  fontFamily: "'Caveat', cursive",
                  fontSize: '13px',
                  color: 'rgba(196,168,130,0.55)',
                  textDecoration: 'underline',
                  textDecorationStyle: 'dotted',
                }}
              >
                Sign Out
              </button>
            </div>

            <button onClick={handleLogout} className="hover:opacity-70 transition-opacity">
              <LogOut
                style={{ width: '16px', height: '16px', flexShrink: 0, color: 'rgb(255, 72, 72)' }}
              />
            </button>
          </div>
        </div>

        {/* Bottom ornament */}
        <div
          className="relative z-10 pb-4 text-center"
          style={{ color: 'rgba(201,168,76,0.2)', fontSize: '16px' }}
        >
          ✦
        </div>
      </aside>

      {/* ─── MOBILE BOTTOM TAB BAR ─── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around"
        style={{
          height: '64px',
          background: '#3E1F0D',
          borderTop: '1.5px solid rgba(255,255,255,0.07)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.35)',
        }}
      >
        {/* Stitching line at top */}
        <div
          className="absolute top-2 left-4 right-4 h-px pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(to right, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 5px, transparent 5px, transparent 10px)',
          }}
        />

        {NAV_ITEMS.slice(0, 5).map((item) => {
          const active = isActive(item);
          return (
            <button
              key={item.name}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center gap-1 p-2 relative"
            >
              <item.icon
                style={{
                  width: '20px',
                  height: '20px',
                  color: active ? '#EDE0C4' : '#7A5545',
                  transition: 'color 0.15s',
                }}
              />
              {active && (
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: item.tabColor }}
                />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
