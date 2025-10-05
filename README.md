# MFL Player Search & Analytics

A comprehensive Next.js application for searching, analyzing, and comparing MFL (Meta Football League) players. This application provides advanced market value estimation, player comparison tools, sale history tracking, and comprehensive position-specific ratings across all 15 positions.

## 🚀 Features

### Core Functionality
- 🔍 **Player Search**: Search for MFL players by Player ID with automatic owner discovery
- 📊 **Position OVR Calculator**: Advanced algorithm calculating player ratings for all 15 positions
- 🎯 **Position Familiarity System**: Intelligent penalty system based on player position familiarity
- 🔗 **Flow Blockchain Integration**: Direct integration with Flow mainnet for real-time data

### Market Analysis & Valuation
- 💰 **Market Value Estimation**: Sophisticated algorithm with confidence levels and premium/penalty calculations
- 📈 **Sale History Tracking**: Complete transaction history with price analysis
- 📊 **Progression Analytics**: Visual graphs showing player development over time
- 🏆 **Recent Matches**: Performance tracking and match history
- 🏷️ **Smart Tags**: Automatic tagging for retirement, multiple positions, newly minted, and single owner players

### Player Comparison
- ⚖️ **Side-by-Side Comparison**: Compare two players simultaneously
- 📊 **Comprehensive Metrics**: Stats, ratings, market values, and performance data
- 📈 **Visual Analytics**: Progression graphs and performance comparisons
- 💰 **Market Value Comparison**: Direct comparison of estimated market values

### User Experience
- 🌙 **Dark Mode Support**: Beautiful dark theme with custom color scheme
- 📱 **Responsive Design**: Optimized for desktop, tablet, and mobile
- ⚡ **Fast Performance**: Built with Next.js 15 and Turbopack
- 🎨 **Modern UI**: Clean, intuitive interface built with Tailwind CSS
- 🔄 **Real-time Updates**: Live data fetching and calculations

### Data & Analytics
- 📊 **Position Ratings**: Comprehensive OVR ratings for all 15 positions
- 🎨 **Color-coded Ratings**: Visual rating system (85+ Purple, 75+ Blue, 65+ Green, 55+ Yellow, <55 Gray)
- 📈 **Progression Tracking**: Historical performance data and trends
- 💼 **Market Intelligence**: Sale history, price trends, and market analysis
- 🏆 **Performance Metrics**: Match statistics and performance indicators

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with Turbopack
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom dark mode
- **Blockchain**: Flow (using @onflow/fcl)
- **Testing**: Jest, React Testing Library, Playwright
- **Deployment**: Vercel with automatic deployments
- **Data Processing**: Advanced algorithms for market value and position calculations

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/mfl-player-search.git
cd mfl-player-search
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 Usage

### Player Search
1. Enter a Player ID (e.g., `116267`)
2. Click "Search"
3. View comprehensive player information including:
   - Basic player details and metadata
   - Position ratings for all 15 positions
   - Market value estimate with confidence level
   - Sale history and transaction data
   - Progression graphs and performance trends
   - Recent matches and statistics

### Player Comparison
1. Navigate to the Compare page
2. Enter Player IDs for two players
3. View side-by-side comparison including:
   - Stats and ratings comparison
   - Market value estimates
   - Sale history analysis
   - Progression graph comparisons
   - Recent performance data

### Market Analysis
- **Market Value Estimates**: View calculated market values with confidence levels
- **Sale History**: Track all transactions and price trends
- **Premium/Penalty Analysis**: Understand factors affecting player value
- **Position-specific Valuations**: See how position affects market value

## 🧪 Testing

Run the test suite:
```bash
npm test
```

Run end-to-end tests:
```bash
npm run test:e2e
```

The project includes comprehensive tests covering:
- Component rendering and interactions
- API service functionality
- Market value calculation algorithms
- Position rating calculations
- User flow integration
- Error handling

## 📁 Project Structure

``` 
mfl-player-search/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout with dark mode
│   ├── page.tsx           # Home page with search
│   ├── players/[id]/      # Individual player pages
│   └── compare/           # Player comparison page
├── src/
│   ├── components/        # React components
│   │   ├── PlayerSearch.tsx
│   │   ├── PlayerResultsPage.tsx
│   │   ├── PlayerImage.tsx
│   │   ├── PlayerStatsGrid.tsx
│   │   ├── PositionRatingsDisplay.tsx
│   │   ├── PlayerSaleHistory.tsx
│   │   ├── PlayerProgressionGraph.tsx
│   │   ├── PlayerRecentMatches.tsx
│   │   └── PlayerPositionSummary.tsx
│   ├── services/          # API services
│   │   ├── mflApi.ts      # Flow blockchain integration
│   │   ├── marketDataService.ts
│   │   ├── playerSaleHistoryService.ts
│   │   ├── playerExperienceService.ts
│   │   └── playerMatchesService.ts
│   ├── utils/             # Utility functions
│   │   ├── marketValueCalculator.ts
│   │   ├── positionFamiliarity.ts
│   │   ├── positionWeights.ts
│   │   ├── positionOvrCalculator.ts
│   │   └── ruleBasedPositionCalculator.ts
│   ├── types/             # TypeScript type definitions
│   │   ├── mflApi.ts
│   │   ├── playerSaleHistory.ts
│   │   ├── marketValueCalculator.ts
│   │   └── playerExperience.ts
│   ├── hooks/             # React hooks
│   │   └── usePositionOVR.ts
│   ├── contexts/          # React contexts
│   │   └── LoadingContext.tsx
│   └── __tests__/         # Test files
├── docs/                  # Documentation
│   └── POSITION_OVR_ALGORITHM.md
├── Data/                  # Generated player data
└── public/                # Static assets
```

## 🧮 Market Value Algorithm

The application includes a sophisticated market value estimation algorithm:

### Algorithm Features
- **Multi-factor Analysis**: Position, age, overall rating, progression, and market data
- **Premium/Penalty System**: Position-specific premiums, retirement penalties, progression bonuses
- **Confidence Levels**: Statistical confidence in market value estimates
- **Market Data Integration**: Real-time market analysis and comparison
- **Historical Analysis**: Sale history and progression data integration

### Calculation Factors
- **Base Market Value**: Derived from similar player sales
- **Position Premiums**: Position-specific value adjustments
- **Progression Bonuses**: Performance improvement rewards
- **Retirement Penalties**: Age and retirement year considerations
- **Experience Factors**: Match count and playing time analysis
- **Market Trends**: Current market conditions and demand

## 📊 Position OVR Calculation Algorithm

Advanced algorithm for calculating player ratings across all 15 positions:

### Algorithm Features
- **15 Position Support**: GK, CB, LB, RB, LWB, RWB, CDM, CM, CAM, LM, RM, LW, RW, CF, ST
- **Position-Specific Weights**: Each position has unique attribute importance weights
- **Familiarity Penalties**: Intelligent penalty system based on position familiarity
- **Color-Coded Ratings**: Visual rating system (85+ Purple, 75+ Blue, 65+ Green, 55+ Yellow, <55 Gray)
- **Real-time Calculation**: On-demand calculation with React hooks

For detailed algorithm documentation, see:
- [Position OVR Algorithm](docs/POSITION_OVR_ALGORITHM.md)
- [Market Value Algorithm](docs/MARKET_VALUE_ALGORITHM.md)

## 🔗 Flow Blockchain Integration

The application integrates with the Flow blockchain using:
- **Cadence Scripts**: For querying player data and metadata
- **FCL (Flow Client Library)**: For blockchain communication
- **Metadata Views**: For retrieving NFT metadata and owner information

### Cadence Script Features
- Automatic owner discovery
- NFT metadata retrieval
- Error handling for missing players
- Real-time blockchain data access

## 🚀 Deployment

The application is deployed on Vercel with:
- **Automatic Deployments**: Triggered on push to main branch
- **Environment Variables**: Secure configuration management
- **Performance Optimization**: Edge functions and CDN distribution
- **Monitoring**: Built-in analytics and error tracking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Flow Blockchain](https://flow.com/) for the blockchain infrastructure
- [Next.js](https://nextjs.org/) for the React framework
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Vercel](https://vercel.com/) for deployment and hosting
- [MFL Community](https://app.playmfl.com/) for inspiration and feedback
