import { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  User, Pencil, Home as HomeIcon, ChevronRight,
  Flame, CheckCircle2, XCircle, Clock
} from 'lucide-react';
import { SketchBorder } from '@/app/components/shared/SketchBorder';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { useMyStats, useSessions } from '@/api/hooks';
import { useAuth } from '@/api/authContext';
import { STEPS } from '@/constants/training';

export function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: stats } = useMyStats();
  const { data: sessionsData } = useSessions({ status: 'COMPLETED' });
  const [userProfile, setUserProfile] = useState<any>(null);

  // Fetch user profile if not available from auth
  useEffect(() => {
    if (user?.id) {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
      const token = localStorage.getItem('sara_token') || '';
      
      fetch(`${API_BASE}/auth/me/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then(res => res.json())
        .then(data => {
          console.log('User profile response:', data);
          setUserProfile(data.user);
        })
        .catch(err => console.error('Failed to fetch user profile:', err));
    }
  }, [user?.id]);

  const recentSessions = (sessionsData?.results ?? []).slice(0, 6);

  const accuracyByStep: Record<string, number> = stats?.accuracy_by_step ?? {};
  const weakestStep = useMemo(() => {
    const entries = Object.entries(accuracyByStep);
    if (!entries.length) return null;
    return entries.reduce((a, b) => (b[1] < a[1] ? b : a));
  }, [accuracyByStep]);

  const avgScore = stats ? Math.round((stats.average_score ?? 0) * 100) : 0;
  const casesCompleted = stats?.total_cases_completed ?? 0;

  // Real: accuracy by diagnostic step (from stats.accuracy_by_step)
  const accuracyByStep_chart = useMemo(() => {
    const entries = Object.entries(accuracyByStep);
    if (!entries.length) return [
      { modality: 'OBSERVE',    accuracy: 0 },
      { modality: 'DESCRIBE',   accuracy: 0 },
      { modality: 'INTERPRET',  accuracy: 0 },
      { modality: 'HYPOTHESIS', accuracy: 0 },
      { modality: 'DDx',        accuracy: 0 },
      { modality: 'CONCLUSION', accuracy: 0 },
    ];
    return entries.map(([step, score]) => ({ modality: step, accuracy: Math.round((score as number) * 100) }));
  }, [accuracyByStep]);

  // Real: monthly trend from completed sessions
  const monthlyTrend = useMemo(() => {
    const completed = (sessionsData?.results ?? []).filter(
      (s: any) => s.status === 'COMPLETED' && s.final_score != null && s.completed_at
    );
    if (!completed.length) return [
      { month: 'Oct', accuracy: 65 }, { month: 'Nov', accuracy: 70 },
      { month: 'Dec', accuracy: 74 }, { month: 'Jan', accuracy: 76 },
      { month: 'Feb', accuracy: 73 }, { month: 'Mar', accuracy: 78 },
      { month: 'Apr', accuracy: avgScore || 78 },
    ];
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
  }, [sessionsData, avgScore]);

  const modalityBreakdown = [
    { name: 'X-Ray',   value: 45, color: '#C0392B' },
    { name: 'CT Scan', value: 35, color: '#1B3A5C' },
    { name: 'MRI',     value: 20, color: '#7D9B76' },
  ];

  const weakAreas = weakestStep
    ? [{ category: weakestStep[0], accuracy: Math.round(weakestStep[1] * 100), attempted: 0 }]
    : [
        { category: 'Pulmonary Nodule Detection', accuracy: 41, attempted: 12 },
        { category: 'Vertebral Fractures',        accuracy: 52, attempted: 8  },
        { category: 'Intracranial Hemorrhage',    accuracy: 58, attempted: 15 },
      ];

  const achievements = [
    { name: 'First Diagnosis', earned: casesCompleted >= 1,   icon: '🏅' },
    { name: 'X-Ray Expert',    earned: casesCompleted >= 10,  icon: '🎖️' },
    { name: '7-Day Streak',    earned: false,                  icon: '📅' },
    { name: '100 Cases',       earned: casesCompleted >= 100, icon: '💯' },
    { name: 'CT Master',       earned: false,                  icon: '🔬' },
    { name: 'Perfect Week',    earned: false,                  icon: '⭐' },
  ];

  const cardStyle: React.CSSProperties = {
    background: '#EDE0C4',
    borderColor: '#C4A882',
    boxShadow: '0 2px 8px rgba(62, 31, 13, 0.12)',
  };

  const getSessionStatus = (s: any): 'correct' | 'incorrect' | 'pending' => {
    if (s.status !== 'COMPLETED') return 'pending';
    const score = (s.final_score ?? 0) * 100;
    return score >= 70 ? 'correct' : 'incorrect';
  };

  return (
    <div style={{
      minHeight: '100%',
      backgroundColor: '#F5EDD6',
      backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, rgba(196,168,130,0.18) 31px, rgba(196,168,130,0.18) 32px)',
      backgroundSize: '100% 32px',
    }}>
      {/* Header Strip */}
      <div
        className="px-8 py-4 flex justify-between items-center border-b sticky top-0 z-10"
        style={{ background: '#F5EDD6', borderColor: '#C4A882', fontFamily: "'Courier Prime', monospace" }}
      >
        <div className="flex items-center gap-2 text-sm" style={{ color: '#6B4C3B' }}>
          <HomeIcon className="w-4 h-4" />
          <span>Home</span>
          <ChevronRight className="w-3 h-3" />
          <span style={{ color: '#2C1810' }}>My Profile</span>
        </div>
        <div className="text-sm" style={{ color: '#6B4C3B' }}>
          {stats?.last_activity
            ? `Last session: ${new Date(stats.last_activity).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
            : 'No sessions yet'}
        </div>
      </div>

      <div className="p-8 max-w-[1400px] mx-auto">
        {/* ── Personal Dossier ── */}
        <div className="mb-8 p-8 rounded border shadow-lg relative overflow-hidden" style={cardStyle}>
          <SketchBorder id="prof-dossier" color="#7A6248" opacity={0.7} />
          <div className="absolute top-0 right-0 w-12 h-12"
            style={{ background: 'linear-gradient(135deg, transparent 50%, #C4A882 50%)' }} />
          <div
            className="absolute top-4 right-4 w-24 h-24 rounded-full flex items-center justify-center text-center"
            style={{
              background: 'radial-gradient(circle, #C0392B 0%, #A93226 100%)',
              border: '3px solid #C4A882',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2), inset 0 -2px 4px rgba(0,0,0,0.3)',
              fontFamily: "'Special Elite', cursive",
              fontSize: '10px',
              color: '#F5EDD6',
              transform: 'rotate(-5deg)',
            }}
          >
            BRONZE<br />TIER II
          </div>

          <div className="flex gap-8">
            <div className="flex-shrink-0">
              <div className="relative w-48 h-56 rounded border-4 overflow-hidden"
                style={{ borderColor: '#C4A882', background: '#D4B896', boxShadow: '0 4px 8px rgba(0,0,0,0.15), inset 0 0 20px rgba(0,0,0,0.1)' }}>
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-24 h-24" style={{ color: '#6B4C3B' }} />
                </div>
              </div>
              <div className="mt-3 text-center py-1 px-3 inline-block"
                style={{ background: '#C0392B', color: '#F5EDD6', fontFamily: "'Special Elite', cursive", fontSize: '11px', transform: 'rotate(-1deg)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                RESIDENT · 2ND YEAR
              </div>
            </div>

            <div className="flex-1 pt-4">
              <div className="mb-1" style={{ color: '#6B4C3B', fontFamily: "'Courier Prime', monospace", fontSize: '12px' }}>Dr.</div>
              <h1 className="mb-2" style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.5rem', color: '#2C1810', fontWeight: 700 }}>
                {userProfile?.full_name || '—'}
              </h1>
              <div className="mb-6 h-0.5" style={{ background: '#6B4C3B', width: '200px', transform: 'skewY(-0.5deg)' }} />

              <div className="space-y-3" style={{ fontFamily: "'Courier Prime', monospace", fontSize: '14px' }}>
                {[
                  { label: 'SPECIALTY',    value: 'Radiology' },
                  { label: 'CASES DONE',   value: String(casesCompleted) },
                  { label: 'AVG SCORE',    value: `${avgScore}/100` },
                  { label: 'WEAKEST STEP', value: weakestStep?.[0] ?? '—' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-4">
                    <span className="w-36" style={{ color: '#6B4C3B', fontFamily: "'Special Elite', cursive", fontSize: '11px' }}>
                      {item.label}
                    </span>
                    <span style={{ color: '#C4A882' }}>···</span>
                    <span style={{ color: '#2C1810' }}>{item.value}</span>
                  </div>
                ))}
              </div>

              <button className="mt-6 px-6 py-2 border-2 rounded hover:bg-black/5 transition-all"
                style={{ borderColor: '#C4A882', color: '#6B4C3B', fontFamily: "'Courier Prime', monospace", fontSize: '14px' }}>
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
              <h2 className="mb-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.75rem', color: '#2C1810' }}>
                Diagnostic Performance
              </h2>
              <p style={{ fontFamily: "'Caveat', cursive", fontSize: '1.1rem', color: '#6B4C3B' }}>
                How sharp is your eye?
              </p>
              <div className="text-center my-3" style={{ color: '#C4A882' }}>——✦——</div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              
              {[
                { label: 'Overall Accuracy',  value: `${avgScore}%`,        trend: 'Based on your sessions', up: true },
                { label: 'Cases Completed',   value: String(casesCompleted), trend: 'Total cases done',       up: true },
                { label: 'Weakest Step',      value: weakestStep?.[0] ?? '—', trend: 'Focus area',           up: false },
              ].map((stat, idx) => (
                <div key={idx} className="p-4 border rounded relative" style={cardStyle}>
                  <SketchBorder id="prof-dossier" color="#7A6248" opacity={0.7} />
                  <div className="text-xs mb-2" style={{ fontFamily: "'Special Elite', cursive", color: '#6B4C3B' }}>{stat.label}</div>
                  <div className="text-2xl mb-2" style={{ fontFamily: "'Courier Prime', monospace", color: '#2C1810', fontWeight: 700 }}>{stat.value}</div>
                  <div style={{ fontFamily: "'Caveat', cursive", color: stat.up ? '#7D9B76' : '#C9882A', fontSize: '14px' }}>
                    {stat.trend}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 mb-6 border rounded relative" style={cardStyle}>
              <SketchBorder id="prof-scan-type" color="#7A6248" opacity={0.7} />
              <h3 className="mb-4" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', color: '#2C1810' }}>
                Performance by Diagnostic Step
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={accuracyByStep_chart} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#D4B896" opacity={0.3} />
                  <XAxis type="number" domain={[0, 100]} stroke="#6B4C3B" style={{ fontFamily: "'Courier Prime', monospace", fontSize: '12px' }} />
                  <YAxis type="category" dataKey="modality" stroke="#6B4C3B" style={{ fontFamily: "'Courier Prime', monospace", fontSize: '12px' }} />
                  <Tooltip contentStyle={{ background: '#EDE0C4', border: '1px solid #C4A882', fontFamily: "'Courier Prime', monospace" }} />
                  <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
                    {accuracyByStep_chart.map((_, i) => <Cell key={i} fill="#1B3A5C" opacity={0.7} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="p-6 border rounded relative" style={cardStyle}>
              <SketchBorder id="prof-monthly" color="#7A6248" opacity={0.7} />
              <h3 className="mb-4" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', color: '#2C1810' }}>
                Monthly Accuracy Trend
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D4B896" opacity={0.3} />
                  <XAxis dataKey="month" stroke="#6B4C3B" style={{ fontFamily: "'Courier Prime', monospace", fontSize: '12px' }} />
                  <YAxis domain={[60, 85]} stroke="#6B4C3B" style={{ fontFamily: "'Courier Prime', monospace", fontSize: '12px' }} />
                  <Tooltip contentStyle={{ background: '#EDE0C4', border: '1px solid #C4A882', fontFamily: "'Courier Prime', monospace" }} />
                  <Line type="monotone" dataKey="accuracy" stroke="#C0392B" strokeWidth={2} dot={{ fill: '#C0392B', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right: Learning Progress */}
          <div>
            <div className="mb-6">
              <h2 className="mb-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.75rem', color: '#2C1810' }}>
                Learning Progress
              </h2>
              <p style={{ fontFamily: "'Caveat', cursive", fontSize: '1.1rem', color: '#6B4C3B' }}>
                The long road to mastery
              </p>
              <div className="text-center my-3" style={{ color: '#C4A882' }}>——✦——</div>
            </div>

            {/* Study Streak */}
            <div className="p-6 mb-6 border rounded relative" style={cardStyle}>
              <SketchBorder id="prof-streak" color="#7A6248" opacity={0.7} />
              <h3 className="mb-4" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', color: '#2C1810' }}>Study Streak</h3>
              <div className="grid grid-cols-7 gap-1 mb-4">
                {Array.from({ length: 28 }).map((_, i) => (
                  <div key={i} className="aspect-square border flex items-center justify-center text-xs"
                    style={{
                      background: i < 14 ? '#1B3A5C' : i === 14 ? '#7D9B76' : 'transparent',
                      borderColor: '#C4A882',
                      opacity: i < 14 ? 0.7 : i === 14 ? 0.9 : 0.3,
                      color: i <= 14 ? '#F5EDD6' : '#C4A882',
                    }}
                  >
                    {i === 14 ? '✓' : ''}
                  </div>
                ))}
              </div>
              <div className="text-center text-2xl" style={{ fontFamily: "'Courier Prime', monospace", color: '#2C1810' }}>
                <Flame className="w-6 h-6 inline mr-2" style={{ color: '#C0392B' }} />
                Keep it up!
              </div>
            </div>

            {/* Residency Rank */}
            <div className="p-6 mb-6 border rounded relative" style={cardStyle}>
              <SketchBorder id="prof-rank" color="#7A6248" opacity={0.7} />
              <h3 className="mb-4" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', color: '#2C1810' }}>Residency Rank</h3>
              <div className="inline-block px-4 py-2 mb-4 rounded"
                style={{ background: '#C0392B', color: '#F5EDD6', fontFamily: "'Special Elite', cursive", fontSize: '14px', transform: 'rotate(-1deg)' }}>
                {casesCompleted < 10 ? 'LEVEL 1 — INTERN' : casesCompleted < 50 ? 'LEVEL 5 — JUNIOR RESIDENT' : 'LEVEL 12 — SENIOR RESIDENT'}
              </div>
              <div className="relative h-8 border rounded overflow-hidden mb-2"
                style={{ borderColor: '#C4A882', background: '#F5EDD6' }}>
                <div className="h-full" style={{
                  width: `${Math.min((casesCompleted / 100) * 100, 100)}%`,
                  background: 'repeating-linear-gradient(45deg, #7D9B76, #7D9B76 10px, #6B8A65 10px, #6B8A65 20px)',
                  opacity: 0.8,
                }} />
              </div>
              <p className="text-sm" style={{ fontFamily: "'Courier Prime', monospace", color: '#6B4C3B' }}>
                {100 - casesCompleted > 0 ? `${100 - casesCompleted} cases to Senior Resident` : 'Senior Resident unlocked!'}
              </p>
            </div>

            {/* Cases by Scan Type */}
            <div className="p-6 border rounded relative" style={cardStyle}>
              <SketchBorder id="prof-pie" color="#7A6248" opacity={0.7} />
              <h3 className="mb-4" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', color: '#2C1810' }}>Cases by Scan Type</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={modalityBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                    {modalityBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} opacity={0.8} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#EDE0C4', border: '1px solid #C4A882', fontFamily: "'Courier Prime', monospace" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-4 flex-wrap">
                {modalityBreakdown.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ background: item.color, opacity: 0.8 }} />
                    <span className="text-xs" style={{ fontFamily: "'Courier Prime', monospace", color: '#6B4C3B' }}>{item.name}</span>
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
              fontFamily: "'Playfair Display', serif", fontSize: '1.75rem', color: '#2C1810',
              borderBottom: '3px solid #C0392B', paddingBottom: '4px',
            }}>
              Areas Needing Attention
            </h2>
            <p className="mt-2" style={{ fontFamily: "'Caveat', cursive", fontSize: '1.1rem', color: '#C0392B' }}>
              Study these first! ⚠
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {weakAreas.map((area, idx) => (
              <div key={idx} className="p-6 border rounded relative hover:-translate-y-1 transition-transform cursor-pointer"
                style={{ background: 'rgba(192,57,43,0.04)', borderColor: '#C4A882', boxShadow: '0 2px 8px rgba(62,31,13,0.12)' }}>
                <SketchBorder id={`prof-weak-${idx}`} color="#C0392B" opacity={0.85} />
                <div className="absolute top-0 right-4 w-8 h-10"
                  style={{ background: '#C0392B', clipPath: 'polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)', opacity: 0.9 }} />
                <h4 className="mb-3" style={{ fontFamily: "'Special Elite', cursive", fontSize: '13px', color: '#2C1810' }}>
                  {area.category}
                </h4>
                <div className="text-2xl mb-3" style={{ fontFamily: "'Courier Prime', monospace", color: '#A93226', fontWeight: 700 }}>
                  Accuracy: {area.accuracy}%
                </div>
                <div className="relative h-3 border rounded overflow-hidden mb-3" style={{ borderColor: '#C4A882', background: '#F5EDD6' }}>
                  <div className="h-full" style={{ width: `${area.accuracy}%`, background: '#C9882A', opacity: 0.7 }} />
                </div>
                <button className="text-sm hover:underline" style={{ fontFamily: "'Caveat', cursive", color: '#C0392B', fontSize: '16px' }}
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
              <h2 className="mb-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.75rem', color: '#2C1810' }}>
                Case History Log
              </h2>
              <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: '14px', color: '#6B4C3B' }}>
                Complete record of reviewed cases
              </p>
            </div>
            <div className="px-3 py-1 opacity-30"
              style={{ color: '#C0392B', fontFamily: "'Special Elite', cursive", fontSize: '12px', border: '2px solid #C0392B', transform: 'rotate(-3deg)' }}>
              CONFIDENTIAL
            </div>
          </div>

          <div className="border rounded overflow-hidden relative" style={{ background: '#EDE0C4', borderColor: '#C4A882' }}>
            <SketchBorder id="prof-history" color="#5A4030" opacity={0.9} />
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '2px solid #C4A882', fontFamily: "'Special Elite', cursive", fontSize: '11px', color: '#6B4C3B' }}>
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
                      <td colSpan={6} className="p-8 text-center" style={{ fontFamily: "'Caveat', cursive", color: '#8B6355', fontSize: '16px' }}>
                        No completed cases yet — upload your first scan to get started.
                      </td>
                    </tr>
                  ) : recentSessions.map((s: any, idx: number) => {
                    const score = (s.final_score ?? 0) * 100;
                    const status = getSessionStatus(s);
                    return (
                      <tr key={s.id} className="hover:bg-yellow-200/30 transition-colors cursor-pointer"
                        style={{ borderBottom: '1px solid rgba(196,168,130,0.3)' }}>
                        <td className="p-4" style={{ fontFamily: "'Courier Prime', monospace", color: '#C0392B', fontWeight: 700 }}>
                          {s.case_title ?? s.case_id}
                        </td>
                        <td className="p-4" style={{ fontFamily: "'Courier Prime', monospace", color: '#6B4C3B', fontSize: '14px' }}>
                          {s.completed_at ? new Date(s.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                        </td>
                        <td className="p-4">
                          <span className="inline-block px-2 py-1 text-xs"
                            style={{ background: '#1B3A5C', color: '#F5EDD6', fontFamily: "'Courier Prime', monospace" }}>
                            {s.case_modality ?? 'X-RAY'}
                          </span>
                        </td>
                        <td className="p-4" style={{
                          fontFamily: "'Courier Prime', monospace", fontSize: '16px', fontWeight: 700,
                          color: score >= 80 ? '#7D9B76' : score >= 60 ? '#C9882A' : '#A93226',
                        }}>
                          {Math.round(score)}/100
                        </td>
                        <td className="p-4">
                          {status === 'correct' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs"
                              style={{ color: '#7D9B76', fontFamily: "'Special Elite', cursive" }}>
                              <CheckCircle2 className="w-4 h-4" /> CORRECT
                            </span>
                          )}
                          {status === 'incorrect' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs"
                              style={{ color: '#A93226', fontFamily: "'Special Elite', cursive" }}>
                              <XCircle className="w-4 h-4" /> INCORRECT
                            </span>
                          )}
                          {status === 'pending' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs"
                              style={{ color: '#C4A882', fontFamily: "'Special Elite', cursive" }}>
                              <Clock className="w-4 h-4" /> PENDING
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => navigate(`/answer-key/${s.case_id}`)}
                            className="hover:underline"
                            style={{ fontFamily: "'Caveat', cursive", color: '#C0392B', fontSize: '15px' }}>
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
            <h2 className="mb-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.75rem', color: '#2C1810' }}>
              Commendations &amp; Medals
            </h2>
            <p style={{ fontFamily: "'Caveat', cursive", fontSize: '1.1rem', color: '#6B4C3B' }}>Hard-earned, every one.</p>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-6">
            {achievements.map((badge, idx) => (
              <div key={idx} className="text-center">
                <div className={`w-20 h-20 mx-auto mb-3 rounded-full flex items-center justify-center text-4xl border-4 ${badge.earned ? '' : 'opacity-30 grayscale'}`}
                  style={{
                    background: badge.earned ? 'radial-gradient(circle, #C0392B 0%, #A93226 100%)' : '#C4A882',
                    borderColor: '#C4A882',
                    boxShadow: badge.earned ? '0 4px 8px rgba(0,0,0,0.2), inset 0 -2px 4px rgba(0,0,0,0.3)' : 'none',
                  }}>
                  {badge.icon}
                </div>
                <div className="text-xs" style={{ fontFamily: "'Special Elite', cursive", color: badge.earned ? '#2C1810' : '#C4A882' }}>
                  {badge.name}
                </div>
                {!badge.earned && (
                  <div className="text-xs mt-1 px-2 py-0.5 inline-block"
                    style={{ color: '#A93226', fontFamily: "'Courier Prime', monospace", fontSize: '10px' }}>
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
