export interface IUser {
  id: string;
  discord_id?: string | null;
  email: string;
  username: string;
  avatar?: string | null;
  provider?: string | null;
  password?: string | null;
  admin: boolean;
  coins: number;
  pterodactylId?: string | null;
  resources: Resources;
}

export interface Resources {
  cpu: number;
  ram: number;
  disk: number;
  backup: number;
  database: number;
  allocation: number;
  servers: number;
}
