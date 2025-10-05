# Player Data Files

This folder contains all generated Excel files with football player data from the MFL API.

## File Descriptions

### Main Data Files
- **`corrected-player-data.xlsx`** (1.1MB) - **RECOMMENDED** - Complete dataset with 633 players and FIXED position ratings (primary position = overall rating)
- **`full-player-data.xlsx`** (1.1MB) - Complete dataset with 641 players (original version with position rating bug)
- **`comprehensive-player-data.xlsx`** (114KB) - Test dataset with 53 players (50 new + 3 sample)

### Progress Files
- **`player-data-progress-corrected.xlsx`** (1.0MB) - Progress backup for corrected scraper (every 100 players)
- **`player-data-progress.xlsx`** (1.0MB) - Progress backup for original scraper (every 100 players)

### Test Files
- **`test-corrected-player-data.xlsx`** (27KB) - Test file with 6 players to verify position rating fix
- **`player-data.xlsx`** (40KB) - Initial test file with 13 players (10 new + 3 sample)

## Data Sources
- **Wallet 1:** `0xa7942ae65333f69d` (109 players)
- **Wallet 2:** `0x55e8be2966409ed4` (524 players)
- **Total Unique Players:** 633

## Position Ratings
Each player includes ratings for all positions:
- ST, CF, CAM, RW, LW, RM, LM, CM, CDM, RWB, LWB, RB, LB, CB, GK

### Position Rating Logic
- **Primary Position:** Always equals the player's overall rating
- **Other Positions:** Calculated using weighted formulas based on player attributes
- **Attributes Used:** pace, shooting, passing, dribbling, defense, physical, goalkeeping

## Recommended Usage
Use **`corrected-player-data.xlsx`** for all analysis as it contains the properly calculated position ratings where each player's primary position matches their overall rating.

## File Structure
Each Excel file contains columns for:
- Player name, ID, input URL, raw JSON data
- Primary and secondary positions
- All position ratings (ST through GK)


