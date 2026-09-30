
export type Membership = {
  role: "owner" | "manager" | "staff" | "accountant";
  locationId: string;
  locationName: string;
  locationType: "farm" | "store";
  locationCode: string | null;
};

export type Session = {
  userId: string;
  email: string | null;
  fullName: string | null;
  isOwner: boolean;
  orgId: string;
  orgName: string;
  memberships: Membership[];
};
