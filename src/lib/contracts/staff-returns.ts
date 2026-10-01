
export type ReturnRow = {
  id: string;
  orderNumber: string;
  reason: string;
  status: "requested" | "approved" | "rejected";
  refundPoints: number;
  staffNote: string | null;
  createdAt: string;
  hasAccount: boolean;
};
