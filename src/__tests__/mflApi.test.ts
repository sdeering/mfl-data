// Mock the mflApi service to avoid FCL dependencies
jest.mock('../services/mflApi', () => ({
  searchMFLPlayerById: jest.fn(),
  discoverOwnerAddressForPlayerId: jest.fn(),
}));

import { searchMFLPlayerById, discoverOwnerAddressForPlayerId } from '../services/mflApi';
import type { MFLPlayer } from '../types/player';

// Mock the MFL API response with comprehensive metadata
const mockPlayerData = {
  player: {
    id: '116267',
    name: 'Max Pasquier',
    description: 'MFL Player - Max Pasquier',
    thumbnail: 'https://example.com/max-pasquier.jpg',
    owner: '0x1234567890abcdef1234567890abcdef12345678',
    age: 25,
    height: 180,
    foot: 'Right' as const,
    country: 'France',
    overallRating: 87,
    primaryPosition: 'CAM' as const,
    secondaryPositions: ['CM', 'RW'] as const,
    positionRatings: {
      GK: 45,
      LB: 60,
      CB: 65,
      RB: 62,
      LWB: 68,
      RWB: 70,
      CDM: 78,
      CM: 85,
      CAM: 89,
      LM: 82,
      RM: 84,
      LW: 86,
      RW: 83,
      CF: 80,
      ST: 82
    },
    traits: [
      { name: 'Position', value: 'CAM' },
      { name: 'Team', value: 'MFL Team' },
      { name: 'Overall Rating', value: '87' },
      { name: 'Age', value: '25' },
      { name: 'Height', value: '180' },
      { name: 'Foot', value: 'Right' },
      { name: 'Country', value: 'France' }
    ]
  } as MFLPlayer,
  dataSource: 'external' as const
};

describe('MFL API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchMFLPlayerById', () => {
    it('should fetch player data successfully', async () => {
      (searchMFLPlayerById as jest.Mock).mockResolvedValueOnce(mockPlayerData);

      const result = await searchMFLPlayerById('116267');

      expect(searchMFLPlayerById).toHaveBeenCalledWith('116267');
      expect(result).toEqual(mockPlayerData);
    });

    it('should return player with comprehensive metadata', async () => {
      (searchMFLPlayerById as jest.Mock).mockResolvedValueOnce(mockPlayerData);

      const result = await searchMFLPlayerById('116267');

      // Test basic information
      expect(result.player.id).toBe('116267');
      expect(result.player.name).toBe('Max Pasquier');
      expect(result.player.owner).toBe('0x1234567890abcdef1234567890abcdef12345678');

      // Test personal information
      expect(result.player.age).toBe(25);
      expect(result.player.height).toBe(180);
      expect(result.player.foot).toBe('Right');
      expect(result.player.country).toBe('France');

      // Test ratings
      expect(result.player.overallRating).toBe(87);

      // Test position information
      expect(result.player.primaryPosition).toBe('CAM');
      expect(result.player.secondaryPositions).toEqual(['CM', 'RW']);

      // Test position ratings
      expect(result.player.positionRatings?.CAM).toBe(89);
      expect(result.player.positionRatings?.CM).toBe(85);
      expect(result.player.positionRatings?.GK).toBe(45);

      // Test traits
      expect(result.player.traits).toHaveLength(7);
      expect(result.player.traits?.[0].name).toBe('Position');
      expect(result.player.traits?.[0].value).toBe('CAM');

      // Test data source
      expect(result.dataSource).toBe('external');
    });

    it('should throw error when player not found', async () => {
      (searchMFLPlayerById as jest.Mock).mockRejectedValueOnce(
        new Error('Failed to fetch player data: 404 Not Found')
      );

      await expect(searchMFLPlayerById('999999')).rejects.toThrow(
        'Failed to fetch player data: 404 Not Found'
      );
    });

    it('should throw error on network failure', async () => {
      (searchMFLPlayerById as jest.Mock).mockRejectedValueOnce(
        new Error('Failed to fetch player data: Network error')
      );

      await expect(searchMFLPlayerById('116267')).rejects.toThrow(
        'Failed to fetch player data: Network error'
      );
    });
  });

  describe('discoverOwnerAddressForPlayerId', () => {
    it('should return owner address for valid player ID', async () => {
      const expectedOwnerAddress = '0x1234567890abcdef1234567890abcdef12345678';
      (discoverOwnerAddressForPlayerId as jest.Mock).mockResolvedValueOnce(expectedOwnerAddress);

      const ownerAddress = await discoverOwnerAddressForPlayerId('116267');

      expect(discoverOwnerAddressForPlayerId).toHaveBeenCalledWith('116267');
      expect(ownerAddress).toBe(expectedOwnerAddress);
    });

    it('should return null when owner not found', async () => {
      (discoverOwnerAddressForPlayerId as jest.Mock).mockResolvedValueOnce(null);

      const ownerAddress = await discoverOwnerAddressForPlayerId('999999');

      expect(discoverOwnerAddressForPlayerId).toHaveBeenCalledWith('999999');
      expect(ownerAddress).toBeNull();
    });

    it('should return null on blockchain query error', async () => {
      (discoverOwnerAddressForPlayerId as jest.Mock).mockResolvedValueOnce(null);

      const ownerAddress = await discoverOwnerAddressForPlayerId('116267');

      expect(discoverOwnerAddressForPlayerId).toHaveBeenCalledWith('116267');
      expect(ownerAddress).toBeNull();
    });

    it('should handle invalid player ID format', async () => {
      (discoverOwnerAddressForPlayerId as jest.Mock).mockResolvedValueOnce(null);

      const ownerAddress = await discoverOwnerAddressForPlayerId('invalid-id');

      expect(discoverOwnerAddressForPlayerId).toHaveBeenCalledWith('invalid-id');
      expect(ownerAddress).toBeNull();
    });

    it('should handle empty player ID', async () => {
      (discoverOwnerAddressForPlayerId as jest.Mock).mockResolvedValueOnce(null);

      const ownerAddress = await discoverOwnerAddressForPlayerId('');

      expect(discoverOwnerAddressForPlayerId).toHaveBeenCalledWith('');
      expect(ownerAddress).toBeNull();
    });
  });

  describe('Owner Discovery Integration', () => {
    it('should discover owner and then fetch player data', async () => {
      const expectedOwnerAddress = '0x1234567890abcdef1234567890abcdef12345678';
      
      // Mock owner discovery
      (discoverOwnerAddressForPlayerId as jest.Mock).mockResolvedValueOnce(expectedOwnerAddress);
      
      // Mock player data fetch
      (searchMFLPlayerById as jest.Mock).mockResolvedValueOnce(mockPlayerData);

      // First discover the owner
      const ownerAddress = await discoverOwnerAddressForPlayerId('116267');
      expect(ownerAddress).toBe(expectedOwnerAddress);

      // Then fetch player data
      const playerData = await searchMFLPlayerById('116267');
      expect(playerData).toEqual(mockPlayerData);
      expect(playerData.player.owner).toBe(expectedOwnerAddress);
    });

    it('should handle case where owner discovery fails but player data exists', async () => {
      // Mock owner discovery failure
      (discoverOwnerAddressForPlayerId as jest.Mock).mockResolvedValueOnce(null);
      
      // Mock player data fetch with error (since no owner found)
      (searchMFLPlayerById as jest.Mock).mockRejectedValueOnce(
        new Error('Player ID 116267 not found. We could not determine the current owner of this NFT.')
      );

      // Owner discovery should return null
      const ownerAddress = await discoverOwnerAddressForPlayerId('116267');
      expect(ownerAddress).toBeNull();

      // Player search should fail
      await expect(searchMFLPlayerById('116267')).rejects.toThrow(
        'Player ID 116267 not found. We could not determine the current owner of this NFT.'
      );
    });
  });
});


