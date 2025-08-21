import PlayerSearch from '@/src/components/PlayerSearch';

export default function Home() {
  return (
    <div className="min-h-screen p-8 sm:p-16">
      <h1 className="text-2xl font-bold">MFL Player Search</h1>
      <p className="mt-2 text-sm text-gray-600">Search by Player ID on Flow mainnet. Owner address is automatically discovered.</p>
      <div className="mt-6">
        <PlayerSearch />
      </div>
    </div>
  );
}
