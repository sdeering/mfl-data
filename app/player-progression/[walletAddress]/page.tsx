import PlayerProgressionPage from '../../../src/components/PlayerProgressionPage';

export default async function WalletPlayerProgression({ params }: { params: Promise<{ walletAddress: string }> }) {
  const { walletAddress } = await params;
  return <PlayerProgressionPage walletAddress={walletAddress} />;
}
