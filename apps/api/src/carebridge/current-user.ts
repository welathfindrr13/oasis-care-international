export type CarebridgeActor = {
  userId: string;
  email?: string;
  organizationId?: string | null;
  role: string;
};

export function getCarebridgeActor(ctx: any): CarebridgeActor {
  const user = ctx?.req?.user || {};

  return {
    userId: user.sub || user.id || '',
    email: user.email || undefined,
    organizationId: user.organizationId || null,
    role: user.realm_access?.roles?.[0] || user.role || 'user',
  };
}
