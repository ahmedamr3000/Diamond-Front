export interface User {
  username: string;
  role: string;
  displayName: string;
  roleLabel: string;
}

export interface RoleMeta {
  role: string;
  roleLabel: string;
}

export const ROLES_META: RoleMeta[] = [
  { role: 'admin', roleLabel: 'مدير النظام' },
  { role: 'cutter', roleLabel: 'مرحلة التقطيع' },
  { role: 'securit', roleLabel: 'مرحلة السيكوريت' },
  { role: 'double', roleLabel: 'مرحلة الدبل' },
  { role: 'delivery', roleLabel: 'مرحلة التسليم' },
  { role: 'viewer', roleLabel: 'مشاهد فقط' },
  // Backward compatibility
  { role: 'welder', roleLabel: 'مرحلة السيكوريت' },
  { role: 'finisher', roleLabel: 'مرحلة الدبل' },
];

export interface UserAccount extends User {
  password: string;
  icon: string;
}

export const DEFAULT_USERS: UserAccount[] = [
  { username: 'admin', password: 'admin123', role: 'admin', displayName: 'المدير', roleLabel: 'مدير النظام', icon: '👑' },
  { username: 'cutter', password: 'cutter123', role: 'cutter', displayName: 'تقطيع', roleLabel: 'مرحلة التقطيع', icon: '✂️' },
  { username: 'securit', password: 'securit123', role: 'securit', displayName: 'سيكوريت', roleLabel: 'مرحلة السيكوريت', icon: '🛡️' },
  { username: 'double', password: 'double123', role: 'double', displayName: 'دبل', roleLabel: 'مرحلة الدبل', icon: '🪟' },
  { username: 'delivery', password: 'delivery123', role: 'delivery', displayName: 'تسليم', roleLabel: 'مرحلة التسليم', icon: '🚚' },
  { username: 'viewer', password: 'viewer123', role: 'viewer', displayName: 'المشاهد', roleLabel: 'مشاهد فقط', icon: '👁️' },
];

