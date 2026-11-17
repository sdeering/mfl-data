import { scopeKey, scopeOf } from '../services/clubNotes';

describe('match notes scope', () => {
  it('keys notes by the fixture when there is one', () => {
    const scope = scopeOf('123456', '2284');
    expect(scope).toEqual({ matchId: 123456, opponentId: 2284 });
    expect(scopeKey(scope!)).toBe('match:123456');
  });

  it('keys notes by the opponent without a fixture', () => {
    expect(scopeKey(scopeOf(undefined, 2284)!)).toBe('vs:2284');
    expect(scopeKey(scopeOf(null, '2284')!)).toBe('vs:2284');
    expect(scopeKey(scopeOf('abc', 2284)!)).toBe('vs:2284');
  });

  it('needs an opponent', () => {
    expect(scopeOf(123456, undefined)).toBeNull();
    expect(scopeOf(123456, '0')).toBeNull();
    expect(scopeOf(123456, '-4')).toBeNull();
  });
});
