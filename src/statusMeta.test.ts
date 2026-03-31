import { describe, expect, it } from 'vitest';
import { getStatusDisplayName, isDoneStatus } from './statusMeta';

describe('statusMeta', () => {
  it('normalizes missing and No Status values', () => {
    expect(getStatusDisplayName(undefined)).toBe('Bez statusu');
    expect(getStatusDisplayName('No Status')).toBe('Bez statusu');
    expect(getStatusDisplayName('Done')).toBe('Done');
  });

  it('detects done status via normalized display value', () => {
    expect(isDoneStatus('Done')).toBe(true);
    expect(isDoneStatus('No Status')).toBe(false);
    expect(isDoneStatus(undefined)).toBe(false);
  });
});
