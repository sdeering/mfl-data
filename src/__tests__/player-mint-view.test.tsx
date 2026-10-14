import React from 'react';
import { render, screen } from '@testing-library/react';
import PlayerResultsPage from '../components/PlayerResultsPage';
import { LoadingProvider } from '../contexts/LoadingContext';
import { fetchPlayerExperienceHistory } from '../services/playerExperienceService';
import type { PlayerExperienceEntry } from '../types/playerExperience';

let mockSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

jest.mock('../services/playerExperienceService', () => ({
  ...jest.requireActual('../services/playerExperienceService'),
  fetchPlayerExperienceHistory: jest.fn(),
}));
const mockFetchHistory = fetchPlayerExperienceHistory as jest.MockedFunction<typeof fetchPlayerExperienceHistory>;

jest.mock('../contexts/WalletContext', () => ({
  useWallet: () => ({ isConnected: false, account: null, connect: jest.fn(), disconnect: jest.fn() }),
}));

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

const jsonResponse = (body: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);

const mockPlayer = (id: number) => ({
  id,
  metadata: {
    id,
    firstName: 'Celio',
    lastName: 'Alcantara',
    age: 36,
    overall: 91,
    pace: 90,
    shooting: 93,
    passing: 86,
    dribbling: 92,
    defense: 41,
    physical: 72,
    goalkeeping: 0,
    positions: ['ST', 'LW', 'LM'],
    retirementYears: 2,
    nationalities: ['BRAZIL'],
    height: 188,
    preferredFoot: 'RIGHT',
  },
  ownedBy: { name: 'DogeSports HQ', walletAddress: '0x95dc70d7d39f6f76' },
  activeContract: { club: { id: 28, name: 'DogeSports Japan' } },
});

const mockHistory = (initialDate: string): PlayerExperienceEntry[] => [
  {
    date: new Date(initialDate).getTime(),
    reasonType: 'INITIAL',
    values: { age: 21, overall: 83, defense: 33, passing: 78, pace: 87, dribbling: 86, physical: 69, shooting: 82, goalkeeping: 0 },
  },
  { date: new Date('2025-01-27T00:00:00Z').getTime(), reasonType: 'NEW_AGE', values: { age: 22 } },
  { date: new Date('2025-06-01T00:00:00Z').getTime(), reasonType: 'TRAINING', values: { overall: 91, pace: 90 } },
];

const graphLegend = async () => (await screen.findByText('OVR:')).parentElement!;

const renderPlayer = (id: number, history: PlayerExperienceEntry[] = mockHistory('2024-12-17T10:00:00Z')) => {
  mockFetchHistory.mockResolvedValue({ success: true, data: history });
  mockFetch.mockImplementation((url) =>
    jsonResponse(String(url).includes(`/api/player/${id}`) ? { success: true, data: mockPlayer(id) } : { success: true, data: [] })
  );

  return render(
    <LoadingProvider>
      <PlayerResultsPage propPlayerId={String(id)} />
    </LoadingProvider>
  );
};

const rowValue = (label: string) => screen.getByText(label, { selector: 'span' }).parentElement!;

describe('Player page mint view', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it('links to the mint view and no longer to mflplayer.info or mflstats.com', async () => {
    renderPlayer(1001);

    const mintLink = await screen.findByRole('link', { name: 'View player mint' });
    expect(mintLink).toHaveAttribute('href', '/players/1001?view=mint');
    expect(screen.queryByText(/mflplayer\.info/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mflstats\.com/i)).not.toBeInTheDocument();
    expect(rowValue('Age')).toHaveTextContent('36');
    expect(await graphLegend()).toHaveTextContent('OVR:91(+8)');
  });

  it('shows the stats and details from the INITIAL entry with ?view=mint', async () => {
    mockSearchParams = new URLSearchParams('view=mint');
    renderPlayer(1002);

    expect(await screen.findByText('Viewing this player as minted on 17 Dec 2024')).toBeInTheDocument();
    expect(rowValue('Age')).toHaveTextContent('21');
    expect(rowValue('Minted')).toHaveTextContent('17 Dec 2024');
    // Only the current agency, team and market value are known
    expect(screen.queryByText('Agency')).not.toBeInTheDocument();
    expect(screen.queryByText('Team')).not.toBeInTheDocument();
    expect(screen.queryByText('Market Value Est')).not.toBeInTheDocument();
    expect(screen.queryByText(/Retirement in/)).not.toBeInTheDocument();
    // The stats grid shows the mint attributes (PAC 87, not the current 90)
    expect(screen.getByText('PAC').parentElement).toHaveTextContent('87');
    expect(screen.getAllByRole('link', { name: 'View current player' })[0]).toHaveAttribute('href', '/players/1002');
    // The progression graph stops at the mint too
    expect(await graphLegend()).toHaveTextContent(/^OVR:83$/);
  });

  it('flags a snapshot from MFL\'s November 2024 backfill as the earliest record', async () => {
    mockSearchParams = new URLSearchParams('view=mint');
    renderPlayer(1003, mockHistory('2024-11-13T10:00:00Z'));

    expect(await screen.findByText("Viewing this player's earliest recorded stats, from 13 Nov 2024")).toBeInTheDocument();
    expect(rowValue('Minted')).toHaveTextContent('By 13 Nov 2024');
  });

  it('says so and keeps the current stats when there is no mint record', async () => {
    mockSearchParams = new URLSearchParams('view=mint');
    renderPlayer(1004, []);

    expect(await screen.findByText('MFL has no mint record for this player, so these are its current stats.')).toBeInTheDocument();
    expect(rowValue('Age')).toHaveTextContent('36');
  });
});
