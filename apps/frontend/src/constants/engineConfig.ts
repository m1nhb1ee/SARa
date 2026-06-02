export const ENGINE_BY_TIER: Record<'free' | 'premium', string> = {
  free: 'vlm',
  premium: 'gpt',
};

export function engineForUser(isPremium: boolean): string {
  return isPremium ? ENGINE_BY_TIER.premium : ENGINE_BY_TIER.free;
}
