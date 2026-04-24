import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Layers } from 'lucide-react';
import { useCases, useSessions } from '@/api/hooks';
import { mapModality, mapDifficulty, getImageKey } from '@/utils/mappers';
import type { CaseItem, SessionStatus } from '@/types';
import { CaseCard } from '@/app/components/shared/CaseCard';
import { FilterBar } from '@/app/components/shared/FilterBar';

const MODALITY_OPTIONS = ['Tất cả', 'X-Ray', 'CT', 'MRI'];
const DIFFICULTY_OPTIONS = ['Tất cả', 'Cơ bản', 'Trung bình', 'Nặng cao'];

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
    if (!casesData?.results) return [];
    return casesData.results.map((c: any) => ({
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

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontWeight: 700, fontSize: 22, color: 'var(--text-primary)', marginBottom: 6 }}>
          Case Study Library
        </h1>
        <p style={{ color: 'var(--text-sec)', fontSize: 14 }}>
          Chọn ca để bắt đầu luyện tập pipeline 6 bước
        </p>
      </div>

      <FilterBar
        groups={[
          { label: 'Phương thức', options: MODALITY_OPTIONS, active: activeModality, onChange: setActiveModality },
          { label: 'Độ khó', options: DIFFICULTY_OPTIONS, active: activeDifficulty, onChange: setActiveDifficulty },
        ]}
      />

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {casesLoading ? (
          [1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 8, height: 280, animation: 'pulse 2s infinite' }} />
          ))
        ) : filtered.length > 0 ? (
          filtered.map((c) => (
            <CaseCard key={c.id} item={c} onClick={() => navigate(`/session/${c.id}`)} />
          ))
        ) : (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
            <Layers size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <p style={{ fontSize: 16, fontWeight: 500 }}>Chưa có ca nào</p>
            <p style={{ fontSize: 13, marginTop: 6 }}>Thử thay đổi bộ lọc để xem thêm ca học</p>
          </div>
        )}
      </div>
    </div>
  );
}
