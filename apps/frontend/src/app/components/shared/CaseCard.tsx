import { CheckCircle2, Clock, RefreshCw, PlayCircle } from 'lucide-react';
import type { CaseItem } from '@/types';
import { difficultyStyle, modalityStyle } from '@/constants/styles';

const statusConfig = {
  'Chưa làm':  { icon: Clock,        color: 'var(--ink-secondary)', label: 'Chưa làm' },
  'Đang làm':  { icon: RefreshCw,    color: 'var(--accent-ochre)',  label: 'Đang làm' },
  'Hoàn thành':{ icon: CheckCircle2, color: 'var(--accent-sage)',   label: 'Hoàn thành' },
} as const;

interface Props {
  item: CaseItem;
  onClick: () => void;
}

export function CaseCard({ item, onClick }: Props) {
  const status = statusConfig[item.status];
  const StatusIcon = status.icon;
  const diff = difficultyStyle[item.difficulty];
  const mod = modalityStyle[item.modality];

  const actionStyle = item.status === 'Đang làm'
    ? { border: '1px solid var(--accent-ochre)', color: 'var(--accent-ochre)', backgroundColor: 'transparent' }
    : item.status === 'Hoàn thành'
    ? { border: '1px solid var(--accent-sage)', color: 'var(--accent-sage)', backgroundColor: 'transparent' }
    : { border: '1px solid var(--accent-gold)', backgroundColor: 'var(--accent-gold)', color: 'var(--ink-on-accent)' };

  const actionLabel = item.status === 'Đang làm' ? 'Tiếp tục' : item.status === 'Hoàn thành' ? 'Làm lại' : 'Bắt đầu';

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-xs)',
        transition: 'box-shadow 0.2s, transform 0.2s, border-color 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        e.currentTarget.style.borderColor = 'var(--border-strong)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      {/* Thumbnail */}
      <div style={{
        height: 140,
        backgroundColor: '#1A1A1A',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div className={`img-${item.imageKey}`} style={{ width: '100%', height: '100%', opacity: 0.85 }} />
        <span style={{
          position: 'absolute', top: 8, left: 8,
          padding: '3px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
          fontFamily: 'var(--font-typewriter)', letterSpacing: '0.03em',
          backgroundColor: diff.bg, color: diff.color,
          border: `1px solid ${diff.color}`,
        }}>
          {item.difficulty}
        </span>
        <span style={{
          position: 'absolute', top: 8, right: 8,
          padding: '3px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
          fontFamily: 'var(--font-typewriter)', letterSpacing: '0.03em',
          backgroundColor: mod.bg, color: mod.color,
          border: `1px solid ${mod.color}`,
        }}>
          {item.modality}
        </span>
      </div>

      {/* Content */}
      <div style={{ padding: 14 }}>
        <h3 style={{
          fontSize: 16, fontWeight: 700,
          fontFamily: 'var(--font-display)',
          color: 'var(--ink)', marginBottom: 6, lineHeight: 1.35,
        }}>
          {item.title}
        </h3>
        <p style={{
          fontSize: 13, color: 'var(--ink-secondary)', marginBottom: 12, lineHeight: 1.55,
          fontFamily: 'var(--font-body)', fontStyle: 'italic',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {item.hint}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusIcon size={13} style={{ color: status.color }} />
            <span style={{ fontSize: 12, color: status.color, fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
              {status.label}
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 'var(--radius-sm)',
              fontSize: 12, fontWeight: 600,
              fontFamily: 'var(--font-typewriter)', letterSpacing: '0.02em',
              cursor: 'pointer',
              transition: 'all 0.2s', ...actionStyle,
            }}
          >
            <PlayCircle size={12} /> {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
