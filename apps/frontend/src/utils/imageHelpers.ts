import type { CaseVolume } from '@/types';

export function getFirstImageUrl(caseData: any): string {
  const volumes: CaseVolume[] = caseData?.images ?? [];
  if (volumes.length > 0 && volumes[0].slices.length > 0) {
    return volumes[0].slices[0].image_url;
  }
  return caseData?.image_urls?.[0] ?? '';
}
