
export type Farm = {
  id: string;
  name: string;
  location: string | null;
  kind: string;
  contact: string | null;
};

export type Batch = {
  id: string;
  productName: string;
  farmName: string | null;
  batchCode: string;
  sourceDate: string | null;
  quantity: number | null;
  createdAt: string;
};

export type RecallRow = {
  orderNumber: string;
  contactName: string;
  contactPhone: string;
  placedAt: string;
  status: string;
  quantity: number;
};
