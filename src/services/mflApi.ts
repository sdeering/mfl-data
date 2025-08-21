import * as fcl from '@onflow/fcl';
import type { MFLPlayer } from '@/src/types/player';

export const configureFCL = (): void => {
  fcl.config({
    'accessNode.api': 'https://rest-mainnet.onflow.org',
    'discovery.wallet': 'https://fcl-discovery.onflow.org/authn',
  });
};

const CADENCE_GET_MFL_PLAYER = `
import NonFungibleToken from 0x1d7e57aa55817448
import MetadataViews from 0x1d7e57aa55817448
import MFLPlayer from 0x8ebcbfd516b1da27

access(all) fun main(nftId: UInt64, ownerAddress: Address): {String: AnyStruct}? {
  let account = getAccount(ownerAddress)
  
  // Use the correct Cadence 1.0 syntax for accessing capabilities
  let collectionCap = account.capabilities.get<&{NonFungibleToken.CollectionPublic}>(MFLPlayer.CollectionPublicPath)
  if let collectionRef = collectionCap.borrow() {
    // Fix: Remove the 'id:' label - just pass the parameter directly
    if let nft = collectionRef.borrowNFT(nftId) {
      let metadata: {String: AnyStruct} = {}
      metadata["id"] = nft.id

      if let display = nft.resolveView(Type<MetadataViews.Display>()) as? MetadataViews.Display {
        metadata["name"] = display.name
        metadata["description"] = display.description
        metadata["thumbnail"] = display.thumbnail.uri()
      }
      return metadata
    }
  }
  return nil
}
`;

// Mock owner discovery - in a real implementation, this would query events or use an indexer
export async function discoverOwnerAddressForPlayerId(playerId: string): Promise<string | null> {
  // For now, return a mock owner address for testing
  // In a real implementation, this would:
  // 1. Query Flow events for NFT transfers
  // 2. Use an indexer service
  // 3. Query the MFL contract for current owner
  
  // Mock implementation - replace with real logic
  if (playerId === "116267") {
    return "0x95dc70d7d39f6f76"; // Mock owner address for testing
  }
  
  // For other player IDs, we could implement real discovery here
  // For now, return null to indicate owner not found
  return null;
}

export async function searchMFLPlayerById(playerId: string): Promise<MFLPlayer> {
  console.log(`🔍 Starting search for player ID: ${playerId}`);
  configureFCL();

  // Automatically discover the owner address
  const ownerAddress = await discoverOwnerAddressForPlayerId(playerId);
  console.log(`👤 Owner address discovered: ${ownerAddress}`);
  
  if (!ownerAddress) {
    console.error(`❌ No owner address found for player ID: ${playerId}`);
    throw new Error(`Could not find owner for player ID ${playerId}. Please verify the player ID exists.`);
  }

  try {
    console.log(`📡 Querying Flow blockchain with:`);
    console.log(`  - Player ID: ${playerId} (UInt64)`);
    console.log(`  - Owner Address: ${ownerAddress} (Address)`);
    
    const response = await fcl.query({
      cadence: CADENCE_GET_MFL_PLAYER,
      args: (arg: any, t: any) => [arg(playerId, t.UInt64), arg(ownerAddress, t.Address)],
    });

    console.log(`📥 Flow response:`, response);

    if (!response) {
      console.warn(`⚠️ No data returned for player ID: ${playerId}`);
      throw new Error('Player not found');
    }

    const result: MFLPlayer = {
      id: String(response.id ?? playerId),
      name: String(response.name ?? ''),
      description: response.description ? String(response.description) : undefined,
      thumbnail: response.thumbnail ? String(response.thumbnail) : undefined,
      owner: ownerAddress,
    };
    
    console.log(`✅ Successfully retrieved player:`, result);
    return result;
  } catch (error: unknown) {
    console.error(`❌ Error querying Flow blockchain:`, error);
    const message = error instanceof Error ? error.message : 'Unknown error querying Flow';
    throw new Error(message);
  }
}


