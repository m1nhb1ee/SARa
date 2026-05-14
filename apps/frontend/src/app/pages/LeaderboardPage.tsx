import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Activity, ChevronRight, ClipboardList, Crown, Home as HomeIcon,
  Medal, Stethoscope, Trophy
} from 'lucide-react';
import { SketchBorder } from '@/app/components/shared/SketchBorder';
import { useLeaderboard } from '@/api/hooks';

type BoardType = 'exam' | 'case';

type LeaderboardEntry = {
  rank: number;
  user_id: string;
  display_name: string;
  university?: string | null;
  avg_score: number;
  total_completed: number;
  is_self?: boolean;
};

const BOARD_COPY: Record<BoardType, {
  title: string;
  eyebrow: string;
  description: string;
  icon: typeof ClipboardList;
  accent: string;
}> = {
  exam: {
    title: 'Exam Ranking',
    eyebrow: 'Locked Exam Average',
    description: 'Top 50 students by completed exam average. Minimum 3 exams required.',
    icon: ClipboardList,
    accent: 'var(--accent-clay)',
  },
  case: {
    title: 'Case Ranking',
    eyebrow: 'Diagnostic Case Average',
    description: 'Top 50 students by completed diagnosis case average. Minimum 3 cases required.',
    icon: Stethoscope,
    accent: 'var(--accent-sage)',
  },
};

function formatScore(score: number) {
  return `${Math.round((score ?? 0) * 100)}%`;
}

function PodiumCard({ entry, index, accent }: { entry: LeaderboardEntry; index: number; accent: string }) {
  const heights = [172, 142, 118];
  const labels = ['Champion', 'Second', 'Third'];
  const medalColors = ['var(--accent-gold)', 'var(--ink-secondary)', 'var(--accent-clay)'];

  return (
    <div
      className="relative flex flex-col justify-end"
      style={{
        minHeight: 260,
        animation: `leader-pop 520ms cubic-bezier(.2,.8,.2,1) ${index * 90}ms both`,
      }}
    >
      <div
        className="mb-3 mx-auto w-16 h-16 rounded-full flex items-center justify-center border-2"
        style={{
          background: 'var(--bg-surface-alt)',
          borderColor: medalColors[index],
          boxShadow: '0 8px 20px rgba(62,31,13,0.14)',
        }}
      >
        {index === 0 ? <Crown className="w-7 h-7" style={{ color: medalColors[index] }} /> : <Medal className="w-7 h-7" style={{ color: medalColors[index] }} />}
      </div>

      <div className="text-center mb-3">
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: 'var(--ink)', fontWeight: 700 }}>
          {entry.display_name}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-secondary)', minHeight: 18 }}>
          {entry.university || 'Independent learner'}
        </div>
      </div>

      <div
        className="relative rounded-t border overflow-hidden"
        style={{
          height: heights[index],
          background: `linear-gradient(180deg, ${accent}22, var(--bg-surface-alt))`,
          borderColor: 'var(--border)',
        }}
      >
        <SketchBorder id={`leader-podium-${entry.user_id}`} color="var(--ink-secondary)" opacity={0.55} />
        <div className="absolute inset-x-0 top-4 text-center" style={{ zIndex: 1 }}>
          <div style={{ fontFamily: 'var(--font-typewriter)', fontSize: 11, color: 'var(--ink-secondary)', textTransform: 'uppercase' }}>
            {labels[index]}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 34, color: 'var(--ink)', fontWeight: 700 }}>
            #{entry.rank}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: accent, fontWeight: 700 }}>
            {formatScore(entry.avg_score)}
          </div>
          <div style={{ fontFamily: "'Caveat', cursive", fontSize: 18, color: 'var(--ink-secondary)' }}>
            {entry.total_completed} completed
          </div>
        </div>
      </div>
    </div>
  );
}

export function LeaderboardPage() {
  const navigate = useNavigate();
  const [boardType, setBoardType] = useState<BoardType>('exam');
  const { data, loading, error } = useLeaderboard(boardType, 50);
  const board = BOARD_COPY[boardType];
  const BoardIcon = board.icon;
  const entries: LeaderboardEntry[] = data?.entries ?? [];
  const podium = entries.slice(0, 3);
  const rows = entries.slice(3);

  const stats = useMemo(() => {
    const best = entries[0]?.avg_score ?? 0;
    const avg = entries.length
      ? entries.reduce((sum, entry) => sum + entry.avg_score, 0) / entries.length
      : 0;
    return [
      { label: 'Qualified', value: String(data?.total_qualified ?? 0) },
      { label: 'Top score', value: formatScore(best) },
      { label: 'Top 50 avg', value: formatScore(avg) },
      { label: 'Minimum', value: `${data?.min_required ?? 3} done` },
    ];
  }, [data, entries]);

  return (
    <div
      style={{
        minHeight: '100%',
        backgroundColor: 'var(--bg-page)',
        backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, rgba(196,168,130,0.18) 31px, rgba(196,168,130,0.18) 32px)',
        backgroundSize: '100% 32px',
      }}
    >
      <style>
        {`
          @keyframes leader-pop {
            from { opacity: 0; transform: translateY(18px) scale(.97); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes leader-scan {
            from { transform: translateX(-55%); opacity: .1; }
            50% { opacity: .36; }
            to { transform: translateX(55%); opacity: .1; }
          }
          .leader-row { transition: transform .18s ease, background .18s ease; }
          .leader-row:hover { transform: translateX(4px); background: rgba(250, 222, 139, .2); }
        `}
      </style>

      <div
        className="px-8 py-4 flex justify-between items-center border-b sticky top-0 z-10"
        style={{ background: 'var(--bg-page)', borderColor: 'var(--border)', fontFamily: 'var(--font-mono)' }}
      >
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink-secondary)' }}>
          <HomeIcon className="w-4 h-4" />
          <button type="button" onClick={() => navigate('/home')} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer' }}>
            Home
          </button>
          <ChevronRight className="w-3 h-3" />
          <span style={{ color: 'var(--ink)' }}>BXH</span>
        </div>
        <div className="text-sm" style={{ color: 'var(--ink-secondary)' }}>
          Top 50 - minimum 3 completed
        </div>
      </div>

      <div className="p-8 max-w-[1400px] mx-auto">
        <section className="relative overflow-hidden border rounded p-8 mb-8" style={{ background: 'var(--bg-surface-alt)', borderColor: 'var(--border)', boxShadow: '0 2px 8px rgba(62,31,13,0.12)' }}>
          <SketchBorder id="leader-hero" color="var(--ink-secondary)" opacity={0.7} />
          <div
            aria-hidden
            className="absolute top-0 bottom-0 w-1/2"
            style={{
              left: 0,
              background: `linear-gradient(90deg, transparent, ${board.accent}22, transparent)`,
              animation: 'leader-scan 4.8s ease-in-out infinite',
            }}
          />
          <div className="relative z-[1] flex flex-col lg:flex-row gap-8 justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 border rounded mb-4" style={{ borderColor: 'var(--border)', color: board.accent, fontFamily: 'var(--font-typewriter)', fontSize: 12, textTransform: 'uppercase' }}>
                <BoardIcon className="w-4 h-4" />
                {board.eyebrow}
              </div>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '3rem', lineHeight: 1, color: 'var(--ink)', margin: 0 }}>
                Leaderboard
              </h1>
              <p className="mt-3" style={{ fontFamily: "'Caveat', cursive", fontSize: 24, color: 'var(--ink-secondary)' }}>
                {board.description}
              </p>
            </div>

            <div className="flex flex-col gap-4 min-w-[280px]">
              <div className="grid grid-cols-2 gap-3">
                {stats.map((stat) => (
                  <div key={stat.label} className="p-3 border rounded" style={{ borderColor: 'var(--border)', background: 'var(--bg-page)' }}>
                    <div style={{ fontFamily: 'var(--font-typewriter)', fontSize: 11, color: 'var(--ink-secondary)', textTransform: 'uppercase' }}>{stat.label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--ink)', fontWeight: 700 }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              <div className="inline-flex p-1 border rounded" style={{ borderColor: 'var(--border)', background: 'var(--bg-page)' }}>
                {(['exam', 'case'] as BoardType[]).map((type) => {
                  const active = boardType === type;
                  const copy = BOARD_COPY[type];
                  const Icon = copy.icon;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setBoardType(type)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded transition-all"
                      style={{
                        border: 'none',
                        background: active ? copy.accent : 'transparent',
                        color: active ? 'var(--bg-page)' : 'var(--ink-secondary)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      <Icon className="w-4 h-4" />
                      {type === 'exam' ? 'Exam' : 'Case'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {loading && (
          <div className="p-8 text-center border rounded" style={{ background: 'var(--bg-surface-alt)', borderColor: 'var(--border)', color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)' }}>
            Loading ranking...
          </div>
        )}

        {error && !loading && (
          <div className="p-8 text-center border rounded" style={{ background: 'var(--bg-surface-alt)', borderColor: 'var(--accent-clay)', color: 'var(--accent-clay)', fontFamily: 'var(--font-mono)' }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end mb-8">
              {podium.length === 0 ? (
                <div className="md:col-span-3 p-8 text-center border rounded" style={{ background: 'var(--bg-surface-alt)', borderColor: 'var(--border)', color: 'var(--ink-secondary)', fontFamily: "'Caveat', cursive", fontSize: 22 }}>
                  No qualified students yet.
                </div>
              ) : (
                podium.map((entry, index) => <PodiumCard key={entry.user_id} entry={entry} index={index} accent={board.accent} />)
              )}
            </section>

            <section className="border rounded overflow-hidden relative" style={{ background: 'var(--bg-surface-alt)', borderColor: 'var(--border)' }}>
              <SketchBorder id="leader-table" color="var(--ink)" opacity={0.75} />
              <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', color: 'var(--ink)', margin: 0 }}>{board.title}</h2>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-secondary)', marginTop: 2 }}>
                    Ranked by average score, then completed count.
                  </p>
                </div>
                <Trophy className="w-8 h-8" style={{ color: board.accent }} />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', fontFamily: 'var(--font-typewriter)', fontSize: 11, color: 'var(--ink-secondary)' }}>
                      <th className="text-left p-4">RANK</th>
                      <th className="text-left p-4">USER</th>
                      <th className="text-left p-4">UNIVERSITY</th>
                      <th className="text-left p-4">AVG SCORE</th>
                      <th className="text-left p-4">COMPLETED</th>
                      <th className="text-left p-4">SIGNAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...podium, ...rows].map((entry) => (
                      <tr
                        key={entry.user_id}
                        className="leader-row"
                        style={{
                          borderBottom: '1px solid rgba(196,168,130,0.3)',
                          background: entry.is_self ? `${board.accent}18` : undefined,
                        }}
                      >
                        <td className="p-4" style={{ fontFamily: 'var(--font-mono)', color: board.accent, fontWeight: 700 }}>#{entry.rank}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center border" style={{ borderColor: board.accent, color: board.accent, background: 'var(--bg-page)' }}>
                              {entry.rank <= 3 ? <Medal className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                            </div>
                            <div>
                              <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)', fontWeight: 700 }}>{entry.display_name}</div>
                              {entry.is_self && <div style={{ fontFamily: "'Caveat', cursive", color: board.accent, fontSize: 16 }}>You</div>}
                            </div>
                          </div>
                        </td>
                        <td className="p-4" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-secondary)', fontSize: 13 }}>
                          {entry.university || '-'}
                        </td>
                        <td className="p-4" style={{ fontFamily: 'var(--font-typewriter)', color: 'var(--ink)', fontSize: 18, fontWeight: 700 }}>
                          {formatScore(entry.avg_score)}
                        </td>
                        <td className="p-4" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-secondary)' }}>
                          {entry.total_completed}
                        </td>
                        <td className="p-4">
                          <div className="h-3 min-w-[120px] border rounded overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-page)' }}>
                            <div style={{ height: '100%', width: formatScore(entry.avg_score), background: board.accent, opacity: 0.72 }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
