import { fingerprintOf } from '../services/savedAnalyses';

describe('fingerprintOf', () => {
  it('is the same for the same inputs', () => {
    expect(fingerprintOf(['v13', 1, 2, '4-3-3', null])).toBe(fingerprintOf(['v13', 1, 2, '4-3-3', null]));
  });

  it('changes with any input', () => {
    const base = fingerprintOf(['v13', 1, 2, '4-3-3', '4-4-2', 'win', 7, '0', 'abc', '1,2/10,11', '3,4/12']);
    expect(fingerprintOf(['v13', 1, 2, '4-3-3', '4-4-2', 'draw', 7, '0', 'abc', '1,2/10,11', '3,4/12'])).not.toBe(base);
    expect(fingerprintOf(['v13', 1, 2, '4-3-3', '4-4-2', 'win', 7, '0', 'abc', '1,2/10,11,13', '3,4/12'])).not.toBe(base);
    expect(fingerprintOf(['v13', 1, 2, '4-3-3', '4-4-2', 'win', 7, '0', 'abd', '1,2/10,11', '3,4/12'])).not.toBe(base);
  });

  it('keeps parts apart', () => {
    expect(fingerprintOf(['ab', 'c'])).not.toBe(fingerprintOf(['a', 'bc']));
  });
});
