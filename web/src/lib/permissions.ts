type RoleUser = {
  role?: string | null;
} | null | undefined;

export type DashboardPermissions = {
  canManageContent: boolean;
  canDeleteContent: boolean;
  canReviewContent: boolean;
  canManageDevices: boolean;
  canDeleteDevices: boolean;
  canUseFleetCommands: boolean;
  canUseEmergencyOverride: boolean;
  canManagePlaylists: boolean;
  canDeletePlaylists: boolean;
  canRemovePlaylistItems: boolean;
};

const isAdmin = (role?: string | null) => role === 'admin';
const isManager = (role?: string | null) => role === 'manager';
const isAdminOrManager = (role?: string | null) => isAdmin(role) || isManager(role);

export function getDashboardPermissions(user: RoleUser): DashboardPermissions {
  const role = user?.role;
  const admin = isAdmin(role);
  const adminOrManager = isAdminOrManager(role);

  return {
    canManageContent: adminOrManager,
    canDeleteContent: admin,
    canReviewContent: adminOrManager,
    canManageDevices: adminOrManager,
    canDeleteDevices: admin,
    canUseFleetCommands: adminOrManager,
    canUseEmergencyOverride: admin,
    canManagePlaylists: adminOrManager,
    canDeletePlaylists: admin,
    canRemovePlaylistItems: admin,
  };
}
