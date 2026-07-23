export interface WaitlistEntryDto {
  id: string;
  email: string;
  source: string | null;
  createdAt: Date;
}

export interface WaitlistList {
  total: number;
  entries: WaitlistEntryDto[];
}
