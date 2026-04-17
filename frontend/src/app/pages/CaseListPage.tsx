/**
 * CaseListPage - Hiển thị danh sách cases
 */

import { useState } from 'react';
import { useCases } from '@/api/hooks';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';

export function CaseListPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    modality: '',
    difficulty: '',
  });

  const { data, loading, error } = useCases({
    ...filters,
    page,
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleCaseClick = (caseId: number) => {
    // Navigate to case detail
    window.location.href = `/case/${caseId}`;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">Thư Viện Case</h1>
        <p className="text-neutral-500">Chọn một case để bắt đầu luyện tập chẩn đoán hình ảnh</p>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <select
          value={filters.modality}
          onChange={(e) => handleFilterChange('modality', e.target.value)}
          className="px-4 py-2 border rounded-lg bg-background"
        >
          <option value="">Tất cả modality</option>
          <option value="XRAY">X-Ray</option>
          <option value="CT">CT Scan</option>
          <option value="MRI">MRI</option>
          <option value="ULTRASOUND">Ultrasound</option>
        </select>

        <select
          value={filters.difficulty}
          onChange={(e) => handleFilterChange('difficulty', e.target.value)}
          className="px-4 py-2 border rounded-lg bg-background"
        >
          <option value="">Tất cả độ khó</option>
          <option value="BASIC">Cơ bản</option>
          <option value="INTERMEDIATE">Trung bình</option>
          <option value="ADVANCED">Nâng cao</option>
        </select>
      </div>

      {/* Cases Grid */}
      {loading && <div className="text-center py-12">Đang tải...</div>}

      {error && <div className="text-center py-12 text-red-500">Lỗi: {error}</div>}

      {data?.results && data.results.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.results.map((caseItem: any) => (
            <Card
              key={caseItem.id}
              className="p-4 space-y-3 hover:shadow-lg transition cursor-pointer"
              onClick={() => handleCaseClick(caseItem.id)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{caseItem.title}</h3>
                  <p className="text-sm text-neutral-500">{caseItem.description}</p>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <span className="inline-block px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs">
                  {caseItem.modality}
                </span>
                <span
                  className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                    caseItem.difficulty === 'BASIC'
                      ? 'bg-green-100 text-green-700'
                      : caseItem.difficulty === 'INTERMEDIATE'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                  }`}
                >
                  {caseItem.difficulty === 'BASIC'
                    ? 'Cơ bản'
                    : caseItem.difficulty === 'INTERMEDIATE'
                      ? 'Trung bình'
                      : 'Nâng cao'}
                </span>
              </div>

              {caseItem.tags && caseItem.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {caseItem.tags.map((tag: any) => (
                    <span key={tag.id} className="inline-block px-2 py-1 rounded bg-neutral-200 text-neutral-700 text-xs">
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}

              <Button className="w-full" onClick={(e) => { e.stopPropagation(); handleCaseClick(caseItem.id); }}>
                Bắt đầu luyện tập
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        !loading && <div className="text-center py-12 text-neutral-500">Không tìm thấy case nào</div>
      )}

      {/* Pagination */}
      {data?.count && (
        <div className="flex gap-2 justify-center items-center py-4">
          <Button disabled={!data.previous} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Trước
          </Button>
          <span>
            Trang {page} / {Math.ceil(data.count / 20)}
          </span>
          <Button disabled={!data.next} onClick={() => setPage((p) => p + 1)}>
            Sau
          </Button>
        </div>
      )}
    </div>
  );
}
