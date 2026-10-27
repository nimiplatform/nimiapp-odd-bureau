import { createNimiNavigation, type NimiNavigationLeaveGuard } from '@nimiplatform/kit/core/navigation';

export type OddBureauDestination =
  | { readonly id: 'home' | 'setup' | 'mystery' }
  | { readonly id: 'round'; readonly roundId: string };

export function validateOddBureauDestination(value: unknown): OddBureauDestination {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Odd Bureau destination.');
  const input = value as Record<string, unknown>;
  if (input.id === 'round') {
    if (Object.keys(input).some(key => key !== 'id' && key !== 'roundId')
      || typeof input.roundId !== 'string' || !input.roundId.trim() || input.roundId.length > 512) {
      throw new Error('A round destination requires its exact saved round.');
    }
    return { id: 'round', roundId: input.roundId };
  }
  if (Object.keys(input).length !== 1 || !['home', 'setup', 'mystery'].includes(String(input.id))) {
    throw new Error('Unknown Odd Bureau destination.');
  }
  return { id: input.id as 'home' | 'setup' | 'mystery' };
}

export function createOddBureauNavigation(beforeLeave?: NimiNavigationLeaveGuard<OddBureauDestination>) {
  return createNimiNavigation<OddBureauDestination>({ initial: { id: 'home' }, validate: validateOddBureauDestination, beforeLeave });
}
