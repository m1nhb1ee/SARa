import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useCases, useSessions, useUploadedCases, useDeleteUploadedCase, useDeleteSession } from '@/api/hooks';
import { mapModality, mapDifficulty, getImageKey } from '@/utils/mappers';
import type { CaseItem, SessionStatus, Modality, Difficulty } from '@/types';
import { SketchBorder } from '@/app/components/shared/SketchBorder';
import styles from '@/styles/Dashboard.module.css';

const MODALITY_OPTIONS = ['Tất cả', 'X-Ray', 'CT', 'MRI'];
const DIFFICULTY_OPTIONS = ['Tất cả', 'Cơ bản', 'Trung bình', 'Nặng cao'];
const CARDS_PER_PAGE = 7;

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
  total:      'var(--ink)',
  done:       'var(--accent-sage)',
  inProgress: 'var(--accent-ochre)',
  notStarted: 'var(--accent-clay)',
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

/* ─── Animated clock hands ─────────────────────────── */
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
  const { data: uploadsData } = useUploadedCases();
  const { deleteCase } = useDeleteUploadedCase();
  const { deleteSession } = useDeleteSession();

  const [activeModality, setActiveModality] = useState('Tất cả');
  const [activeDifficulty, setActiveDifficulty] = useState('Tất cả');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [erasingId, setErasingId] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [resumeTarget, setResumeTarget] = useState<{ caseId: string; sessionId: string; title: string } | null>(null);
  const [discarding, setDiscarding] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left');

  // Reset to page 1 on filter change
  useEffect(() => { setCurrentPage(1); setSlideDir('left'); }, [activeModality, activeDifficulty]);

  // case_id → upload_session_id (only for user-uploaded cases)
  const uploadSessionMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const u of (uploadsData?.results ?? [])) {
      if (u.case_id) map[String(u.case_id)] = String(u.id);
    }
    return map;
  }, [uploadsData]);

  const handleDelete = (e: React.MouseEvent, caseId: string) => {
    e.stopPropagation();
    const uploadSessionId = uploadSessionMap[caseId];
    if (!uploadSessionId) return;
    setConfirmDeleteId(null);
    setErasingId(caseId);
    deleteCase(uploadSessionId);
    setTimeout(() => {
      setErasingId(null);
      setDeletedIds(prev => new Set([...prev, caseId]));
    }, 900);
  };

  const statusMap = useMemo<Record<string, SessionStatus>>(() => {
    const map: Record<string, SessionStatus> = {};
    for (const s of (sessionsData?.results ?? [])) {
      map[s.case_id ?? s.case] = s.status === 'COMPLETED' ? 'Hoàn thành' : 'Đang làm';
    }
    return map;
  }, [sessionsData]);

  // Maps case_id → final_score (0–1) for completed sessions
  const scoreMap = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const s of (sessionsData?.results ?? [])) {
      if (s.status === 'COMPLETED' && s.final_score != null) {
        map[s.case_id ?? s.case] = s.final_score;
      }
    }
    return map;
  }, [sessionsData]);

  // Maps case_id → most recent non-completed session id (for resume/discard flow)
  const activeSessionMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const s of (sessionsData?.results ?? [])) {
      if (s.status !== 'COMPLETED') {
        map[s.case_id ?? s.case] = s.id;
      }
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
      !deletedIds.has(c.id) &&
      (activeModality === 'Tất cả' || c.modality === activeModality) &&
      (activeDifficulty === 'Tất cả' || c.difficulty === activeDifficulty)
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / CARDS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * CARDS_PER_PAGE, currentPage * CARDS_PER_PAGE);

  // Global index offset for case number labels
  const pageOffset = (currentPage - 1) * CARDS_PER_PAGE;

  const goNext = () => {
    if (currentPage < totalPages) {
      setSlideDir('right');
      setCurrentPage(p => p + 1);
    }
  };
  const goPrev = () => {
    if (currentPage > 1) {
      setSlideDir('left');
      setCurrentPage(p => p - 1);
    }
  };

  const stats = useMemo(() => ({
    total:      cases.length,
    done:       cases.filter((c) => c.status === 'Hoàn thành').length,
    inProgress: cases.filter((c) => c.status === 'Đang làm').length,
    notStarted: cases.filter((c) => c.status === 'Chưa làm').length,
  }), [cases]);

  const completionPct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  // animation class for current page direction
  const cardAnimClass = slideDir === 'right' ? styles.cardSlideRight : styles.cardSlideLeft;

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.breadcrumb}>
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
            <SketchBorder id="prof-dossier" color="var(--ink)" opacity={0.7} />
            <div className={styles.statAccent} style={{ background: STAT_COLORS.total }} />
            <div className={styles.statVal}>{casesLoading ? '—' : stats.total}</div>
            <div className={styles.statLbl}>Total Cases</div>
            <div className={styles.statSub}>Tổng số ca học</div>
          </div>
          <div className={styles.statCard}>
            <SketchBorder id="prof-dossier2" color="var(--accent-sage)" opacity={0.7} />
            <div className={styles.statAccent} style={{ background: STAT_COLORS.done }} />
            <div className={styles.statVal}>{casesLoading ? '—' : stats.done}</div>
            <div className={styles.statLbl}>Completed</div>
            <div className={styles.statSub}>{completionPct}% completion</div>
          </div>
          <div className={styles.statCard}>
            <SketchBorder id="prof-dossier3" color="var(--ink-secondary)" opacity={0.7} />
            <div className={styles.statAccent} style={{ background: STAT_COLORS.inProgress }} />
            <div className={styles.statVal}>{casesLoading ? '—' : stats.inProgress}</div>
            <div className={styles.statLbl}>In Progress</div>
            <div className={styles.statSub}>Đang làm dở</div>
          </div>
          <div className={styles.statCard}>
            <SketchBorder id="prof-dossier4" color="var(--accent-clay)" opacity={0.7} />
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
            {casesLoading ? 'Loading...' : `${filtered.length} ca`}
          </span>
        </div>

        <div className={styles.ornament}>— ✦ —</div>

        {/* ── Case list ── */}
        {/* key on grid so re-mount triggers slide-in animation on page change */}
        <div
          key={`${currentPage}-${activeModality}-${activeDifficulty}`}
          className={styles.casesGrid}
        >
          {casesLoading ? (
            [1, 2, 3, 4, 5].map((i) => <div key={i} className={styles.skeleton} />)
          ) : paginated.length > 0 ? (
            paginated.map((c, idx) => {
              const globalIdx = pageOffset + idx;
              const stamp = statusStamp[c.status];
              const badge = diffBadge[c.difficulty];
              const washi = modalityWashi[c.modality];
              const pct   = progressPct[c.status];
              const caseNum = `Case #${String(globalIdx + 1).padStart(3, '0')}`;
              const isOwned = !!uploadSessionMap[c.id];
              const isConfirming = confirmDeleteId === c.id;
              const isErasing = erasingId === c.id;

              const rawScore = scoreMap[c.id];
              const displayScore = rawScore != null ? Math.round(rawScore * 100) : null;

              const rightScore =
                c.status === 'Hoàn thành' ? (
                  <>
                    <div className={styles.cardScore}>
                      {displayScore ?? '—'}
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
                  className={[
                    styles.caseCard,
                    cardAnimClass,
                    isErasing ? styles.cardCollapsing : '',
                  ].join(' ')}
                  style={{ animationDelay: `${idx * 55}ms` }}
                  onClick={() => {
                    if (isConfirming || isErasing) return;
                    const sid = activeSessionMap[c.id];
                    if (sid) {
                      setResumeTarget({ caseId: c.id, sessionId: sid, title: c.title });
                    } else {
                      navigate(`/session/${c.id}`);
                    }
                  }}
                >
                  {/* erase overlay — sweeps across when deleting */}
                  {isErasing && <div className={styles.eraseOverlay} />}

                  <SketchBorder id={`card-${c.id}`} color="var(--ink-secondary)" opacity={0.5} />

                  {/* left accent strip */}
                  <div className={`${styles.cardAccent} ${accentClass[c.modality]}`} />

                  {/* trash button — only for user-uploaded cases */}
                  {isOwned && !isConfirming && !isErasing && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(c.id); }}
                      title="Xóa case này"
                      style={{
                        position: 'absolute', top: 8, right: 8, zIndex: 2,
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        padding: '4px', opacity: 0.4, lineHeight: 1,
                        transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--accent-clay)" strokeWidth="1.6" strokeLinecap="round">
                        <polyline points="1,3 13,3" />
                        <path d="M4,3V2a1,1 0 0,1 1-1h4a1,1 0 0,1 1,1v1" />
                        <rect x="2" y="3" width="10" height="9" rx="1" />
                        <line x1="5" y1="6" x2="5" y2="10" />
                        <line x1="9" y1="6" x2="9" y2="10" />
                      </svg>
                    </button>
                  )}

                  {/* inline delete confirm */}
                  {isConfirming && (
                    <div
                      onClick={e => e.stopPropagation()}
                      style={{
                        position: 'absolute', inset: 0, zIndex: 3,
                        background: 'rgba(250,243,227,0.7)',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: 10,
                      }}
                    >
                      <div style={{ fontFamily: "var(--font-typewriter)", fontSize: 12, color: 'var(--ink)', letterSpacing: '0.06em' }}>
                        Xóa case này?
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={e => handleDelete(e, c.id)}
                          style={{
                            fontFamily: "var(--font-typewriter)", fontSize: 11,
                            background: 'var(--accent-clay)', color: 'var(--bg-page)',
                            border: 'none', padding: '5px 16px', cursor: 'pointer',
                            letterSpacing: '0.05em',
                          }}
                        >
                          Xóa
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); }}
                          style={{
                            fontFamily: "var(--font-typewriter)", fontSize: 11,
                            background: 'transparent', color: 'var(--ink-secondary)',
                            border: '1px solid var(--border)', padding: '5px 16px', cursor: 'pointer',
                          }}
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  )}

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

        {/* ── Pagination ── */}
        {!casesLoading && totalPages > 1 && (
          <div className={styles.paginationRow}>
            <button
              className={styles.pageBtn}
              onClick={goPrev}
              disabled={currentPage === 1}
            >
              ← previous
            </button>
            <span className={styles.pageMid}>
              {currentPage} / {totalPages}
            </span>
            <button
              className={styles.pageBtn}
              onClick={goNext}
              disabled={currentPage === totalPages}
            >
              next →
            </button>
          </div>
        )}

        {/* sticky note */}
        {!casesLoading && filtered.length > 0 && (
          <div className={styles.stickyRow}>
            <div className={styles.stickyNote}>
              Mẹo: Tập trung luyện các ca X-Ray trước để nắm vững giải phẫu cơ bản! 📌
            </div>
          </div>
        )}

      </div>

      {/* ── Resume/Restart modal ── */}
      {resumeTarget && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(44,24,16,0.62)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => !discarding && setResumeTarget(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-page)',
              maxWidth: 480, width: '100%',
              position: 'relative',
              boxShadow: '0 8px 40px rgba(44,24,16,0.32)',
            }}
          >
            <SketchBorder id="resume-modal-border" color="var(--ink-secondary)" opacity={0.75} />

            {/* ── Header strip ── */}
            <div style={{
              background: 'var(--bg-surface-alt)',
              borderBottom: '2px solid var(--border)',
              padding: '18px 28px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10, letterSpacing: '0.22em',
                  textTransform: 'uppercase', color: 'var(--ink-secondary)',
                  marginBottom: 4,
                }}>
                  — Session đang làm dở —
                </div>
                <div style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 17, fontWeight: 700, color: 'var(--ink)',
                  lineHeight: 1.35,
                }}>
                  {resumeTarget.title}
                </div>
              </div>
              <button
                disabled={discarding}
                onClick={() => setResumeTarget(null)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontFamily: "var(--font-display)",
                  fontSize: 22, lineHeight: 1,
                  color: 'var(--accent-clay)', padding: '0 0 2px 12px',
                  flexShrink: 0,
                }}
                title="Đóng"
              >
                ✕
              </button>
            </div>

            {/* ── Body ── */}
            <div style={{ padding: '22px 28px 16px' }}>
              <div style={{
                fontFamily: "'Lora', Georgia, serif",
                fontSize: 14, color: 'var(--ink)', lineHeight: 1.75,
              }}>
                Bạn đã làm dở case này. Muốn tiếp tục từ bước đang dở, hay xóa và bắt đầu lại từ đầu?
              </div>
            </div>

            {/* ── Footer buttons ── */}
            <div style={{
              display: 'flex', gap: 12,
              padding: '4px 28px 24px',
            }}>
              {/* Tiếp tục — dark ink fill */}
              <div
                role="button"
                onClick={() => {
                  if (discarding) return;
                  const cid = resumeTarget.caseId;
                  setResumeTarget(null);
                  navigate(`/session/${cid}`);
                }}
                style={{
                  flex: 1, position: 'relative',
                  background: 'var(--ink)', color: 'var(--bg-page)',
                  padding: '13px 0', textAlign: 'center',
                  fontFamily: "var(--font-typewriter)",
                  fontSize: 14, letterSpacing: '0.08em',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-gold-hover)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--ink)'; }}
              >
                <SketchBorder id="btn-continue" color="var(--bg-page)" opacity={0.4} />
                Tiếp tục
              </div>

              {/* Làm lại — terracotta sketch outline, fills on hover */}
              <div
                role="button"
                onClick={async () => {
                  if (discarding) return;
                  setDiscarding(true);
                  await deleteSession(resumeTarget.sessionId);
                  setDiscarding(false);
                  const cid = resumeTarget.caseId;
                  setResumeTarget(null);
                  navigate(`/session/${cid}`);
                }}
                style={{
                  flex: 1, position: 'relative',
                  background: 'transparent', color: 'var(--accent-clay)',
                  padding: '13px 0', textAlign: 'center',
                  fontFamily: "var(--font-typewriter)",
                  fontSize: 14, letterSpacing: '0.08em',
                  cursor: discarding ? 'not-allowed' : 'pointer',
                  opacity: discarding ? 0.55 : 1,
                  userSelect: 'none',
                  transition: 'background 0.18s, color 0.18s',
                }}
                onMouseEnter={e => {
                  if (discarding) return;
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = 'var(--accent-clay)';
                  el.style.color = 'var(--bg-page)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = 'transparent';
                  el.style.color = 'var(--accent-clay)';
                }}
              >
                <SketchBorder id="btn-restart" color="var(--accent-clay)" opacity={0.85} />
                {discarding ? 'Đang xóa...' : 'Làm lại từ đầu'}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
