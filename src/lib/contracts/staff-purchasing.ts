
export type Supplier = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
};

export type PoSummary = {
  id: string;
  poNumber: string;
  status: "draft" | "ordered" | "received" | "cancelled";
  supplier: string | null;
  notes: string | null;
  orderedAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  itemCount: number;
  totalCost: number;
};

export type PoItem = {
  id: string;
  productId: string;
  productName: string;
  qtyOrdered: number;
  unitCost: number;
  qtyReceived: number;
};

export type PoDetail = {
  id: string;
  poNumber: string;
  status: PoSummary["status"];
  supplier: string | null;
  notes: string | null;
  items: PoItem[];
};

export type ProcurementOverview = {
  openPos: number;
  suppliers: number;
  wastageValue30d: number;
};
