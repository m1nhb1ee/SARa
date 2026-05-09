import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  User, Pencil, Home as HomeIcon, ChevronRight,
  Flame, CheckCircle2, XCircle, Clock, Crown, Sparkles
} from 'lucide-react';
import { SketchBorder } from '@/app/components/shared/SketchBorder';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { useMyStats, useSessions } from '@/api/hooks';
import { useAuth } from '@/api/authContext';

export function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: stats } = useMyStats();
  const { data: sessionsData } = useSessions({ status: 'COMPLETED' });
  const isPremium = !!user?.is_premium;

  const recentSessions = (sessionsData?.results ?? []).slice(0, 6);

  const accuracyByStep: Record<string, number> = stats?.accuracy_by_step ?? {};
  const weakestStep = useMemo(() => {
    const entries = Object.entries(accuracyByStep);
    if (!entries.length) return null;
    return entries.reduce((a, b) => (b[1] < a[1] ? b : a));
  }, [accuracyByStep]);

  const avgScore = stats ? Math.round((stats.average_score ?? 0) * 100) : 0;
  const casesCompleted = stats?.total_cases_completed ?? 0;

  const accuracyByStep_chart = useMemo(() => {
    const entries = Object.entries(accuracyByStep);
    if (!entries.length) return [
      { modality: 'DESCRIBE',   accuracy: 0 },
      { modality: 'REASONING', accuracy: 0 },
      { modality: 'DDx',       accuracy: 0 },
      { modality: 'CONCLUSION', accuracy: 0 },
    ];
    return entries.map(([step, score]) => ({ modality: step, accuracy: Math.round((score as number) * 100) }));
  }, [accuracyByStep]);

  const monthlyTrend = useMemo(() => {
    const completed = (sessionsData?.results ?? []).filter(
      (s: any) => s.status === 'COMPLETED' && s.final_score != null && s.completed_at
    );
    if (!completed.length) return [];
    const byMonth: Record<string, number[]> = {};
    for (const s of completed) {
      const d = new Date(s.completed_at);
      const key = d.toLocaleDateString('en-GB', { month: 'short' }) + ' ' + String(d.getFullYear()).slice(-2);
      (byMonth[key] = byMonth[key] ?? []).push((s.final_score as number) * 100);
    }
    return Object.entries(byMonth).map(([month, scores]) => ({
      month,
      accuracy: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }));
  }, [sessionsData]);

  const modalityBreakdown = useMemo(() => {
    const palette: Record<string, string> = { 'X-Ray': 'var(--accent-clay)', CT: 'var(--accent-ink)', MRI: 'var(--accent-sage)' };
    const counts: Record<string, number> = {};
    for (const s of (sessionsData?.results ?? []) as any[]) {
      const m = s.case_modality || 'Unknown';
      counts[m] = (counts[m] ?? 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: palette[name] ?? 'var(--ink-secondary)',
    }));
  }, [sessionsData]);

  const weakAreas = weakestStep
    ? [{ category: weakestStep[0], accuracy: Math.round(weakestStep[1] * 100), attempted: 0 }]
    : [];

  const achievements = [
    { name: 'First Diagnosis', earned: casesCompleted >= 1,   icon: '🏅' },
    { name: '10 Cases',        earned: casesCompleted >= 10,  icon: '🎖️' },
    { name: '50 Cases',        earned: casesCompleted >= 50,  icon: '📅' },
    { name: '100 Cases',       earned: casesCompleted >= 100, icon: '💯' },
    { name: 'High Avg ≥80',    earned: avgScore >= 80,        icon: '🔬' },
    { name: 'Premium Member',  earned: isPremium,             icon: '⭐' },
  ];

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-surface-alt)',
    borderColor: 'var(--border)',
    boxShadow: '0 2px 8px rgba(62, 31, 13, 0.12)',
  };

  const getSessionStatus = (s: any): 'correct' | 'incorrect' | 'pending' => {
    if (s.status !== 'COMPLETED') return 'pending';
    const score = (s.final_score ?? 0) * 100;
    return score >= 70 ? 'correct' : 'incorrect';
  };

  const STREAK_DAYS = 28;
  const studyStreakDays = useMemo(() => {
    const days = new Set<string>();
    for (const s of (sessionsData?.results ?? []) as any[]) {
      if (!s.completed_at) continue;
      days.add(new Date(s.completed_at).toISOString().slice(0, 10));
    }
    const today = new Date();
    return Array.from({ length: STREAK_DAYS }).map((_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (STREAK_DAYS - 1 - i));
      return days.has(d.toISOString().slice(0, 10));
    });
  }, [sessionsData]);
  const totalStreakDays = studyStreakDays.filter(Boolean).length;

  const tierLabel = casesCompleted < 10
    ? 'LEVEL 1 — INTERN'
    : casesCompleted < 50
      ? 'LEVEL 2 — JUNIOR RESIDENT'
      : casesCompleted < 100
        ? 'LEVEL 3 — RESIDENT'
        : 'LEVEL 4 — SENIOR RESIDENT';

  return (
    <div style={{
      minHeight: '100%',
      backgroundColor: 'var(--bg-page)',
      backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, rgba(196,168,130,0.18) 31px, rgba(196,168,130,0.18) 32px)',
      backgroundSize: '100% 32px',
    }}>
      {/* Header Strip */}
      <div
        className="px-8 py-4 flex justify-between items-center border-b sticky top-0 z-10"
        style={{ background: 'var(--bg-page)', borderColor: 'var(--border)', fontFamily: "var(--font-mono)" }}
      >
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink-secondary)' }}>
          <HomeIcon className="w-4 h-4" />
          <span>Home</span>
          <ChevronRight className="w-3 h-3" />
          <span style={{ color: 'var(--ink)' }}>My Profile</span>
        </div>
        <div className="text-sm" style={{ color: 'var(--ink-secondary)' }}>
          {stats?.last_activity
            ? `Last session: ${new Date(stats.last_activity).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
            : 'No sessions yet'}
        </div>
      </div>

      <div className="p-8 max-w-[1400px] mx-auto">
        {/* ── Personal Dossier ── */}
        <div className="mb-8 p-8 rounded border shadow-lg relative overflow-hidden" style={cardStyle}>
          <SketchBorder id="prof-dossier" color="var(--ink-secondary)" opacity={0.7} />
          <div className="absolute top-0 right-0 w-12 h-12"
            style={{ background: 'linear-gradient(135deg, transparent 50%, var(--border) 50%)' }} />
          <div
            className="absolute top-4 right-4 w-24 h-24 rounded-full flex flex-col items-center justify-center text-center"
            style={{
              background: isPremium
                ? 'radial-gradient(circle, #C9A227 0%, #8C6F11 100%)'
                : 'radial-gradient(circle, var(--ink-secondary) 0%, #3E2A1D 100%)',
              border: '3px solid var(--border)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2), inset 0 -2px 4px rgba(0,0,0,0.3)',
              fontFamily: "var(--font-typewriter)",
              fontSize: '10px',
              color: 'var(--bg-page)',
              transform: 'rotate(-5deg)',
              gap: 2,
            }}
            title={isPremium ? 'Premium account' : 'Free account'}
          >
            {isPremium ? <Crown className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            {isPremium ? 'PREMIUM' : 'FREE TIER'}
          </div>

          <div className="flex gap-8">
            <div className="flex-shrink-0">
              <div className="relative w-48 h-56 rounded border-4 overflow-hidden"
                style={{ borderColor: 'var(--border)', background: 'var(--border-strong)', boxShadow: '0 4px 8px rgba(0,0,0,0.15), inset 0 0 20px rgba(0,0,0,0.1)' }}>
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-24 h-24" style={{ color: 'var(--ink-secondary)' }} />
                </div>
              </div>
              <div className="mt-3 text-center py-1 px-3 inline-block"
                style={{ background: 'var(--accent-clay)', color: 'var(--bg-page)', fontFamily: "var(--font-typewriter)", fontSize: '11px', transform: 'rotate(-1deg)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', textTransform: 'uppercase' }}>
                {user?.role || 'STUDENT'}
              </div>
            </div>

            <div className="flex-1 pt-4">
              <div className="mb-1" style={{ color: 'var(--ink-secondary)', fontFamily: "var(--font-mono)", fontSize: '12px' }}>Dr.</div>
              <h1 className="mb-2" style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.5rem', color: 'var(--ink)', fontWeight: 700 }}>
                {user?.full_name || user?.email || '—'}
              </h1>
              <div className="mb-6 h-0.5" style={{ background: 'var(--ink-secondary)', width: '200px', transform: 'skewY(-0.5deg)' }} />

              <div className="space-y-3" style={{ fontFamily: "var(--font-mono)", fontSize: '14px' }}>
                {[
                  { label: 'EMAIL',        value: user?.email ?? '—' },
                  { label: 'TIER',         value: isPremium ? 'PREMIUM' : 'FREE' },
                  { label: 'CASES DONE',   value: String(casesCompleted) },
                  { label: 'AVG SCORE',    value: `${avgScore}/100` },
                  { label: 'WEAKEST STEP', value: weakestStep?.[0] ?? '—' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-4">
                    <span className="w-36" style={{ color: 'var(--ink-secondary)', fontFamily: "var(--font-typewriter)", fontSize: '11px' }}>
                      {item.label}
                    </span>
                    <span style={{ color: 'var(--border)' }}>···</span>
                    <span style={{ color: 'var(--ink)' }}>{item.value}</span>
                  </div>
                ))}
              </div>

              <button className="mt-6 px-6 py-2 border-2 rounded hover:bg-black/5 transition-all"
                style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)', fontFamily: "var(--font-mono)", fontSize: '14px' }}>
                <Pencil className="w-4 h-4 inline mr-2" /> Edit Details
              </button>
            </div>
          </div>
        </div>

        {/* ── Two-column Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Left: Diagnostic Performance */}
          <div>
            <div className="mb-6">
              <h2 className="mb-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.75rem', color: 'var(--ink)' }}>
                Diagnostic Performance
              </h2>
              <p style={{ fontFamily: "'Caveat', cursive", fontSize: '1.1rem', color: 'var(--ink-secondary)' }}>
                How sharp is your eye?
              </p>
              <div className="text-center my-3" style={{ color: 'var(--border)' }}>——✦——</div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              
              {[
                { label: 'Overall Accuracy',  value: `${avgScore}%`,        trend: 'Based on your sessions', up: true },
                { label: 'Cases Completed',   value: String(casesCompleted), trend: 'Total cases done',       up: true },
                { label: 'Weakest Step',      value: weakestStep?.[0] ?? '—', trend: 'Focus area',           up: false },
              ].map((stat, idx) => (
                <div key={idx} className="p-4 border rounded relative" style={cardStyle}>
                  <SketchBorder id="prof-dossier" color="var(--ink-secondary)" opacity={0.7} />
                  <div className="text-xs mb-2" style={{ fontFamily: "var(--font-typewriter)", color: 'var(--ink-secondary)' }}>{stat.label}</div>
                  <div className="text-2xl mb-2" style={{ fontFamily: "var(--font-mono)", color: 'var(--ink)', fontWeight: 700 }}>{stat.value}</div>
                  <div style={{ fontFamily: "'Caveat', cursive", color: stat.up ? 'var(--accent-sage)' : 'var(--accent-ochre)', fontSize: '14px' }}>
                    {stat.trend}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 mb-6 border rounded relative" style={cardStyle}>
              <SketchBorder id="prof-scan-type" color="var(--ink-secondary)" opacity={0.7} />
              <h3 className="mb-4" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', color: 'var(--ink)' }}>
                Performance by Diagnostic Step
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={accuracyByStep_chart} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#D4B896" opacity={0.3} />
                  <XAxis type="number" domain={[0, 100]} stroke="var(--ink-secondary)" style={{ fontFamily: "var(--font-mono)", fontSize: '12px' }} />
                  <YAxis type="category" dataKey="modality" stroke="var(--ink-secondary)" style={{ fontFamily: "var(--font-mono)", fontSize: '12px' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-surface-alt)', border: '1px solid var(--border)', fontFamily: "var(--font-mono)" }} />
                  <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
                    {accuracyByStep_chart.map((_, i) => <Cell key={i} fill="var(--accent-ink)" opacity={0.7} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="p-6 border rounded relative" style={cardStyle}>
              <SketchBorder id="prof-monthly" color="var(--ink-secondary)" opacity={0.7} />
              <h3 className="mb-4" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', color: 'var(--ink)' }}>
                Monthly Accuracy Trend
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D4B896" opacity={0.3} />
                  <XAxis dataKey="month" stroke="var(--ink-secondary)" style={{ fontFamily: "var(--font-mono)", fontSize: '12px' }} />
                  <YAxis domain={[60, 85]} stroke="var(--ink-secondary)" style={{ fontFamily: "var(--font-mono)", fontSize: '12px' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-surface-alt)', border: '1px solid var(--border)', fontFamily: "var(--font-mono)" }} />
                  <Line type="monotone" dataKey="accuracy" stroke="var(--accent-clay)" strokeWidth={2} dot={{ fill: 'var(--accent-clay)', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right: Learning Progress */}
          <div>
            <div className="mb-6">
              <h2 className="mb-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.75rem', color: 'var(--ink)' }}>
                Learning Progress
              </h2>
              <p style={{ fontFamily: "'Caveat', cursive", fontSize: '1.1rem', color: 'var(--ink-secondary)' }}>
                The long road to mastery
              </p>
              <div className="text-center my-3" style={{ color: 'var(--border)' }}>——✦——</div>
            </div>

            {/* Study Streak */}
            <div className="p-6 mb-6 border rounded relative" style={cardStyle}>
              <SketchBorder id="prof-streak" color="var(--ink-secondary)" opacity={0.7} />
              <h3 className="mb-4" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', color: 'var(--ink)' }}>Study Streak</h3>
              <div className="grid grid-cols-7 gap-1 mb-4">
                {studyStreakDays.map((active, i) => (
                  <div key={i} className="aspect-square border flex items-center justify-center text-xs"
                    style={{
                      background: active ? 'var(--accent-sage)' : 'transparent',
                      borderColor: 'var(--border)',
                      opacity: active ? 0.9 : 0.3,
                      color: active ? 'var(--bg-page)' : 'var(--border)',
                    }}
                  >
                    {active ? '✓' : ''}
                  </div>
                ))}
              </div>
              <div className="text-center text-2xl" style={{ fontFamily: "var(--font-mono)", color: 'var(--ink)' }}>
                <Flame className="w-6 h-6 inline mr-2" style={{ color: 'var(--accent-clay)' }} />
                {totalStreakDays} / {STREAK_DAYS} ngày
              </div>
            </div>

            {/* Residency Rank */}
            <div className="p-6 mb-6 border rounded relative" style={cardStyle}>
              <SketchBorder id="prof-rank" color="var(--ink-secondary)" opacity={0.7} />
              <h3 className="mb-4" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', color: 'var(--ink)' }}>Residency Rank</h3>
              <div className="inline-block px-4 py-2 mb-4 rounded"
                style={{ background: 'var(--accent-clay)', color: 'var(--bg-page)', fontFamily: "var(--font-typewriter)", fontSize: '14px', transform: 'rotate(-1deg)' }}>
                {tierLabel}
              </div>
              <div className="relative h-8 border rounded overflow-hidden mb-2"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-page)' }}>
                <div className="h-full" style={{
                  width: `${Math.min((casesCompleted / 100) * 100, 100)}%`,
                  background: 'repeating-linear-gradient(45deg, var(--accent-sage), var(--accent-sage) 10px, #6B8A65 10px, #6B8A65 20px)',
                  opacity: 0.8,
                }} />
              </div>
              <p className="text-sm" style={{ fontFamily: "var(--font-mono)", color: 'var(--ink-secondary)' }}>
                {100 - casesCompleted > 0 ? `${100 - casesCompleted} cases to Senior Resident` : 'Senior Resident unlocked!'}
              </p>
            </div>

            {/* Cases by Scan Type */}
            <div className="p-6 border rounded relative" style={cardStyle}>
              <SketchBorder id="prof-pie" color="var(--ink-secondary)" opacity={0.7} />
              <h3 className="mb-4" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', color: 'var(--ink)' }}>Cases by Scan Type</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={modalityBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                    {modalityBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} opacity={0.8} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-surface-alt)', border: '1px solid var(--border)', fontFamily: "var(--font-mono)" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-4 flex-wrap">
                {modalityBreakdown.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ background: item.color, opacity: 0.8 }} />
                    <span className="text-xs" style={{ fontFamily: "var(--font-mono)", color: 'var(--ink-secondary)' }}>{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Weak Areas ── */}
        <div className="mb-8">
          <div className="mb-6">
            <h2 className="mb-2 inline-block" style={{
              fontFamily: "'Playfair Display', serif", fontSize: '1.75rem', color: 'var(--ink)',
              borderBottom: '3px solid var(--accent-clay)', paddingBottom: '4px',
            }}>
              Areas Needing Attention
            </h2>
            <p className="mt-2" style={{ fontFamily: "'Caveat', cursive", fontSize: '1.1rem', color: 'var(--accent-clay)' }}>
              Study these first! ⚠
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {weakAreas.length === 0 && (
              <div className="md:col-span-3 p-6 text-center" style={{ fontFamily: "'Caveat', cursive", color: 'var(--ink-secondary)', fontSize: '16px' }}>
                Hoàn thành thêm các session.
              </div>
            )}
            {weakAreas.map((area, idx) => (
              <div key={idx} className="p-6 border rounded relative hover:-translate-y-1 transition-transform cursor-pointer"
                style={{ background: 'rgba(192,57,43,0.04)', borderColor: 'var(--border)', boxShadow: '0 2px 8px rgba(62,31,13,0.12)' }}>
                <SketchBorder id={`prof-weak-${idx}`} color="var(--accent-clay)" opacity={0.85} />
                <div className="absolute top-0 right-4 w-8 h-10"
                  style={{ background: 'var(--accent-clay)', clipPath: 'polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)', opacity: 0.9 }} />
                <h4 className="mb-3" style={{ fontFamily: "var(--font-typewriter)", fontSize: '13px', color: 'var(--ink)' }}>
                  {area.category}
                </h4>
                <div className="text-2xl mb-3" style={{ fontFamily: "var(--font-mono)", color: 'var(--accent-clay)', fontWeight: 700 }}>
                  Accuracy: {area.accuracy}%
                </div>
                <div className="relative h-3 border rounded overflow-hidden mb-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-page)' }}>
                  <div className="h-full" style={{ width: `${area.accuracy}%`, background: 'var(--accent-ochre)', opacity: 0.7 }} />
                </div>
                <button className="text-sm hover:underline" style={{ fontFamily: "'Caveat', cursive", color: 'var(--accent-clay)', fontSize: '16px' }}
                  onClick={() => navigate('/')}>
                  Practice this step →
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Case History Log ── */}
        <div className="mb-8">
          <div className="mb-6 flex justify-between items-start">
            <div>
              <h2 className="mb-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.75rem', color: 'var(--ink)' }}>
                Case History Log
              </h2>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: '14px', color: 'var(--ink-secondary)' }}>
                Complete record of reviewed cases
              </p>
            </div>
            <div className="px-3 py-1 opacity-30"
              style={{ color: 'var(--accent-clay)', fontFamily: "var(--font-typewriter)", fontSize: '12px', border: '2px solid var(--accent-clay)', transform: 'rotate(-3deg)' }}>
              CONFIDENTIAL
            </div>
          </div>

          <div className="border rounded overflow-hidden relative" style={{ background: 'var(--bg-surface-alt)', borderColor: 'var(--border)' }}>
            <SketchBorder id="prof-history" color="var(--ink)" opacity={0.9} />
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', fontFamily: "var(--font-typewriter)", fontSize: '11px', color: 'var(--ink-secondary)' }}>
                    <th className="text-left p-4">CASE</th>
                    <th className="text-left p-4">DATE</th>
                    <th className="text-left p-4">MODALITY</th>
                    <th className="text-left p-4">SCORE</th>
                    <th className="text-left p-4">STATUS</th>
                    <th className="text-left p-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {recentSessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center" style={{ fontFamily: "'Caveat', cursive", color: 'var(--ink-secondary)', fontSize: '16px' }}>
                        No completed cases yet — upload your first scan to get started.
                      </td>
                    </tr>
                  ) : recentSessions.map((s: any, idx: number) => {
                    const score = (s.final_score ?? 0) * 100;
                    const status = getSessionStatus(s);
                    return (
                      <tr key={s.id} className="hover:bg-yellow-200/30 transition-colors cursor-pointer"
                        style={{ borderBottom: '1px solid rgba(196,168,130,0.3)' }}>
                        <td className="p-4" style={{ fontFamily: "var(--font-mono)", color: 'var(--accent-clay)', fontWeight: 700 }}>
                          {s.case_title ?? s.case_id}
                        </td>
                        <td className="p-4" style={{ fontFamily: "var(--font-mono)", color: 'var(--ink-secondary)', fontSize: '14px' }}>
                          {s.completed_at ? new Date(s.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                        </td>
                        <td className="p-4">
                          <span className="inline-block px-2 py-1 text-xs"
                            style={{ background: 'var(--accent-ink)', color: 'var(--bg-page)', fontFamily: "var(--font-mono)" }}>
                            {s.case_modality ?? 'X-RAY'}
                          </span>
                        </td>
                        <td className="p-4" style={{
                          fontFamily: "var(--font-typewriter)", fontSize: '16px', fontWeight: 700,
                          color: score >= 80 ? 'var(--accent-sage)' : score >= 60 ? 'var(--accent-ochre)' : 'var(--accent-clay)',
                        }}>
                          {Math.round(score)}/100
                        </td>
                        <td className="p-4">
                          {status === 'correct' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs"
                              style={{ color: 'var(--accent-sage)', fontFamily: "var(--font-typewriter)" }}>
                              <CheckCircle2 className="w-4 h-4" /> CORRECT
                            </span>
                          )}
                          {status === 'incorrect' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs"
                              style={{ color: 'var(--accent-clay)', fontFamily: "var(--font-typewriter)" }}>
                              <XCircle className="w-4 h-4" /> INCORRECT
                            </span>
                          )}
                          {status === 'pending' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs"
                              style={{ color: 'var(--border)', fontFamily: "var(--font-typewriter)" }}>
                              <Clock className="w-4 h-4" /> PENDING
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => navigate(`/answer-key/${s.case_id}`)}
                            className="hover:underline"
                            style={{ fontFamily: "'Caveat', cursive", color: 'var(--accent-clay)', fontSize: '15px' }}>
                            Review →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Achievement Badges ── */}
        <div className="mb-8">
          <div className="mb-6">
            <h2 className="mb-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.75rem', color: 'var(--ink)' }}>
              Commendations &amp; Medals
            </h2>
            <p style={{ fontFamily: "'Caveat', cursive", fontSize: '1.1rem', color: 'var(--ink-secondary)' }}>Hard-earned, every one.</p>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-6">
            {achievements.map((badge, idx) => (
              <div key={idx} className="text-center">
                <div className={`w-20 h-20 mx-auto mb-3 rounded-full flex items-center justify-center text-4xl border-4 ${badge.earned ? '' : 'opacity-30 grayscale'}`}
                  style={{
                    background: badge.earned ? 'radial-gradient(circle, var(--accent-clay) 0%, var(--accent-clay) 100%)' : 'var(--border)',
                    borderColor: 'var(--border)',
                    boxShadow: badge.earned ? '0 4px 8px rgba(0,0,0,0.2), inset 0 -2px 4px rgba(0,0,0,0.3)' : 'none',
                  }}>
                  {badge.icon}
                </div>
                <div className="text-xs" style={{ fontFamily: "var(--font-typewriter)", color: badge.earned ? 'var(--ink)' : 'var(--border)' }}>
                  {badge.name}
                </div>
                {!badge.earned && (
                  <div className="text-xs mt-1 px-2 py-0.5 inline-block"
                    style={{ color: 'var(--accent-clay)', fontFamily: "var(--font-mono)", fontSize: '10px' }}>
                    LOCKED
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
