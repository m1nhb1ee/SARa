import { useLocation, useNavigate } from 'react-router';
import {
  Home, Upload, FolderOpen, User, Settings, LogOut
} from 'lucide-react';
import { useAuth } from '@/api/authContext';

const NAV_ITEMS = [
  { name: 'Home',     path: '/home',        tabColor: '#C9882A', icon: Home },
  { name: 'My Cases', path: '/',            tabColor: '#1B3A5C', icon: FolderOpen },
  { name: 'Upload',   path: '/upload',      tabColor: '#C0392B', icon: Upload },
  { name: 'Profile',  path: '/performance', tabColor: '#8B6355', icon: User },
  { name: 'Settings', path: '/settings',    tabColor: '#4A4A4A', icon: Settings },
];

function CaduceusStamp() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ opacity: 0.55 }}>
      <circle cx="20" cy="20" r="18" stroke="#C9A84C" strokeWidth="1.2" fill="none" />
      <line x1="20" y1="5" x2="20" y2="34" stroke="#C9A84C" strokeWidth="1.5" />
      <path d="M20 9 C14 6 9 10 12 15 C15 20 20 18 20 18" stroke="#C9A84C" strokeWidth="1" fill="none" />
      <path d="M20 9 C26 6 31 10 28 15 C25 20 20 18 20 18" stroke="#C9A84C" strokeWidth="1" fill="none" />
      <path d="M14 13 C10 16 10 20 14 22 C18 24 22 28 18 32" stroke="#C9A84C" strokeWidth="1" fill="none" />
      <path d="M26 13 C30 16 30 20 26 22 C22 24 18 28 22 32" stroke="#C9A84C" strokeWidth="1" fill="none" />
    </svg>
  );
}

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
        <div className="relative z-10 flex flex-col items-center pt-7 pb-5 px-5">
          <CaduceusStamp />

          <div className="mt-2 text-center">
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '20px',
                fontWeight: 700,
                letterSpacing: '0.07em',
                color: '#C9A84C',
                textShadow: '0px 1px 0px rgba(255,255,255,0.07), 0px -1px 3px rgba(0,0,0,0.75), 0px 2px 4px rgba(0,0,0,0.5)',
              }}
            >
              MedLens
            </div>

            <div className="mt-2 mx-auto" style={{
              height: '1px',
              width: '70px',
              background: 'linear-gradient(to right, transparent, rgba(201,168,76,0.55), transparent)',
            }} />

            <div
              className="mt-1.5"
              style={{
                fontFamily: "'Special Elite', cursive",
                fontSize: '8px',
                letterSpacing: '0.22em',
                color: 'rgba(237,224,196,0.35)',
              }}
            >
              MEDICAL AI TRAINING
            </div>
          </div>

          <div className="mt-4" style={{ color: 'rgba(201,168,76,0.3)', fontSize: '11px', letterSpacing: '2px' }}>
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
              style={{
                background: 'radial-gradient(circle, #5C3820 0%, #3E1F0D 100%)',
                border: '1.5px solid #C9A84C',
                boxShadow: '0 0 0 2px rgba(62,31,13,0.6)',
              }}
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
                style={{ width: '14px', height: '14px', flexShrink: 0, color: 'rgba(196,168,130,0.3)' }}
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
