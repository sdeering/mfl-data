export interface PlayerSaleHistoryEntry {
  id: number;
  type: 'SALE';
  purchaseDateTime: number; // Unix timestamp
  status: 'BOUGHT' | 'SOLD';
  price: number;
  sellerAddress: string;
  sellerName: string;
  buyerAddress: string;
  buyerName: string;
  player: {
    id: number;
    metadata: {
      id: number;
      firstName: string;
      lastName: string;
      overall: number;
      nationalities: string[];
      positions: string[];
      preferredFoot: 'LEFT' | 'RIGHT';
      age: number;
      height: number;
      pace: number;
      shooting: number;
      passing: number;
      dribbling: number;
      defense: number;
      physical: number;
      goalkeeping: number;
    };
  };
}

export interface PlayerSaleHistory {
  success: boolean;
  data: PlayerSaleHistoryEntry[];
  error?: string;
}
