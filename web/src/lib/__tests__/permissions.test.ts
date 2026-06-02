import { getDashboardPermissions } from '../permissions';

describe('getDashboardPermissions', () => {
  it('allows admins to use all dashboard mutations covered by the helper', () => {
    expect(getDashboardPermissions({ role: 'admin' })).toEqual({
      canManageContent: true,
      canDeleteContent: true,
      canReviewContent: true,
      canManageDevices: true,
      canDeleteDevices: true,
      canUseFleetCommands: true,
      canUseEmergencyOverride: true,
      canManagePlaylists: true,
      canDeletePlaylists: true,
      canRemovePlaylistItems: true,
      canManageSchedules: true,
      canDeleteSchedules: true,
    });
  });

  it('allows managers to manage but not delete admin-only records', () => {
    expect(getDashboardPermissions({ role: 'manager' })).toMatchObject({
      canManageContent: true,
      canDeleteContent: false,
      canReviewContent: true,
      canManageDevices: true,
      canDeleteDevices: false,
      canUseFleetCommands: true,
      canUseEmergencyOverride: false,
      canManagePlaylists: true,
      canDeletePlaylists: false,
      canRemovePlaylistItems: false,
      canManageSchedules: true,
      canDeleteSchedules: false,
    });
  });

  it('keeps viewers and missing users read-only for these dashboard pages', () => {
    expect(getDashboardPermissions({ role: 'viewer' })).toMatchObject({
      canManageContent: false,
      canDeleteContent: false,
      canManageDevices: false,
      canDeleteDevices: false,
      canManagePlaylists: false,
      canDeletePlaylists: false,
      canManageSchedules: false,
      canDeleteSchedules: false,
    });

    expect(getDashboardPermissions(null)).toMatchObject({
      canManageContent: false,
      canManageDevices: false,
      canManagePlaylists: false,
      canManageSchedules: false,
    });
  });
});
