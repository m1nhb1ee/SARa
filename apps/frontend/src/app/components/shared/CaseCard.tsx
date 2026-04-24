import { CheckCircle2, Clock, RefreshCw, PlayCircle } from 'lucide-react';
import type { CaseItem } from '@/types';
import { difficultyStyle, modalityStyle } from '@/constants/styles';

const statusConfig = {
  'Chưa làm': { icon: Clock, color: 'var(--text-muted)', label: 'Chưa làm' },
  'Đang làm': { icon: RefreshCw, color: 'var(--warning)', label: 'Đang làm' },
  'Hoàn thành': { icon: CheckCircle2, color: 'var(--success)', label: 'Hoàn thành' },
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
    ? { border: '1px solid var(--warning)', color: 'var(--warning)' }
    : item.status === 'Hoàn thành'
    ? { border: '1px solid var(--success)', color: 'var(--success)' }
    : { border: '1px solid var(--accent)', backgroundColor: 'var(--accent)', color: 'var(--primary-foreground)' };

  const actionLabel = item.status === 'Đang làm' ? 'Tiếp tục' : item.status === 'Hoàn thành' ? 'Làm lại' : 'Bắt đầu';

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-dim)',
        borderRadius: 8,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.2s, transform 0.2s',
      }}
    >
      {/* Thumbnail */}
      <div style={{ height: 140, backgroundColor: 'var(--bg-base)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className={`img-${item.imageKey}`} style={{ width: '100%', height: '100%', opacity: 0.85 }} />
        <span style={{ position: 'absolute', top: 8, left: 8, padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 500, backgroundColor: diff.bg, color: diff.color, border: `1px solid ${diff.color}44` }}>
          {item.difficulty}
        </span>
        <span style={{ position: 'absolute', top: 8, right: 8, padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, backgroundColor: mod.bg, color: mod.color, border: `1px solid ${mod.color}44` }}>
          {item.modality}
        </span>
      </div>

      {/* Content */}
      <div style={{ padding: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3 }}>
          {item.title}
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 10, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {item.hint}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <StatusIcon size={13} color={status.color} />
            <span style={{ fontSize: 12, color: status.color, fontWeight: 500 }}>{status.label}</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', backgroundColor: 'transparent', transition: 'all 0.2s', ...actionStyle }}
          >
            <PlayCircle size={12} /> {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
