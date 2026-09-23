export type OrgInvitation = {
  id: string;
  email: string;
  role: string;
  projectId: string | null;
  projectIds: string[];
  projectRole: string | null;
  partnerId: string | null;
  expiresAt: string | null;
  createdAt: string;
};
