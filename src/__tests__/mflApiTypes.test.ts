import {
  MFLPosition,
  MFLInterval,
  MFLPlayer,
  MFLPlayerMetadata,
  MFLOwner,
  MFLClub,
  MFLContract,
  MFLPlayerProgression,
  MFLSaleHistoryItem,
  MFLExperienceHistoryItem,
  MFLPlayerResponse,
  MFLPlayerProgressionsResponse,
  MFLOwnerPlayersResponse,
  MFLSaleHistoryResponse,
  MFLExperienceHistoryResponse,
} from '../types/mflApi';

describe('MFL API Type Definitions', () => {
  describe('MFLPosition', () => {
    it('should accept valid positions', () => {
      const validPositions: MFLPosition[] = [
        'GK', 'RB', 'RWB', 'LB', 'LWB', 'CB', 'CDM', 'CM', 'CAM', 
        'LM', 'LW', 'RM', 'RW', 'CF', 'ST'
      ];
      
      validPositions.forEach(position => {
        expect(position).toBeDefined();
      });
    });
  });

  describe('MFLInterval', () => {
    it('should accept valid intervals', () => {
      const validIntervals: MFLInterval[] = [
        '24H', 'WEEK', 'MONTH', 'ALL', 'CURRENT_SEASON'
      ];
      
      validIntervals.forEach(interval => {
        expect(interval).toBeDefined();
      });
    });
  });

  describe('MFLPlayerMetadata', () => {
    it('should match actual API response structure', () => {
      const sampleMetadata: MFLPlayerMetadata = {
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
      };

      expect(sampleMetadata.id).toBe(93886);
      expect(sampleMetadata.firstName).toBe("Eric");
      expect(sampleMetadata.lastName).toBe("Hodge");
      expect(sampleMetadata.overall).toBe(84);
      expect(sampleMetadata.positions).toEqual(["CAM", "ST"]);
      expect(sampleMetadata.preferredFoot).toBe("RIGHT");
    });
  });

  describe('MFLOwner', () => {
    it('should match actual API response structure', () => {
      const sampleOwner: MFLOwner = {
        walletAddress: "0x95dc70d7d39f6f76",
        name: "DogeSports HQ",
        twitter: "dogesports69",
        lastActive: 1
      };

      expect(sampleOwner.walletAddress).toBe("0x95dc70d7d39f6f76");
      expect(sampleOwner.name).toBe("DogeSports HQ");
      expect(sampleOwner.twitter).toBe("dogesports69");
    });
  });

  describe('MFLClub', () => {
    it('should match actual API response structure', () => {
      const sampleClub: MFLClub = {
        id: 1742,
        name: "DogeSports England",
        mainColor: "#ffffff",
        secondaryColor: "#eb144c",
        city: "Bristol",
        division: 7,
        logoVersion: "ebccbc3a8197446ad18bdc7a43701b4c",
        country: "ENGLAND",
        squads: []
      };

      expect(sampleClub.id).toBe(1742);
      expect(sampleClub.name).toBe("DogeSports England");
      expect(sampleClub.city).toBe("Bristol");
      expect(sampleClub.division).toBe(7);
    });
  });

  describe('MFLContract', () => {
    it('should match actual API response structure', () => {
      const sampleContract: MFLContract = {
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
      };

      expect(sampleContract.id).toBe(751444);
      expect(sampleContract.status).toBe("ACTIVE");
      expect(sampleContract.kind).toBe("CONTRACT");
      expect(sampleContract.startSeason).toBe(17);
    });
  });

  describe('MFLPlayer', () => {
    it('should match actual API response structure', () => {
      const samplePlayer: MFLPlayer = {
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

      expect(samplePlayer.id).toBe(93886);
      expect(samplePlayer.metadata.firstName).toBe("Eric");
      expect(samplePlayer.metadata.lastName).toBe("Hodge");
      expect(samplePlayer.ownedBy.name).toBe("DogeSports HQ");
      expect(samplePlayer.activeContract.status).toBe("ACTIVE");
    });
  });

  describe('MFLPlayerResponse', () => {
    it('should match actual API response structure', () => {
      const sampleResponse: MFLPlayerResponse = {
        player: {
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
        }
      };

      expect(sampleResponse.player.id).toBe(93886);
      expect(sampleResponse.player.metadata.firstName).toBe("Eric");
    });
  });

  describe('MFLPlayerProgression', () => {
    it('should match actual API response structure', () => {
      const sampleProgression: MFLPlayerProgression = {
        overall: 3,
        defense: 5,
        dribbling: 2,
        pace: 3,
        passing: 4,
        physical: 2,
        shooting: 2
      };

      expect(sampleProgression.overall).toBe(3);
      expect(sampleProgression.defense).toBe(5);
      expect(sampleProgression.dribbling).toBe(2);
    });
  });

  describe('MFLPlayerProgressionsResponse', () => {
    it('should match actual API response structure', () => {
      const sampleResponse: MFLPlayerProgressionsResponse = {
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

      expect(sampleResponse["93886"].overall).toBe(3);
      expect(sampleResponse["93886"].defense).toBe(5);
    });
  });

  describe('MFLOwnerPlayersResponse', () => {
    it('should match actual API response structure', () => {
      const sampleResponse: MFLOwnerPlayersResponse = [
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

      expect(sampleResponse).toHaveLength(1);
      expect(sampleResponse[0].id).toBe(198630);
      expect(sampleResponse[0].metadata.firstName).toBe("Johan");
    });
  });

  describe('MFLSaleHistoryItem', () => {
    it('should match actual API response structure', () => {
      const sampleSale: MFLSaleHistoryItem = {
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
      };

      expect(sampleSale.id).toBe(144036024841793);
      expect(sampleSale.type).toBe("SALE");
      expect(sampleSale.status).toBe("BOUGHT");
      expect(sampleSale.price).toBe(375);
      expect(sampleSale.player.metadata.firstName).toBe("Jesus");
    });
  });

  describe('MFLExperienceHistoryItem', () => {
    it('should match actual API response structure', () => {
      const sampleHistory: MFLExperienceHistoryItem = {
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
      };

      expect(sampleHistory.date).toBe(1743517038548);
      expect(sampleHistory.values.age).toBe(23);
      expect(sampleHistory.values.overall).toBe(81);
      expect(sampleHistory.values.defense).toBe(25);
    });
  });

  describe('MFLExperienceHistoryResponse', () => {
    it('should match actual API response structure', () => {
      const sampleResponse: MFLExperienceHistoryResponse = [
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
        },
        {
          date: 1744144844379,
          values: {
            physical: 52
          }
        }
      ];

      expect(sampleResponse).toHaveLength(2);
      expect(sampleResponse[0].values.age).toBe(23);
      expect(sampleResponse[1].values.physical).toBe(52);
    });
  });
});
