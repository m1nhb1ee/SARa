import { useNavigate } from 'react-router';
import { useAuth } from '@/api/authContext';
import { BookOpen, Upload, TrendingUp, User } from 'lucide-react';

function CaduceusLarge() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ opacity: 0.7 }}>
      <circle cx="36" cy="36" r="32" stroke="#C9A84C" strokeWidth="1.5" fill="none" />
      <line x1="36" y1="8" x2="36" y2="62" stroke="#C9A84C" strokeWidth="2" />
      <path d="M36 16 C26 12 18 18 22 26 C26 34 36 32 36 32" stroke="#C9A84C" strokeWidth="1.5" fill="none" />
      <path d="M36 16 C46 12 54 18 50 26 C46 34 36 32 36 32" stroke="#C9A84C" strokeWidth="1.5" fill="none" />
      <path d="M26 23 C19 28 19 36 25 39 C31 42 37 50 32 58" stroke="#C9A84C" strokeWidth="1.2" fill="none" />
      <path d="M46 23 C53 28 53 36 47 39 C41 42 35 50 40 58" stroke="#C9A84C" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

function OrnamentalRule() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '12px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, #C4A882)' }} />
      <span style={{ color: '#C9A84C', fontSize: 16 }}>✦</span>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, #C4A882)' }} />
    </div>
  );
}

const QUICK_LINKS = [
  {
    icon: BookOpen,
    label: 'My Cases',
    sub: 'Thư viện ca học',
    path: '/',
    color: '#1B3A5C',
    bg: 'rgba(27,58,92,0.08)',
    border: 'rgba(27,58,92,0.25)',
  },
  {
    icon: Upload,
    label: 'Upload',
    sub: 'Tải ca mới lên',
    path: '/upload',
    color: '#C0392B',
    bg: 'rgba(192,57,43,0.08)',
    border: 'rgba(192,57,43,0.25)',
  },
  {
    icon: TrendingUp,
    label: 'Progress',
    sub: 'Theo dõi tiến độ',
    path: '/performance',
    color: '#7D9B76',
    bg: 'rgba(125,155,118,0.08)',
    border: 'rgba(125,155,118,0.25)',
  },
  {
    icon: User,
    label: 'Profile',
    sub: 'Hồ sơ cá nhân',
    path: '/performance',
    color: '#8B6355',
    bg: 'rgba(139,99,85,0.08)',
    border: 'rgba(139,99,85,0.25)',
  },
];

const STEPS = [
  { num: '01', label: 'Chọn ca', desc: 'Từ thư viện case theo modality & độ khó' },
  { num: '02', label: 'Quan sát', desc: 'Mô tả hình ảnh, nhận diện dấu hiệu bất thường' },
  { num: '03', label: 'Phân tích', desc: 'Đặt chẩn đoán phân biệt có hệ thống' },
  { num: '04', label: 'Kết luận', desc: 'Chẩn đoán chính + chẩn đoán phụ' },
  { num: '05', label: 'Xử trí', desc: 'Đề xuất phác đồ điều trị phù hợp' },
  { num: '06', label: 'Đánh giá', desc: 'So sánh với đáp án — nhận phản hồi AI' },
];

export function WelcomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div style={{ backgroundColor: '#F5EDD6', minHeight: '100%', padding: '32px 40px' }}>
      {/* Header stamp */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 32 }}>
        <CaduceusLarge />
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: "'Special Elite', cursive",
            fontSize: 10,
            letterSpacing: '0.25em',
            color: '#8B6355',
            marginBottom: 6,
            textTransform: 'uppercase',
          }}>
            SARa · Smart AI Radiology
          </div>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 34,
            fontWeight: 700,
            color: '#2C1810',
            lineHeight: 1.15,
            marginBottom: 4,
          }}>
            Chào mừng,<br />
            <span style={{ color: '#C9A84C' }}>{user?.username ?? 'Bác sĩ'}</span>
          </h1>
          <div style={{ height: 1, width: 220, background: 'linear-gradient(to right, #C4A882, transparent)', marginTop: 8 }} />
        </div>

        {/* Date stamp */}
        <div style={{
          border: '2px solid rgba(192,57,43,0.35)',
          borderRadius: 2,
          padding: '10px 14px',
          textAlign: 'center',
          transform: 'rotate(2deg)',
          flexShrink: 0,
        }}>
          <div style={{ fontFamily: "'Special Elite', cursive", fontSize: 9, color: '#C0392B', letterSpacing: '0.2em' }}>
            {new Date().toLocaleDateString('vi-VN', { weekday: 'short' }).toUpperCase()}
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: '#C0392B', lineHeight: 1 }}>
            {new Date().getDate()}
          </div>
          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: '#C0392B', letterSpacing: '0.1em' }}>
            {new Date().toLocaleDateString('vi-VN', { month: 'short', year: 'numeric' }).toUpperCase()}
          </div>
        </div>
      </div>

      <OrnamentalRule />

      {/* Mission statement */}
      <div style={{
        background: 'rgba(196,168,130,0.15)',
        border: '1px solid #C4A882',
        borderLeft: '3px solid #C9A84C',
        borderRadius: 2,
        padding: '14px 18px',
        marginBottom: 32,
      }}>
        <p style={{
          fontFamily: "'Lora', serif",
          fontSize: 14,
          fontStyle: 'italic',
          color: '#4A2E1A',
          lineHeight: 1.7,
          margin: 0,
        }}>
          "Hệ thống luyện tập chẩn đoán hình ảnh y tế theo pipeline 6 bước — từ quan sát, phân tích,
          đến kết luận và xử trí. Mỗi ca học là một bước tiến trong hành trình trở thành bác sĩ xuất sắc."
        </p>
      </div>

      {/* Quick nav cards */}
      <div style={{ marginBottom: 36 }}>
        <div style={{
          fontFamily: "'Special Elite', cursive",
          fontSize: 11,
          letterSpacing: '0.18em',
          color: '#8B6355',
          marginBottom: 14,
          textTransform: 'uppercase',
        }}>
          — Điều hướng nhanh
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {QUICK_LINKS.map((link) => (
            <button
              key={link.label}
              onClick={() => navigate(link.path)}
              style={{
                background: link.bg,
                border: `1px solid ${link.border}`,
                borderRadius: 2,
                padding: '16px 14px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(62,31,13,0.12)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'none';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
              }}
            >
              <link.icon size={20} color={link.color} style={{ marginBottom: 8 }} />
              <div style={{
                fontFamily: "'Special Elite', cursive",
                fontSize: 13,
                color: link.color,
                letterSpacing: '0.06em',
                marginBottom: 3,
              }}>
                {link.label}
              </div>
              <div style={{ fontFamily: "'Lora', serif", fontSize: 11, color: '#6B4C3B', fontStyle: 'italic' }}>
                {link.sub}
              </div>
            </button>
          ))}
        </div>
      </div>

      <OrnamentalRule />

      {/* 6-step pipeline */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontFamily: "'Special Elite', cursive",
          fontSize: 11,
          letterSpacing: '0.18em',
          color: '#8B6355',
          marginBottom: 16,
          textTransform: 'uppercase',
        }}>
          — Pipeline 6 bước chẩn đoán
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {STEPS.map((step, i) => (
            <div key={step.num} style={{
              display: 'flex',
              gap: 12,
              padding: '12px 14px',
              background: 'rgba(196,168,130,0.1)',
              border: '1px solid rgba(196,168,130,0.4)',
              borderRadius: 2,
            }}>
              <div style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 22,
                fontWeight: 700,
                color: i < 3 ? '#C9A84C' : '#C4A882',
                lineHeight: 1,
                flexShrink: 0,
                opacity: 0.7,
              }}>
                {step.num}
              </div>
              <div>
                <div style={{
                  fontFamily: "'Special Elite', cursive",
                  fontSize: 13,
                  color: '#2C1810',
                  letterSpacing: '0.06em',
                  marginBottom: 3,
                }}>
                  {step.label}
                </div>
                <div style={{ fontFamily: "'Lora', serif", fontSize: 11, color: '#6B4C3B', fontStyle: 'italic', lineHeight: 1.5 }}>
                  {step.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer ornament */}
      <div style={{ textAlign: 'center', color: 'rgba(201,168,76,0.3)', fontSize: 20, paddingTop: 8 }}>
        ✦ ✦ ✦
      </div>
    </div>
  );
}
