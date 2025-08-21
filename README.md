# MFL Player Search

A Next.js application for searching MFL (Meta Football League) players on the Flow blockchain. This application allows users to search for player information by Player ID, automatically discovering the owner address and retrieving player metadata from the blockchain.

## Features

- 🔍 **Player Search**: Search for MFL players by Player ID
- 🚀 **Automatic Owner Discovery**: Automatically finds the owner address for a given player ID
- 📱 **Modern UI**: Clean, responsive interface built with Next.js and Tailwind CSS
- ⚡ **Fast Performance**: Built with Next.js 15 and Turbopack
- 🧪 **Comprehensive Testing**: Full test coverage with Jest and React Testing Library
- 🔗 **Flow Blockchain Integration**: Direct integration with Flow mainnet

## Tech Stack

- **Framework**: Next.js 15 with Turbopack
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Blockchain**: Flow (using @onflow/fcl)
- **Testing**: Jest, React Testing Library
- **Language**: Cadence (for blockchain scripts)

## Getting Started

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

## Usage

1. Enter a Player ID (e.g., `116267`)
2. Click "Search"
3. View the player's information including name, description, and thumbnail

## Testing

Run the test suite:
```bash
npm test
```

The project includes comprehensive tests covering:
- Component rendering and interactions
- API service functionality
- User flow integration
- Error handling

## Project Structure

```
mfl-player-search/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── src/
│   ├── components/        # React components
│   │   ├── PlayerSearch.tsx
│   │   └── PlayerDetails.tsx
│   ├── services/          # API services
│   │   └── mflApi.ts      # Flow blockchain integration
│   ├── types/             # TypeScript type definitions
│   │   └── player.ts
│   └── __tests__/         # Test files
├── e2e/                   # End-to-end tests (if needed)
└── public/                # Static assets
```

## Flow Blockchain Integration

The application integrates with the Flow blockchain using:
- **Cadence Scripts**: For querying player data
- **FCL (Flow Client Library)**: For blockchain communication
- **Metadata Views**: For retrieving NFT metadata

### Cadence Script Features

- Automatic owner discovery
- NFT metadata retrieval
- Error handling for missing players

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Flow Blockchain](https://flow.com/) for the blockchain infrastructure
- [Next.js](https://nextjs.org/) for the React framework
- [Tailwind CSS](https://tailwindcss.com/) for styling
# Force new deployment
