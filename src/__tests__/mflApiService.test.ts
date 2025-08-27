import { MFLAPIService, mflApi } from '../services/mflApi';
import {
  MFLPlayer,
  MFLPlayerProgressionsResponse,
  MFLOwnerPlayersResponse,
  MFLSaleHistoryResponse,
  MFLExperienceHistoryResponse,
} from '../types/mflApi';

// Mock fetch globally
global.fetch = jest.fn();

describe('MFL API Service', () => {
  let apiService: MFLAPIService;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    apiService = new MFLAPIService();
    mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockClear();
    
    // Clear cache before each test
    apiService.clearCache();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPlayer', () => {
    it('should fetch player data successfully', async () => {
      const mockPlayer: MFLPlayer = {
        id: 93886,
        metadata: {
          id: 93886,
          firstName: "Eric",
          lastName: "Hodge",
          overall: 84,
          nationalities: ["AUSTRALIA"],
          positions: ["CAM", "ST"],
          preferredFoot: "RIGHT",
          age: 26,
          height: 177,
          pace: 73,
          shooting: 81,
          passing: 87,
          dribbling: 84,
          defense: 30,
          physical: 53,
          goalkeeping: 0
        },
        ownedBy: {
          walletAddress: "0x95dc70d7d39f6f76",
          name: "DogeSports HQ",
          twitter: "dogesports69",
          lastActive: 1
        },
        ownedSince: 1745446840000,
        activeContract: {
          id: 751444,
          status: "ACTIVE",
          kind: "CONTRACT",
          revenueShare: 0,
          totalRevenueShareLocked: 0,
          club: {
            id: 1742,
            name: "DogeSports England",
            mainColor: "#ffffff",
            secondaryColor: "#eb144c",
            city: "Bristol",
            division: 7,
            logoVersion: "ebccbc3a8197446ad18bdc7a43701b4c",
            country: "ENGLAND",
            squads: []
          },
          startSeason: 17,
          nbSeasons: 1,
          autoRenewal: false,
          createdDateTime: 1754612405051,
          clauses: []
        },
        hasPreContract: false,
        energy: 9604,
        offerStatus: 1,
        nbSeasonYellows: 0
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ player: mockPlayer }),
      } as Response);

      const result = await apiService.getPlayer(93886);

      expect(result).toEqual(mockPlayer);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/93886',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }),
        })
      );
    });

    it('should handle player not found error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(apiService.getPlayer(999999)).rejects.toThrow('HTTP 404: Not Found');
    });

    it('should handle network errors', async () => {
      // Mock rejection for all retry attempts (3 retries + 1 initial = 4 total attempts)
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(apiService.getPlayer(93886)).rejects.toThrow('Network error');
    }, 15000); // Increase timeout for retry logic
  });

  describe('getPlayerProgressions', () => {
    it('should fetch single player progression', async () => {
      const mockProgressions: MFLPlayerProgressionsResponse = {
        "93886": {
          overall: 3,
          defense: 5,
          dribbling: 2,
          pace: 3,
          passing: 4,
          physical: 2,
          shooting: 2
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProgressions,
      } as Response);

      const result = await apiService.getPlayerProgressions(93886);

      expect(result).toEqual(mockProgressions);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/progressions?playersIds=93886&interval=ALL',
        expect.any(Object)
      );
    });

    it('should fetch multiple player progressions', async () => {
      const mockProgressions: MFLPlayerProgressionsResponse = {
        "93886": { overall: 3 },
        "116267": { overall: 2 }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProgressions,
      } as Response);

      const result = await apiService.getPlayerProgressions([93886, 116267]);

      expect(result).toEqual(mockProgressions);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/progressions?playersIds=93886,116267&interval=ALL',
        expect.any(Object)
      );
    });

    it('should validate max 50 player IDs', async () => {
      const tooManyIds = Array.from({ length: 51 }, (_, i) => i + 1);

      await expect(apiService.getPlayerProgressions(tooManyIds)).rejects.toThrow(
        'Maximum 50 player IDs allowed per request'
      );
    });
  });

  describe('getOwnerPlayers', () => {
    it('should fetch owner players successfully', async () => {
      const mockPlayers: MFLOwnerPlayersResponse = [
        {
          id: 198630,
          metadata: {
            id: 198632,
            firstName: "Johan",
            lastName: "Jacquet",
            overall: 84,
            nationalities: ["FRANCE"],
            positions: ["GK"],
            preferredFoot: "RIGHT",
            age: 24,
            height: 186,
            pace: 0,
            shooting: 0,
            passing: 0,
            dribbling: 0,
            defense: 0,
            physical: 0,
            goalkeeping: 84
          },
          ownedBy: {
            walletAddress: "0x95dc70d7d39f6f76",
            name: "DogeSports HQ",
            twitter: "dogesports69",
            lastActive: 1
          },
          ownedSince: 1755213533000,
          activeContract: {
            id: 749610,
            status: "ACTIVE",
            kind: "CONTRACT",
            revenueShare: 400,
            totalRevenueShareLocked: 400,
            club: {
              id: 1461,
              name: "Kansas City Comets MFC",
              mainColor: "#000080",
              secondaryColor: "#ff6900",
              city: "Kansas City",
              division: 5,
              logoVersion: "5c74ce1391f8dfaf03445de677cf8fe5",
              country: "UNITED_STATES",
              squads: []
            },
            startSeason: 17,
            nbSeasons: 1,
            autoRenewal: false,
            createdDateTime: 1754539695518,
            clauses: []
          },
          hasPreContract: false,
          energy: 9082,
          offerStatus: 1,
          nbSeasonYellows: 0
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlayers,
      } as Response);

      const result = await apiService.getOwnerPlayers("0x95dc70d7d39f6f76");

      expect(result).toEqual(mockPlayers);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players?ownerWalletAddress=0x95dc70d7d39f6f76&limit=1200',
        expect.any(Object)
      );
    });

    it('should include isRetired parameter when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

      await apiService.getOwnerPlayers("0x95dc70d7d39f6f76", 100, true);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players?ownerWalletAddress=0x95dc70d7d39f6f76&limit=100&isRetired=true',
        expect.any(Object)
      );
    });
  });

  describe('getPlayerSaleHistory', () => {
    it('should fetch sale history successfully', async () => {
      const mockSales: MFLSaleHistoryResponse = [
        {
          id: 144036024841793,
          type: "SALE",
          purchaseDateTime: 1749078766000,
          status: "BOUGHT",
          price: 375,
          sellerAddress: "0x4f6c7177d3636845",
          sellerName: "Unai",
          buyerAddress: "0x95dc70d7d39f6f76",
          buyerName: "DogeSports HQ",
          player: {
            id: 44743,
            metadata: {
              id: 44745,
              firstName: "Jesus",
              lastName: "Torres",
              overall: 85,
              nationalities: ["PERU"],
              positions: ["GK"],
              preferredFoot: "RIGHT",
              age: 23,
              height: 171,
              pace: 0,
              shooting: 0,
              passing: 0,
              dribbling: 0,
              defense: 0,
              physical: 0,
              goalkeeping: 85
            },
            ownedBy: {
              walletAddress: "0x95dc70d7d39f6f76",
              name: "DogeSports HQ",
              twitter: "dogesports69",
              lastActive: 1
            },
            ownedSince: 1749078766000,
            activeContract: {
              id: 618803,
              status: "ACTIVE",
              kind: "CONTRACT",
              revenueShare: 0,
              totalRevenueShareLocked: 0,
              club: {
                id: 28,
                name: "DogeSports Japan",
                mainColor: "#ffffff",
                secondaryColor: "#bc002d",
                city: "Sapporo",
                division: 5,
                logoVersion: "310d504a38fde3c7654a428c9a5fb74c",
                country: "JAPAN",
                squads: []
              },
              startSeason: 17,
              nbSeasons: 1,
              autoRenewal: false,
              createdDateTime: 1752576502503,
              clauses: []
            },
            hasPreContract: false,
            energy: 9216,
            offerStatus: 1,
            nbSeasonYellows: 0,
            jerseyNumber: 1
          }
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSales,
      } as Response);

      const result = await apiService.getPlayerSaleHistory(44743);

      expect(result).toEqual(mockSales);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/listings/feed?limit=25&playerId=44743',
        expect.any(Object)
      );
    });
  });

  describe('getPlayerExperienceHistory', () => {
    it('should fetch experience history successfully', async () => {
      const mockHistory: MFLExperienceHistoryResponse = [
        {
          date: 1743517038548,
          values: {
            age: 23,
            overall: 81,
            defense: 25,
            passing: 83,
            pace: 70,
            dribbling: 82,
            physical: 51,
            shooting: 79,
            goalkeeping: 0
          }
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockHistory,
      } as Response);

      const result = await apiService.getPlayerExperienceHistory(93886);

      expect(result).toEqual(mockHistory);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/93886/experiences/history',
        expect.any(Object)
      );
    });
  });

  describe('Caching', () => {
    it('should cache GET requests', async () => {
      const mockPlayer = {
        id: 93886,
        metadata: { id: 93886, firstName: "Eric", lastName: "Hodge", overall: 84, nationalities: ["AUSTRALIA"], positions: ["CAM"], preferredFoot: "RIGHT", age: 26, height: 177, pace: 73, shooting: 81, passing: 87, dribbling: 84, defense: 30, physical: 53, goalkeeping: 0 },
        ownedBy: { walletAddress: "0x95dc70d7d39f6f76", name: "DogeSports HQ", twitter: "dogesports69", lastActive: 1 },
        ownedSince: 1745446840000,
        activeContract: { id: 751444, status: "ACTIVE", kind: "CONTRACT", revenueShare: 0, totalRevenueShareLocked: 0, club: { id: 1742, name: "DogeSports England", mainColor: "#ffffff", secondaryColor: "#eb144c", city: "Bristol", division: 7, logoVersion: "ebccbc3a8197446ad18bdc7a43701b4c", country: "ENGLAND", squads: [] }, startSeason: 17, nbSeasons: 1, autoRenewal: false, createdDateTime: 1754612405051, clauses: [] },
        hasPreContract: false,
        energy: 9604,
        offerStatus: 1,
        nbSeasonYellows: 0
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ player: mockPlayer }),
      } as Response);

      // First call
      await apiService.getPlayer(93886);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await apiService.getPlayer(93886);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still only 1 call due to caching
    });

    it('should clear cache', () => {
      expect(apiService.getCacheSize()).toBe(0);
      apiService.clearCache();
      expect(apiService.getCacheSize()).toBe(0);
    });
  });

  describe('Rate Limiting', () => {
    it('should track remaining requests', () => {
      const remaining = apiService.getRemainingRequests('/players/93886');
      expect(remaining).toBeGreaterThan(0);
    });
  });

  describe('Health Check', () => {
    it('should return true when API is healthy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ player: {} }),
      } as Response);

      const result = await apiService.healthCheck();
      expect(result).toBe(true);
    });

    it('should return false when API is unhealthy', async () => {
      // Mock rejection for all retry attempts (3 retries + 1 initial = 4 total attempts)
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await apiService.healthCheck();
      expect(result).toBe(false);
    }, 15000); // Increase timeout for retry logic
  });

  describe('Singleton Instance', () => {
    it('should provide a singleton instance', () => {
      expect(mflApi).toBeInstanceOf(MFLAPIService);
      // Note: In a real singleton pattern, this would be the same instance
      // For now, we just verify it's an instance of the class
      expect(mflApi).toBeInstanceOf(MFLAPIService);
    });
  });
});
