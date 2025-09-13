import ClubPlayersPage from '@/src/components/ClubPlayersPage';

interface ClubPageProps {
  params: Promise<{
    clubId: string;
  }>;
}

export default async function ClubPage({ params }: ClubPageProps) {
  const { clubId } = await params;
  return <ClubPlayersPage clubId={clubId} />;
}
