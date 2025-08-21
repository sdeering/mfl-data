export interface MFLPlayer {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  owner?: string;
  traits?: Array<{
    name: string;
    value: string;
  }>;
}



