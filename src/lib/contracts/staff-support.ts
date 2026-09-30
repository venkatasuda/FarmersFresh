
export type Ticket = {
  id: string;
  subject: string;
  message: string;
  orderNumber: string | null;
  status: "open" | "resolved";
  staffReply: string | null;
  createdAt: string;
};
