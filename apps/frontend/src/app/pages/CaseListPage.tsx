import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useCases, useCreateSession } from '@/api/hooks';
import { mapModality, mapDifficulty, getImageKey, apiModalityParam, apiDifficultyParam } from '@/utils/mappers';
import type { CaseItem } from '@/types';
import { CaseCard } from '@/app/components/shared/CaseCard';
import { FilterBar } from '@/app/components/shared/FilterBar';
import { BookOpen, Layers } from 'lucide-react';

const MODALITY_OPTIONS = ['Tất cả', 'X-Ray', 'CT', 'MRI'];
const DIFFICULTY_OPTIONS = ['Tất cả', 'Cơ bản', 'Trung bình', 'Nặng cao'];

export function CaseListPage() {
  const navigate = useNavigate();
  const { createSession } = useCreateSession();

  const [activeModality, setActiveModality] = useState('Tất cả');
  const [activeDifficulty, setActiveDifficulty] = useState('Tất cả');
  const [page, setPage] = useState(1);
  const [apiFilters, setApiFilters] = useState({ modality: '', difficulty: '' });

  const { data: casesData, loading: casesLoading } = useCases({ ...apiFilters, page });

  const handleModalityChange = (m: string) => {
    setActiveModality(m);
    setApiFilters((p) => ({ ...p, modality: m === 'Tất cả' ? '' : apiModalityParam(m) }));
    setPage(1);
  };

  const handleDifficultyChange = (d: string) => {
    setActiveDifficulty(d);
    setApiFilters((p) => ({ ...p, difficulty: d === 'Tất cả' ? '' : apiDifficultyParam(d) }));
    setPage(1);
  };

  const handleStart = async (caseId: string) => {
    const session = await createSession(caseId);
    if (session) navigate(`/session/${caseId}`);
  };

  const cases: CaseItem[] = (casesData?.cases ?? []).map((c: any) => ({
    id: String(c.id),
    title: c.title,
    modality: mapModality(c.modality),
    difficulty: mapDifficulty(c.difficulty),
    hint: c.clinical_history || c.description || '',
    status: 'Chưa làm' as const,
    imageKey: getImageKey(c.modality),
  }));

  const totalPages = casesData?.count ? Math.ceil(casesData.count / 20) : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--bg-base)' }}>
      {/* Topbar */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid var(--border-dim)', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <BookOpen size={16} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Thư Viện Case</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        <h1 style={{ fontWeight: 700, fontSize: 22, color: 'var(--text-primary)', marginBottom: 6 }}>Case Study Library</h1>
        <p style={{ color: 'var(--text-sec)', fontSize: 14, marginBottom: 20 }}>Chọn ca để bắt đầu luyện tập pipeline 6 bước</p>

        <FilterBar
          groups={[
            { label: 'Phương thức', options: MODALITY_OPTIONS, active: activeModality, onChange: handleModalityChange },
            { label: 'Độ khó', options: DIFFICULTY_OPTIONS, active: activeDifficulty, onChange: handleDifficultyChange },
          ]}
        />

        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {casesLoading ? (
            [1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 8, height: 280, animation: 'pulse 2s infinite' }} />
            ))
          ) : cases.length > 0 ? (
            cases.map((c) => (
              <CaseCard key={c.id} item={c} onClick={() => handleStart(c.id)} />
            ))
          ) : (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
              <Layers size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
              <p style={{ fontSize: 16, fontWeight: 500 }}>Chưa có ca nào</p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', paddingTop: 24 }}>
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={{ padding: '5px 16px', borderRadius: 6, border: '1px solid var(--border-dim)', backgroundColor: 'transparent', color: 'var(--text-sec)', cursor: 'pointer', opacity: page > 1 ? 1 : 0.4 }}>← Trước</button>
            <span style={{ fontSize: 13, color: 'var(--text-sec)', alignSelf: 'center' }}>Trang {page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={{ padding: '5px 16px', borderRadius: 6, border: '1px solid var(--border-dim)', backgroundColor: 'transparent', color: 'var(--text-sec)', cursor: 'pointer', opacity: page < totalPages ? 1 : 0.4 }}>Sau →</button>
          </div>
        )}
      </div>
    </div>
  );
}
