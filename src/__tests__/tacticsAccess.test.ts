import { tacticsAccess } from '../services/tacticsLog';
import { fetchMflCached } from '../services/formationResults';

jest.mock('../lib/db-helpers', () => ({ executeRaw: jest.fn() }));
jest.mock('../services/formationResults', () => ({
  ...jest.requireActual('../services/formationResults'),
  fetchMflCached: jest.fn(),
}));

const OWNER = '0x95dc70d7d39f6f76';
// Whitelisted in src/lib/aiAccess.ts
const STAFF = '0xf16d5fbca5a5ed4f';
const STRANGER = '0x1111111111111111';

const mocked = fetchMflCached as jest.MockedFunction<typeof fetchMflCached>;

function mflAnswers(staffClubs: unknown[]) {
  mocked.mockImplementation(async (path: string) => {
    if (path.startsWith('/clubs/')) return { squads: [{ id: 99 }], ownedBy: { walletAddress: OWNER } } as never;
    if (path.startsWith('/clubs?walletAddress=')) return staffClubs as never;
    throw new Error(`unexpected ${path}`);
  });
}

describe('tacticsAccess', () => {
  beforeEach(() => mocked.mockReset());

  it('lets the owner in without asking MFL for staff roles', async () => {
    mflAnswers([]);
    await expect(tacticsAccess(681, OWNER)).resolves.toEqual({ squadId: 99, allowed: true });
    expect(mocked).toHaveBeenCalledTimes(1);
  });

  it('lets whitelisted staff with the tactics permission in', async () => {
    mflAnswers([{ title: 'assistantManager', club: { id: 681 }, permissions: { tactics: true } }]);
    await expect(tacticsAccess(681, STAFF)).resolves.toEqual({ squadId: 99, allowed: true });
  });

  it('keeps out staff without the tactics permission, and staff of another club', async () => {
    mflAnswers([
      { title: 'sportingDirector', club: { id: 681 }, permissions: { tactics: false } },
      { title: 'manager', club: { id: 7 }, permissions: { tactics: true } },
    ]);
    await expect(tacticsAccess(681, STAFF)).resolves.toEqual({ squadId: 99, allowed: false });
  });

  it('keeps out staff who are not whitelisted', async () => {
    mflAnswers([{ title: 'manager', club: { id: 681 }, permissions: { tactics: true } }]);
    await expect(tacticsAccess(681, STRANGER)).resolves.toEqual({ squadId: 99, allowed: false });
    expect(mocked).toHaveBeenCalledTimes(1);
  });
});
