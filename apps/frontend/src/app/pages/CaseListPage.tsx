import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useCases, useCreateSession } from '@/api/hooks';
import { mapModality, mapDifficulty, getImageKey, apiModalityParam, apiDifficultyParam } from '@/utils/mappers';
import type { CaseItem } from '@/types';
import { CaseCard } from '@/app/components/shared/CaseCard';
import { FilterBar } from '@/app/components/shared/FilterBar';
import { Layers } from 'lucide-react';

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', backgroundColor: '#F5EDD6' }}>
      {/* Topbar */}
      <div style={{
        flexShrink: 0,
        borderBottom: '1px solid #C4A882',
        padding: '10px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: '#F5EDD6',
      }}>
        <span style={{ fontFamily: "'Special Elite', cursive", fontSize: 11, color: '#6B4C3B', letterSpacing: '0.12em' }}>
          📖 &nbsp;CASE LIBRARY
        </span>
        <span style={{ color: '#C4A882', fontSize: 12 }}>·</span>
        <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, color: '#8B6355' }}>
          {casesLoading ? '…' : `${cases.length} cases`}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {/* Page title */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 26,
            color: '#2C1810',
            fontWeight: 700,
            marginBottom: 4,
          }}>
            Case Study Library
          </h1>
          <div style={{ height: 1, width: 180, background: 'linear-gradient(to right, #C4A882, transparent)', marginBottom: 8 }} />
          <p style={{ fontFamily: "'Lora', serif", fontSize: 13, color: '#6B4C3B', fontStyle: 'italic' }}>
            Chọn ca để bắt đầu luyện tập pipeline 6 bước chẩn đoán.
          </p>
        </div>

        <FilterBar
          groups={[
            { label: 'MODALITY', options: MODALITY_OPTIONS, active: activeModality, onChange: handleModalityChange },
            { label: 'DIFFICULTY', options: DIFFICULTY_OPTIONS, active: activeDifficulty, onChange: handleDifficultyChange },
          ]}
        />

        <style>{`@keyframes shimmer{0%,100%{opacity:1}50%{opacity:0.45}}`}</style>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {casesLoading ? (
            [1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} style={{
                backgroundColor: '#EDE0C4',
                border: '1px solid #C4A882',
                borderRadius: 2,
                overflow: 'hidden',
                animation: 'shimmer 1.8s ease-in-out infinite',
              }}>
                {/* Thumbnail placeholder */}
                <div style={{ height: 140, backgroundColor: '#D6C9A8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, color: '#C4A882', letterSpacing: '0.1em' }}>
                    Loading…
                  </span>
                </div>
                {/* Content placeholder */}
                <div style={{ padding: 12 }}>
                  <div style={{ height: 14, backgroundColor: '#D6C9A8', borderRadius: 2, marginBottom: 8, width: '75%' }} />
                  <div style={{ height: 11, backgroundColor: '#D6C9A8', borderRadius: 2, marginBottom: 4, width: '90%' }} />
                  <div style={{ height: 11, backgroundColor: '#D6C9A8', borderRadius: 2, marginBottom: 14, width: '60%' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ height: 12, width: 70, backgroundColor: '#D6C9A8', borderRadius: 2 }} />
                    <div style={{ height: 28, width: 72, backgroundColor: '#D6C9A8', borderRadius: 2 }} />
                  </div>
                </div>
              </div>
            ))
          ) : cases.length > 0 ? (
            cases.map((c) => (
              <CaseCard key={c.id} item={c} onClick={() => handleStart(c.id)} />
            ))
          ) : (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '80px 0', color: '#8B6355' }}>
              <Layers size={48} style={{ margin: '0 auto 16px', opacity: 0.4, color: '#C4A882' }} />
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: '#2C1810', marginBottom: 6 }}>Chưa có ca nào</p>
              <p style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: '#8B6355' }}>Thử thay đổi bộ lọc để xem thêm ca học</p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', paddingTop: 28, paddingBottom: 8 }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{
                padding: '6px 18px',
                border: '1px solid #C4A882',
                backgroundColor: 'transparent',
                color: '#6B4C3B',
                cursor: page > 1 ? 'pointer' : 'not-allowed',
                opacity: page > 1 ? 1 : 0.4,
                fontFamily: "'Caveat', cursive",
                fontSize: 15,
              }}
            >
              ← Trước
            </button>
            <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 13, color: '#6B4C3B', alignSelf: 'center' }}>
              Trang {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              style={{
                padding: '6px 18px',
                border: '1px solid #C4A882',
                backgroundColor: 'transparent',
                color: '#6B4C3B',
                cursor: page < totalPages ? 'pointer' : 'not-allowed',
                opacity: page < totalPages ? 1 : 0.4,
                fontFamily: "'Caveat', cursive",
                fontSize: 15,
              }}
            >
              Sau →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
