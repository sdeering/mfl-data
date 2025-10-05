import type { MFLPlayer, PlayerPosition, PositionRatings, PlayerTrait } from '../types/player';

describe('Player Types', () => {
  describe('PlayerPosition', () => {
    it('should accept valid position values', () => {
      const validPositions: PlayerPosition[] = [
        'GK', 'LB', 'CB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 
        'LM', 'RM', 'LW', 'RW', 'CF', 'ST'
      ];
      
      validPositions.forEach(position => {
        expect(position).toBeDefined();
      });
    });
  });

  describe('PositionRatings', () => {
    it('should allow ratings for all positions', () => {
      const ratings: PositionRatings = {
        GK: 85,
        LB: 78,
        CB: 82,
        RB: 76,
        LWB: 80,
        RWB: 79,
        CDM: 83,
        CM: 81,
        CAM: 87,
        LM: 84,
        RM: 82,
        LW: 86,
        RW: 85,
        CF: 88,
        ST: 89
      };
      
      expect(ratings.GK).toBe(85);
      expect(ratings.CAM).toBe(87);
      expect(ratings.ST).toBe(89);
    });

    it('should allow partial ratings', () => {
      const partialRatings: PositionRatings = {
        GK: 85,
        CAM: 87,
        ST: 89
      };
      
      expect(partialRatings.GK).toBe(85);
      expect(partialRatings.CB).toBeUndefined();
    });
  });

  describe('PlayerTrait', () => {
    it('should have name and value properties', () => {
      const trait: PlayerTrait = {
        name: 'Position',
        value: 'CAM'
      };
      
      expect(trait.name).toBe('Position');
      expect(trait.value).toBe('CAM');
    });
  });

  describe('MFLPlayer', () => {
    it('should allow basic player information', () => {
      const player: MFLPlayer = {
        id: '116267',
        name: 'Max Pasquier',
        description: 'MFL Player',
        thumbnail: 'https://example.com/image.jpg',
        owner: '0x95dc70d7d39f6f76'
      };
      
      expect(player.id).toBe('116267');
      expect(player.name).toBe('Max Pasquier');
      expect(player.owner).toBe('0x95dc70d7d39f6f76');
    });

    it('should allow personal information', () => {
      const player: MFLPlayer = {
        id: '116267',
        name: 'Max Pasquier',
        age: 25,
        height: 180,
        foot: 'Right',
        country: 'France'
      };
      
      expect(player.age).toBe(25);
      expect(player.height).toBe(180);
      expect(player.foot).toBe('Right');
      expect(player.country).toBe('France');
    });

    it('should allow position information', () => {
      const player: MFLPlayer = {
        id: '116267',
        name: 'Max Pasquier',
        primaryPosition: 'CAM',
        secondaryPositions: ['CM', 'RW']
      };
      
      expect(player.primaryPosition).toBe('CAM');
      expect(player.secondaryPositions).toEqual(['CM', 'RW']);
    });

    it('should allow position ratings', () => {
      const player: MFLPlayer = {
        id: '116267',
        name: 'Max Pasquier',
        overallRating: 87,
        positionRatings: {
          CAM: 89,
          CM: 85,
          RW: 83,
          LW: 82
        }
      };
      
      expect(player.overallRating).toBe(87);
      expect(player.positionRatings?.CAM).toBe(89);
      expect(player.positionRatings?.CM).toBe(85);
    });

    it('should allow legacy traits for backward compatibility', () => {
      const player: MFLPlayer = {
        id: '116267',
        name: 'Max Pasquier',
        traits: [
          { name: 'Position', value: 'CAM' },
          { name: 'Team', value: 'MFL Team' }
        ]
      };
      
      expect(player.traits).toHaveLength(2);
      expect(player.traits?.[0].name).toBe('Position');
      expect(player.traits?.[0].value).toBe('CAM');
    });

    it('should allow complete player with all metadata', () => {
      const completePlayer: MFLPlayer = {
        id: '116267',
        name: 'Max Pasquier',
        description: 'MFL Player - Max Pasquier',
        thumbnail: 'https://example.com/max-pasquier.jpg',
        owner: '0x95dc70d7d39f6f76',
        age: 25,
        height: 180,
        foot: 'Right',
        country: 'France',
        overallRating: 87,
        primaryPosition: 'CAM',
        secondaryPositions: ['CM', 'RW'],
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
          { name: 'Team', value: 'MFL Team' }
        ]
      };
      
      expect(completePlayer.id).toBe('116267');
      expect(completePlayer.name).toBe('Max Pasquier');
      expect(completePlayer.age).toBe(25);
      expect(completePlayer.overallRating).toBe(87);
      expect(completePlayer.primaryPosition).toBe('CAM');
      expect(completePlayer.positionRatings?.CAM).toBe(89);
      expect(completePlayer.traits).toHaveLength(2);
    });
  });
});
