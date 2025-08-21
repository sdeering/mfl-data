import * as fcl from '@onflow/fcl';
import { searchMFLPlayerById, configureFCL, discoverOwnerAddressForPlayerId } from '@/src/services/mflApi';

jest.mock('@onflow/fcl', () => ({
  config: jest.fn(() => ({ put: jest.fn() })),
  query: jest.fn(),
}));

describe('MFL API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return player "Max Pasquier" for ID 116267', async () => {
    (fcl.query as jest.Mock).mockResolvedValue({
      id: 116267,
      name: 'Max Pasquier',
      description: 'MFL Player',
      thumbnail: 'https://example.com/img.png',
    });

    const player = await searchMFLPlayerById('116267');
    expect(player).toBeDefined();
    expect(player.name).toBe('Max Pasquier');
    expect(player.id).toBe('116267');
    expect(player.owner).toBe('0x95dc70d7d39f6f76');
  });

  it('should throw error when owner is not found', async () => {
    await expect(searchMFLPlayerById('999999')).rejects.toThrow(
      'Could not find owner for player ID 999999. Please verify the player ID exists.'
    );
  });

  it('should discover owner address for known player ID', async () => {
    const owner = await discoverOwnerAddressForPlayerId('116267');
    expect(owner).toBe('0x95dc70d7d39f6f76');
  });

  it('should return null for unknown player ID', async () => {
    const owner = await discoverOwnerAddressForPlayerId('999999');
    expect(owner).toBeNull();
  });
});


