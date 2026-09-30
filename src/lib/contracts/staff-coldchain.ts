
export type TempReading = {
  id: string;
  area: string;
  tempC: number;
  targetMin: number | null;
  targetMax: number | null;
  breach: boolean;
  note: string | null;
  createdAt: string;
};

export type ColdChain = { breaches: number; readings: TempReading[] };
