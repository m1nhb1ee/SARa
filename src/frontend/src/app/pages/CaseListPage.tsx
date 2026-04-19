/**
 * CaseListPage - Library Only  
 * Shows the case study library with filters and card grid
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useCases, useCreateSession } from '@/api/hooks';
import { CheckCircle2, Clock, RefreshCw, Layers, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';

type Status = 'Chưa làm' | 'Đang làm' | 'Hoàn thành';
type Difficulty = 'Cơ bản' | 'Trung bình' | 'Nặng cao';
type Modality = 'X-Ray' | 'CT' | 'MRI';

const mapModality = (m: string): Modality =>
  ({ XRAY: 'X-Ray', CT: 'CT', MRI: 'MRI' } as Record<string, Modality>)[m] ?? 'X-Ray';

const mapDifficulty = (d: string): Difficulty =>
  ({ BASIC: 'Cơ bản', INTERMEDIATE: 'Trung bình', ADVANCED: 'Nặng cao' } as Record<string, Difficulty>)[d] ?? 'Cơ bản';

const getImageKey = (m: string): string =>
  ({ XRAY: 'body', CT: 'ct', MRI: 'head' } as Record<string, string>)[m] ?? 'body';

const difficultyStyle: Record<Difficulty, { bg: string; color: string }> = {
  'Cơ bản': { bg: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)' },
  'Trung bình': { bg: 'color-mix(in srgb, var(--warning) 15%, transparent)', color: 'var(--warning)' },
  'Nặng cao': { bg: 'color-mix(in srgb, var(--error) 15%, transparent)', color: 'var(--error)' },
};

const statusStyle: Record<Status, { icon: any; color: string }> = {
  'Chưa làm': { icon: Clock, color: 'var(--text-muted)' },
  'Đang làm': { icon: RefreshCw, color: 'var(--warning)' },
  'Hoàn thành': { icon: CheckCircle2, color: 'var(--success)' },
};

const modalityStyle: Record<Modality, { bg: string; color: string }> = {
  'X-Ray': { bg: 'color-mix(in srgb, var(--info) 15%, transparent)', color: 'var(--info)' },
  'CT': { bg: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)' },
  'MRI': { bg: 'color-mix(in srgb, var(--emphasis) 15%, transparent)', color: 'var(--emphasis)' },
};

interface CaseCard {
  id: string;
  title: string;
  modality: Modality;
  difficulty: Difficulty;
  hint: string;
  status: Status;
  imageKey: string;
}

export function CaseListPage() {
  const navigate = useNavigate();
  const { createSession } = useCreateSession();

  const [activeModality, setActiveModality] = useState<string>('Tất cả');
  const [activeDifficulty, setActiveDifficulty] = useState<string>('Tất cả');
  const [page, setPage] = useState(1);
  const [apiFilters, setApiFilters] = useState({ modality: '', difficulty: '' });

  const { data: casesData, loading: casesLoading } = useCases({ ...apiFilters, page });

  const handleModalityFilter = (m: string) => {
    setActiveModality(m);
    setApiFilters((p) => ({ ...p, modality: m === 'Tất cả' ? '' : m.replace('-', '').toUpperCase() }));
    setPage(1);
  };

  const handleDifficultyFilter = (d: string) => {
    setActiveDifficulty(d);
    const map: Record<string, string> = { 'Cơ bản': 'BASIC', 'Trung bình': 'INTERMEDIATE', 'Nặng cao': 'ADVANCED' };
    setApiFilters((p) => ({ ...p, difficulty: d === 'Tất cả' ? '' : map[d] ?? '' }));
    setPage(1);
  };

  const handleStartTraining = async (caseId: number) => {
    try {
      const session = await createSession(caseId);
      if (session) navigate('/session/' + caseId);
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const statusMap: Record<number, Status> = {};
  const cases: CaseCard[] = (casesData?.results ?? []).map((apiCase: any) => ({
    id: apiCase.id.toString(),
    title: apiCase.title,
    modality: mapModality(apiCase.modality),
    difficulty: mapDifficulty(apiCase.difficulty),
    hint: apiCase.clinical_history || apiCase.description || '',
    status: statusMap[apiCase.id] ?? 'Chưa làm',
    imageKey: getImageKey(apiCase.modality),
  }));

  const filtered = cases.filter((c) =>
    (activeModality === 'Tất cả' || c.modality === activeModality) &&
    (activeDifficulty === 'Tất cả' || c.difficulty === activeDifficulty)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--bg-base)', paddingLeft: 100 }}>
      <div style={{ flexShrink: 0, backgroundColor: 'var(--bg-base)', borderBottom: '1px solid var(--border-dim)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <BookOpen size={16} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Thư Viện Case</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        <h1 style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 22, color: 'var(--text-primary)', marginBottom: 6 }}>Case Study Library</h1>
        <p style={{ color: 'var(--text-sec)', fontSize: 14, marginBottom: 20 }}>Chọn ca để bắt đầu luyện tập pipeline 6 bước</p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text-sec)', fontSize: 13 }}>Phương thức:</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Tất cả', 'X-Ray', 'CT', 'MRI'].map((m) => (
                <button
                  key={m}
                  onClick={() => handleModalityFilter(m)}
                  style={{
                    padding: '5px 12px', borderRadius: 4, fontSize: 13, fontWeight: 500,
                    border: activeModality === m ? '1px solid var(--accent)' : '1px solid var(--border-dim)',
                    backgroundColor: activeModality === m ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                    color: activeModality === m ? 'var(--accent)' : 'var(--text-sec)',
                    cursor: 'pointer',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text-sec)', fontSize: 13 }}>Độ khó:</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Tất cả', 'Cơ bản', 'Trung bình', 'Nặng cao'].map((d) => (
                <button
                  key={d}
                  onClick={() => handleDifficultyFilter(d)}
                  style={{
                    padding: '5px 12px', borderRadius: 4, fontSize: 13, fontWeight: 500,
                    border: activeDifficulty === d ? '1px solid var(--accent)' : '1px solid var(--border-dim)',
                    backgroundColor: activeDifficulty === d ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                    color: activeDifficulty === d ? 'var(--accent)' : 'var(--text-sec)',
                    cursor: 'pointer',
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {casesLoading ? (
            [1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 8, height: 280, animation: 'pulse 2s infinite' }} />
            ))
          ) : filtered.length > 0 ? (
            filtered.map((c) => {
              const StatusIcon = statusStyle[c.status].icon;
              return (
                <motion.div
                  key={c.id}
                  whileHover={{ translateY: -4 }}
                  onClick={() => handleStartTraining(parseInt(c.id))}
                  style={{
                    backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-dim)',
                    borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                  }}
                >
                  <div style={{ height: 140, backgroundColor: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <div className={`img-${c.imageKey}`} style={{ width: '100%', height: '100%', opacity: 0.85 }} />
                    <span style={{ position: 'absolute', top: 8, right: 8, padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, backgroundColor: modalityStyle[c.modality].bg, color: modalityStyle[c.modality].color }}>
                      {c.modality}
                    </span>
                    <StatusIcon size={16} color={statusStyle[c.status].color} style={{ position: 'absolute', bottom: 8, right: 8 }} />
                  </div>
                  <div style={{ padding: 12 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{c.title}</h3>
                    <span style={{ padding: '2px 8px', borderRadius: 3, fontSize: 11, fontWeight: 500, backgroundColor: difficultyStyle[c.difficulty].bg, color: difficultyStyle[c.difficulty].color }}>
                      {c.difficulty}
                    </span>
                    <p style={{ fontSize: 11, color: 'var(--text-sec)', margin: '12px 0' }}>{c.hint.substring(0, 60)}...</p>
                    <button
                      onClick={() => handleStartTraining(parseInt(c.id))}
                      style={{
                        width: '100%', padding: '6px 0', borderRadius: 4,
                        border: '1px solid var(--accent)', backgroundColor: 'transparent',
                        color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Bắt Đầu
                    </button>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
              <Layers size={48} style={{ margin: '0 auto 16px' }} />
              <p style={{ fontSize: 16, fontWeight: 500 }}>Chưa có ca nào</p>
            </div>
          )}
        </div>

        {casesData?.count && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', paddingTop: 24 }}>
            <button disabled={!casesData.previous} onClick={() => setPage(Math.max(1, page - 1))} style={{ padding: '5px 16px', borderRadius: 6, border: '1px solid var(--border-dim)', backgroundColor: 'transparent', color: 'var(--text-sec)', cursor: 'pointer', opacity: casesData.previous ? 1 : 0.4 }}>← Trước</button>
            <span style={{ fontSize: 13, color: 'var(--text-sec)' }}>Trang {page} / {Math.ceil(casesData.count / 20)}</span>
            <button disabled={!casesData.next} onClick={() => setPage(page + 1)} style={{ padding: '5px 16px', borderRadius: 6, border: '1px solid var(--border-dim)', backgroundColor: 'transparent', color: 'var(--text-sec)', cursor: 'pointer', opacity: casesData.next ? 1 : 0.4 }}>Sau →</button>
          </div>
        )}
      </div>
    </div>
  );
}
