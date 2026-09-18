import React from 'react';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScoutPage from '../components/ScoutPage';
import { loadProgressionHistories } from '../services/playerProgressionService';
import type { PlayerExperienceEntry } from '../types/playerExperience';

jest.mock('../services/playerProgressionService', () => ({
  loadProgressionHistories: jest.fn()
}));
const mockLoadHistories = loadProgressionHistories as jest.Mock;

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => Date.now() - days * DAY_MS;

const START = { pace: 70, shooting: 72, passing: 65, dribbling: 71, defense: 40, physical: 68, goalkeeping: 0 };

const listing = (id: number, firstName: string, price: number, createdDateTime: number, positions = ['ST']) => ({
  listingResourceId: `listing-${id}`,
  status: 'AVAILABLE',
  price,
  player: { id, metadata: { id, firstName, lastName: 'Test', overall: 71, age: 21, positions, ...START } },
  sellerAddress: '0xseller',
  sellerName: 'Seller',
  createdDateTime
});

// A striker's shooting +1 is worth 0.46 overall points; shooting +1 with pace +1 is worth 0.56
const risingHistory: PlayerExperienceEntry[] = [
  { date: daysAgo(400), values: { overall: 70, ...START, shooting: 70 } },
  { date: daysAgo(200), values: { shooting: 71 } }, // Too long ago for any column
  { date: daysAgo(60), values: { shooting: 72 } }, // 90 days
  { date: daysAgo(20), values: { shooting: 73 } }, // 30 days
  { date: daysAgo(2), values: { overall: 71, shooting: 74, pace: 71 } } // 7 days
];

const mockListings = (body: unknown, status = 200) => {
  global.fetch = jest.fn().mockResolvedValue({ ok: status === 200, status, json: async () => body }) as jest.Mock;
};

const cells = (playerName: string) => within(screen.getByText(playerName).closest('tr')!).getAllByRole('cell').map(cell => cell.textContent);

describe('ScoutPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListings({ success: true, data: [listing(1, 'Steady', 50, daysAgo(0.01), ['ST', 'CF', 'CB']), listing(2, 'Rising', 120, daysAgo(1))] });
    mockLoadHistories.mockImplementation(async (playerIds: number[], onProgress: (update: unknown) => void) => {
      onProgress({ histories: { 1: [], 2: risingHistory }, refreshed: 0, toRefresh: 0, failedIds: [], done: true });
    });
  });

  test('opens on the default scouting filter and loads the history of every listed player', async () => {
    render(<ScoutPage />);
    await screen.findByText('Rising Test');

    const url = new URL((global.fetch as jest.Mock).mock.calls[0][0], 'http://localhost');
    expect(url.pathname).toBe('/api/listings');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      limit: '20', type: 'PLAYER', sorts: 'listing.createdDateTime', sortsOrders: 'DESC', status: 'AVAILABLE',
      ageMax: '23', overallMin: '70', overallMax: '82', paceMin: '50', passingMin: '50', isFreeAgent: 'true', view: 'full'
    });
    expect(mockLoadHistories.mock.calls[0][0]).toEqual([1, 2]);
  });

  test('shows the overall points gained over 7, 30 and 90 days', async () => {
    render(<ScoutPage />);
    await screen.findByText('Rising Test');

    const headers = screen.getAllByRole('columnheader').map(header => header.textContent);
    // Player, age, pos, rating, price, listed, then the three overall columns
    expect(headers.slice(6, 9)).toEqual(['+OVR 7D', '+OVR 30D ↓', '+OVR 90D']);
    await waitFor(() => expect(cells('Rising Test').slice(6, 9)).toEqual(['+0.56', '+1.02', '+1.48']));
    expect(cells('Steady Test').slice(6, 9)).toEqual(['–', '–', '–']);
  });

  test('shows each player’s current stats in their MFL tier colours', async () => {
    render(<ScoutPage />);
    await screen.findByText('Rising Test');

    const headers = screen.getAllByRole('columnheader').map(header => header.textContent);
    expect(headers.slice(9)).toEqual(['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY', 'GK']);
    expect(cells('Steady Test').slice(9)).toEqual(['70', '72', '65', '71', '40', '68', '–']); // Outfield players have no goalkeeping

    const row = within(screen.getByText('Steady Test').closest('tr')!);
    expect(row.getByText('70')).toHaveClass('bg-[#71ff30]'); // 65+ is green
    expect(row.getByText('40')).toHaveClass('bg-[#9f9f9f]'); // Under 55 is grey
  });

  test('rates the player at every position they can play', async () => {
    render(<ScoutPage />);
    await screen.findByText('Rising Test');

    expect(cells('Rising Test')[2]?.trim()).toBe('ST 71'); // At their primary position a player rates their overall
    expect(cells('Steady Test')[2]).toMatch(/^ST \d+ CF \d+ CB \d+ $/); // Reads as words, not "ST 71CF 66"
    const [primary, similar, unfamiliar] = cells('Steady Test')[2]!.match(/[A-Z]+ \d+/g)!;
    expect(primary).toBe('ST 71');
    expect(similar).toMatch(/^CF \d+$/);
    expect(unfamiliar).toMatch(/^CB \d+$/);
    // A striker who can fill in at centre back is far weaker there than at centre forward
    expect(Number(unfamiliar.slice(3))).toBeLessThan(Number(similar.slice(3)));
  });

  test('opens with the biggest 30-day riser first and sorts by any column', async () => {
    render(<ScoutPage />);
    await screen.findByText('Rising Test');

    const names = () => screen.getAllByRole('row').slice(1).map(row => within(row).getAllByRole('cell')[0].textContent);
    await waitFor(() => expect(names()).toEqual(['Rising Test', 'Steady Test']));

    fireEvent.click(screen.getByText('Price'));
    expect(names()).toEqual(['Rising Test', 'Steady Test']); // Dearest first
    fireEvent.click(screen.getByText(/^Price/));
    expect(names()).toEqual(['Steady Test', 'Rising Test']);
  });

  test('marks progression as pending until a player’s history arrives', async () => {
    mockLoadHistories.mockImplementation(async (playerIds: number[], onProgress: (update: unknown) => void) => {
      onProgress({ histories: { 1: [] }, refreshed: 0, toRefresh: 1, failedIds: [], done: false });
    });
    render(<ScoutPage />);
    await screen.findByText('Rising Test');

    await waitFor(() => expect(cells('Steady Test')[6]).toBe('–'));
    expect(cells('Rising Test').slice(6, 9)).toEqual(['…', '…', '…']);
    expect(cells('Rising Test')[9]).toBe('70'); // Current stats come with the listing, so they never wait
    expect(screen.getByRole('status')).toHaveTextContent('0 / 1 players');
  });

  test('searches MFL again only when asked, with the edited filters', async () => {
    render(<ScoutPage />);
    await screen.findByText('Rising Test');
    const searches = () => (global.fetch as jest.Mock).mock.calls.map(call => new URL(call[0], 'http://localhost').searchParams);
    const searchesOnLoad = searches().length;

    fireEvent.change(screen.getByLabelText('Position'), { target: { value: '__GROUP_DEFENDERS' } });
    fireEvent.change(screen.getByLabelText('Max age'), { target: { value: '21' } });
    fireEvent.change(screen.getByLabelText('Min PAC'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Min DEF'), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText('Players'), { target: { value: 'all' } });
    expect(searches()).toHaveLength(searchesOnLoad); // Editing alone asks nothing of MFL

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(searches()).toHaveLength(searchesOnLoad + 1));

    const query = Object.fromEntries(searches()[searchesOnLoad]);
    expect(query).toMatchObject({ positions: 'CB,LB,RB,LWB,RWB', ageMax: '21', defenseMin: '60', overallMin: '70', overallMax: '82', passingMin: '50' });
    expect(query).not.toHaveProperty('paceMin');
    expect(query).not.toHaveProperty('isFreeAgent');

    // Reset goes back to the default search. Nothing can be searched for while a search is running.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(searches()).toHaveLength(searchesOnLoad + 2));
    expect(Object.fromEntries(searches()[searchesOnLoad + 1])).toMatchObject({ ageMax: '23', paceMin: '50', isFreeAgent: 'true' });
    expect(Object.fromEntries(searches()[searchesOnLoad + 1])).not.toHaveProperty('positions');
    expect(screen.getByLabelText('Position')).toHaveValue('all');
    expect(screen.getByLabelText('Max age')).toHaveValue('23');
    expect(screen.getByLabelText('Players')).toHaveValue('freeAgents');
  });

  test('says when MFL is rate limiting instead of showing an empty table', async () => {
    mockListings({ success: false, error: 'MFL API rate limit exceeded', retryAfterSeconds: 540, data: [] }, 429);
    render(<ScoutPage />);

    expect(await screen.findByText(/MFL is limiting requests right now — try again in about 9 minutes/)).toBeInTheDocument();
    expect(mockLoadHistories).not.toHaveBeenCalled();
  });
});
