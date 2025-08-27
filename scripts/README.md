# Football Player Data Scraper

This directory contains scripts to scrape football player data from the MFL (Meta Football League) API and generate Excel spreadsheets with player information and position ratings.

## Scripts Available

### 1. `scrape-players.js` - Basic Scraper
- Processes 10 new players (plus sample data)
- Includes web scraping attempt for position ratings
- Good for testing and small datasets

### 2. `comprehensive-scraper.js` - Medium Scraper
- Processes 50 new players (plus sample data)
- Uses calculated position ratings (no web scraping)
- Faster and more reliable

### 3. `full-scraper.js` - Complete Scraper
- Processes ALL players from both wallets
- Includes progress saving every 100 players
- Best for complete datasets

## Data Sources

The scripts fetch data from:
- **API**: `https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players`
- **Wallets**: 
  - `0xa7942ae65333f69d` (109 players)
  - `0x55e8be2966409ed4` (524 players)

## Sample Data Included

The scripts include 11 sample players with manually verified position ratings:
- Max Pasquier (LB)
- Jan Kessler (RM/ST)
- Fabrice Vallet (RWB/RM/CM)
- Eric Hodge (CAM/ST)
- Roger Pike (RM/ST/LM)
- Anthony Cornelis (ST)
- Eric Debruyne (ST/LM)
- Gerhard Beckmann (ST)
- Said Castellano (LW)
- Fritz Grimm (RM/ST)
- Noel Birch (ST)

## Position Ratings

The scripts calculate position ratings based on player attributes:
- **ST**: Shooting (40%) + Pace (30%) + Physical (20%) + Dribbling (10%)
- **CF**: Shooting (35%) + Passing (25%) + Pace (20%) + Dribbling (20%)
- **CAM**: Passing (40%) + Dribbling (30%) + Shooting (20%) + Pace (10%)
- **RW/LW**: Pace (40%) + Dribbling (30%) + Passing (20%) + Shooting (10%)
- **RM/LM**: Pace (35%) + Passing (30%) + Dribbling (25%) + Defense (10%)
- **CM**: Passing (35%) + Dribbling (25%) + Defense (25%) + Pace (15%)
- **CDM**: Defense (40%) + Passing (30%) + Physical (20%) + Pace (10%)
- **RWB/LWB**: Pace (35%) + Defense (30%) + Passing (25%) + Dribbling (10%)
- **RB/LB**: Defense (40%) + Pace (30%) + Passing (20%) + Physical (10%)
- **CB**: Defense (50%) + Physical (30%) + Passing (15%) + Pace (5%)
- **GK**: Uses goalkeeping attribute directly

## Usage

1. **Install dependencies** (if not already installed):
   ```bash
   npm install puppeteer xlsx axios cheerio
   ```

2. **Run a script**:
   ```bash
   # Basic scraper (10 players)
   node scripts/scrape-players.js
   
   # Comprehensive scraper (50 players)
   node scripts/comprehensive-scraper.js
   
   # Full scraper (all players)
   node scripts/full-scraper.js
   ```

3. **Output files**:
   - `player-data.xlsx` - Basic scraper output
   - `comprehensive-player-data.xlsx` - Medium scraper output
   - `full-player-data.xlsx` - Complete scraper output
   - `player-data-progress.xlsx` - Progress file (updated every 100 players)

## Excel Structure

The generated Excel files contain the following columns:
- **NAME**: Player's full name
- **#ID**: Unique player ID
- **INPUT URL**: API URL for the player
- **INPUT DATA**: Complete JSON data from API
- **Primary**: Primary position (first in positions array)
- **Secondary**: Secondary positions (comma-separated)
- **ST, CF, CAM, RW, LW, RM, LM, CM, CDM, RWB, LWB, RB, LB, CB, GK**: Position ratings

## Notes

- The scripts include delays to avoid overwhelming the API servers
- Position ratings are calculated using a formula based on player attributes
- Web scraping for position ratings was attempted but proved unreliable
- All player IDs are unique across both wallets
- The scripts automatically skip players that are already in the sample data

## Troubleshooting

- If you encounter API rate limiting, increase the delay in the scripts
- If the scripts fail, check your internet connection and API availability
- Progress files are saved every 100 players to prevent data loss
- The scripts handle errors gracefully and continue processing other players
