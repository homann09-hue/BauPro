/**
 * Unit tests for permissions and access control
 */

import { describe, it, expect } from 'vitest';
import { isAdmin, isChef, isManager, canOperate } from '@/lib/utils';
import { effectivePermissionKeys, hasAppPermission } from '@/lib/permissions';

describe('Permissions: Role Checks', () => {
  it('identifies admin role', () => {
    expect(isAdmin('admin')).toBe(true);
    expect(isAdmin('chef')).toBe(false);
    expect(isAdmin('mitarbeiter')).toBe(false);
  });

  it('identifies chef role', () => {
    expect(isChef('chef')).toBe(true);
    expect(isChef('admin')).toBe(false);
  });

  it('identifies manager roles', () => {
    expect(isManager('admin')).toBe(true);
    expect(isManager('chef')).toBe(true);
    expect(isManager('vorarbeiter')).toBe(false);
    expect(isManager('mitarbeiter')).toBe(false);
  });

  it('identifies operative roles', () => {
    expect(canOperate('admin')).toBe(true);
    expect(canOperate('chef')).toBe(true);
    expect(canOperate('vorarbeiter')).toBe(true);
    expect(canOperate('mitarbeiter')).toBe(true);
    expect(canOperate('kunde')).toBe(false);
  });
});

describe('Permissions: Permission Keys', () => {
  it('returns effective permissions for admin', () => {
    const perms = effectivePermissionKeys('admin', []);
    expect(perms.length).toBeGreaterThan(0);
  });

  it('returns limited permissions for mitarbeiter', () => {
    const perms = effectivePermissionKeys('mitarbeiter', []);
    expect(perms.length).toBeLessThan(effectivePermissionKeys('admin', []).length);
  });

  it('checks app permissions correctly', () => {
    const adminPerms = effectivePermissionKeys('admin', []);
    expect(hasAppPermission('admin', adminPerms, 'read:customers')).toBe(true);
  });

  it('denies unauthorized permissions', () => {
    const mitarbeiterPerms = effectivePermissionKeys('mitarbeiter', []);
    expect(hasAppPermission('mitarbeiter', mitarbeiterPerms, 'manage:pricing')).toBe(false);
  });
});
