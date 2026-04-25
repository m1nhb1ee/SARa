import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useCases, useSessions } from '@/api/hooks';
import { mapModality, mapDifficulty, getImageKey } from '@/utils/mappers';
import type { CaseItem, SessionStatus, Modality, Difficulty } from '@/types';
import { SketchBorder } from '@/app/components/shared/SketchBorder';
import styles from './Dashboard.module.css';

const MODALITY_OPTIONS = ['Tất cả', 'X-Ray', 'CT', 'MRI'];
const DIFFICULTY_OPTIONS = ['Tất cả', 'Cơ bản', 'Trung bình', 'Nặng cao'];

// Map modality → accent strip class
const accentClass: Record<Modality, string> = {
  'X-Ray': styles.accentXray,
  'CT':    styles.accentCt,
  'MRI':   styles.accentMri,
};

// Map modality → washi-tape class + label
const modalityWashi: Record<Modality, { cls: string; label: string }> = {
  'X-Ray': { cls: styles.washiBlue,  label: 'X-Ray Study' },
  'CT':    { cls: styles.washiGreen, label: 'CT Scan'     },
  'MRI':   { cls: styles.washiRed,   label: 'MRI Study'   },
};

// Map difficulty → badge class + label
const diffBadge: Record<Difficulty, { cls: string; label: string }> = {
  'Cơ bản':    { cls: styles.diffBeginner, label: 'Beginner'     },
  'Trung bình':{ cls: styles.diffInter,    label: 'Intermediate' },
  'Nặng cao':  { cls: styles.diffAdv,      label: 'Advanced'     },
};

// Map status → rubber stamp class + label
const statusStamp: Record<SessionStatus, { cls: string; label: string }> = {
  'Chưa làm':  { cls: styles.stampNew,      label: 'New'         },
  'Đang làm':  { cls: styles.stampPending,  label: 'In Progress' },
  'Hoàn thành':{ cls: styles.stampReviewed, label: 'Reviewed'    },
};

// Progress percent by status
const progressPct: Record<SessionStatus, number> = {
  'Chưa làm':   0,
  'Đang làm':  55,
  'Hoàn thành':100,
};

// Stat accent color by key
const STAT_COLORS = {
  total:      'var(--ink, #2C1810)',
  done:       '#7D9B76',
  inProgress: '#8B6914',
  notStarted: '#C0392B',
};

/* ─── Thumbnail SVG by image key ─────────────────────── */
function ThumbSvg({ keyName }: { keyName: string }) {
  const strokeColor = 'rgba(245,237,214,0.6)';
  if (keyName === 'ct') {
    return (
      <svg className={styles.thumbSvg} viewBox="0 0 48 48" fill="none" stroke={strokeColor} strokeWidth="1">
        <rect x="10" y="14" width="28" height="22" rx="2" />
        <line x1="10" y1="22" x2="38" y2="22" />
        <line x1="10" y1="28" x2="38" y2="28" />
        <line x1="18" y1="14" x2="18" y2="36" />
        <line x1="30" y1="14" x2="30" y2="36" />
        <circle cx="24" cy="25" r="3" />
      </svg>
    );
  }
  if (keyName === 'mri') {
    return (
      <svg className={styles.thumbSvg} viewBox="0 0 48 48" fill="none" stroke={strokeColor} strokeWidth="1.2">
        <circle cx="24" cy="22" r="11" />
        <ellipse cx="24" cy="22" rx="6" ry="9" />
        <line x1="13" y1="22" x2="35" y2="22" />
        <circle cx="24" cy="22" r="3" />
      </svg>
    );
  }
  // default: chest / body X-ray
  return (
    <svg className={styles.thumbSvg} viewBox="0 0 48 48" fill="none" stroke={strokeColor} strokeWidth="1">
      <ellipse cx="24" cy="20" rx="10" ry="13" />
      <path d="M14 33 Q18 40 24 42 Q30 40 34 33" />
      <line x1="20" y1="14" x2="28" y2="14" />
      <line x1="18" y1="18" x2="30" y2="18" />
      <line x1="19" y1="22" x2="29" y2="22" />
    </svg>
  );
}

function thumbLabel(keyName: string) {
  if (keyName === 'ct') return 'CT';
  if (keyName === 'mri') return 'MRI';
  return 'X-RAY';
}

/* ─── Animated clock hands (matches HTML) ─────────────── */
function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const hDeg = h * 30 + m * 0.5;
  const mDeg = m * 6;
  return (
    <div className={styles.clockFace}>
      <div className={`${styles.clockHand} ${styles.clockH}`} style={{ transform: `rotate(${hDeg}deg) translateX(-50%)` }} />
      <div className={`${styles.clockHand} ${styles.clockM}`} style={{ transform: `rotate(${mDeg}deg) translateX(-50%)` }} />
    </div>
  );
}

/* ─── Main Dashboard component ────────────────────────── */
export function Dashboard() {
  const navigate = useNavigate();
  const { data: casesData, loading: casesLoading } = useCases();
  const { data: sessionsData } = useSessions();

  const [activeModality, setActiveModality] = useState('Tất cả');
  const [activeDifficulty, setActiveDifficulty] = useState('Tất cả');

  const statusMap = useMemo<Record<string, SessionStatus>>(() => {
    const map: Record<string, SessionStatus> = {};
    for (const s of (sessionsData?.results ?? [])) {
      map[s.case_id ?? s.case] = s.status === 'COMPLETED' ? 'Hoàn thành' : 'Đang làm';
    }
    return map;
  }, [sessionsData]);

  const cases = useMemo<CaseItem[]>(() => {
    if (!casesData?.cases) return [];
    return casesData.cases.map((c: any) => ({
      id: String(c.id),
      title: c.title,
      modality: mapModality(c.modality),
      difficulty: mapDifficulty(c.difficulty),
      hint: c.clinical_history || c.description || '',
      status: statusMap[String(c.id)] ?? 'Chưa làm',
      imageKey: getImageKey(c.modality),
    }));
  }, [casesData, statusMap]);

  const filtered = cases.filter(
    (c) =>
      (activeModality === 'Tất cả' || c.modality === activeModality) &&
      (activeDifficulty === 'Tất cả' || c.difficulty === activeDifficulty)
  );

  const stats = useMemo(() => ({
    total:      cases.length,
    done:       cases.filter((c) => c.status === 'Hoàn thành').length,
    inProgress: cases.filter((c) => c.status === 'Đang làm').length,
    notStarted: cases.filter((c) => c.status === 'Chưa làm').length,
  }), [cases]);

  const completionPct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className={styles.page}>

      {/* ── Header (breadcrumb + clock + search) ── */}
      <header className={styles.header}>
        <div className={styles.breadcrumb}>
          📖&nbsp;
          <strong>My Cases</strong>
          <span className={styles.crumbSep}>›</span>
          <span style={{ opacity: 0.6 }}>
            {activeModality === 'Tất cả' ? 'All Modalities' : activeModality}
          </span>
        </div>
        <div className={styles.headerCenter}>
          <Clock />
          <span>Session</span>
        </div>
        <div className={styles.searchBox}>
          <svg viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Search cases…
        </div>
      </header>

      <div className={styles.content}>

        {/* ── Page header ── */}
        <div className={styles.pageHeader}>
          <div>
            <div className={styles.pageEyebrow}>Case Library · 2024–2025</div>
            <h1 className={styles.pageTitle}>My Case Files</h1>
            <div className={styles.titleUnderline} />
            <div className={styles.pageSubtitle}>
              Reviewing radiological studies, one case at a time.
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <SketchBorder id="prof-dossier" color="#5A4030" opacity={0.7} />
            <div className={styles.statAccent} style={{ background: STAT_COLORS.total }} />
            <div className={styles.statVal}>{casesLoading ? '—' : stats.total}</div>
            <div className={styles.statLbl}>Total Cases</div>
            <div className={styles.statSub}>Tổng số ca học</div>
          </div>
          <div className={styles.statCard}>
            <SketchBorder id="prof-dossier" color="#5e795d" opacity={0.7} />
            <div className={styles.statAccent} style={{ background: STAT_COLORS.done }} />
            <div className={styles.statVal}>{casesLoading ? '—' : stats.done}</div>
            <div className={styles.statLbl}>Completed</div>
            <div className={styles.statSub}>{completionPct}% completion</div>
          </div>
          <div className={styles.statCard}>
            <SketchBorder id="prof-dossier" color="#7A6248" opacity={0.7} />
            <div className={styles.statAccent} style={{ background: STAT_COLORS.inProgress }} />
            <div className={styles.statVal}>{casesLoading ? '—' : stats.inProgress}</div>
            <div className={styles.statLbl}>In Progress</div>
            <div className={styles.statSub}>Đang làm dở</div>
          </div>
          <div className={styles.statCard}>
            <SketchBorder id="prof-dossier" color="#965656" opacity={0.7} />
            <div className={styles.statAccent} style={{ background: STAT_COLORS.notStarted }} />
            <div className={styles.statVal}>{casesLoading ? '—' : stats.notStarted}</div>
            <div className={styles.statLbl}>New Cases</div>
            <div className={styles.statSub}>Chưa bắt đầu</div>
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>Modality:</span>
          {MODALITY_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => setActiveModality(opt)}
              className={`${styles.filterBtn} ${activeModality === opt ? styles.filterBtnActive : ''}`}
            >
              {opt === 'Tất cả' ? 'All' : opt}
            </button>
          ))}
          <span className={styles.filterLabel} style={{ marginLeft: 12 }}>Difficulty:</span>
          {DIFFICULTY_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => setActiveDifficulty(opt)}
              className={`${styles.filterBtn} ${activeDifficulty === opt ? styles.filterBtnActive : ''}`}
            >
              {opt === 'Tất cả' ? 'All' : opt}
            </button>
          ))}
          <span className={styles.filterCount}>
            {casesLoading ? 'Đang tải...' : `${filtered.length} ca`}
          </span>
        </div>

        <div className={styles.ornament}>— ✦ —</div>

        {/* ── Case list (one per row) ── */}
        <div className={styles.casesGrid}>
          {casesLoading ? (
            [1, 2, 3, 4, 5].map((i) => <div key={i} className={styles.skeleton} />)
          ) : filtered.length > 0 ? (
            filtered.map((c, idx) => {
              const stamp = statusStamp[c.status];
              const badge = diffBadge[c.difficulty];
              const washi = modalityWashi[c.modality];
              const pct   = progressPct[c.status];
              const caseNum = `Case #${String(idx + 1).padStart(3, '0')}`;

              // Score / state in right column
              const rightScore =
                c.status === 'Hoàn thành' ? (
                  <>
                    <div className={styles.cardScore}>
                      {Math.floor(70 + (idx * 7) % 25)}
                      <span style={{ fontSize: 12, color: 'var(--ink-faded)' }}>/100</span>
                    </div>
                    <div className={styles.cardScoreLbl}>Your Score</div>
                  </>
                ) : c.status === 'Đang làm' ? (
                  <>
                    <div className={`${styles.cardScore} ${styles.cardScoreMuted}`}>—</div>
                    <div className={styles.cardScoreLbl}>Pending</div>
                  </>
                ) : (
                  <>
                    <div className={`${styles.cardScore} ${styles.cardScoreStart}`}>START</div>
                    <div className={styles.cardScoreLbl}>New Case</div>
                  </>
                );

              return (
                <div
                  key={c.id}
                  className={styles.caseCard}
                  onClick={() => navigate(`/session/${c.id}`)}
                >
                  <SketchBorder id={`card-${c.id}`} color="#7A6248" opacity={0.5} />
                  {/* left accent strip */}
                  <div className={`${styles.cardAccent} ${accentClass[c.modality]}`} />

                  {/* thumbnail */}
                  <div className={styles.cardThumb}>
                    <div className={styles.thumbPlaceholder}>
                      <ThumbSvg keyName={c.imageKey} />
                      <span className={styles.thumbLabel}>{thumbLabel(c.imageKey)}</span>
                    </div>
                  </div>

                  {/* body */}
                  <div className={styles.cardBody}>
                    <div className={styles.cardTop}>
                      <span className={styles.caseNum}>{caseNum}</span>
                      <span className={`${styles.washi} ${washi.cls}`}>{washi.label}</span>
                      <span className={`${styles.stamp} ${stamp.cls}`}>{stamp.label}</span>
                    </div>
                    <div className={styles.caseTitle}>{c.title}</div>
                    <div className={styles.caseMeta}>
                      {c.hint || 'Chưa có mô tả lâm sàng.'}
                    </div>
                    <div className={styles.cardTags}>
                      <span className={`${styles.diffBadge} ${badge.cls}`}>{badge.label}</span>
                      <span className={`${styles.washi} ${styles.washiAmber}`} style={{ fontSize: 9, transform: 'rotate(-0.5deg)' }}>
                        {c.difficulty}
                      </span>
                      <span className={styles.tagTime}>~15 phút</span>
                    </div>
                    <div className={styles.pencilWrap}>
                      <div className={styles.pencilTrack}>
                        <div className={styles.pencilFill} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={styles.pencilPct}>{pct}%</span>
                    </div>
                  </div>

                  {/* right column */}
                  <div className={styles.cardRight}>
                    {rightScore}
                    <div className={styles.cardDate}>{c.difficulty}</div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className={styles.empty}>
              <div className={styles.emptyOrn}>✦</div>
              <div className={styles.emptyTitle}>Chưa có ca nào</div>
              <div className={styles.emptySub}>Thử thay đổi bộ lọc để xem thêm ca học</div>
            </div>
          )}
        </div>

        {/* sticky note */}
        {!casesLoading && filtered.length > 0 && (
          <div className={styles.stickyRow}>
            <div className={styles.stickyNote}>
              Mẹo: Tập trung luyện các ca X-Ray trước để nắm vững giải phẫu cơ bản! 📌
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
