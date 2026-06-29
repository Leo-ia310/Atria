export const permissions = {
  dashboard: ["dashboard:view"],
  onboarding: ["onboarding:manage"],
  pos: ["pos:view", "pos:sell", "pos:return", "pos:discount"],
  sales: ["sales:view", "sales:create", "sales:refund", "sales:export"],
  inventory: [
    "inventory:view",
    "inventory:manage",
    "inventory:transfer",
    "inventory:audit",
  ],
  accounting: [
    "accounting:view",
    "accounting:manage",
    "accounting:close-period",
  ],
  employees: ["employees:view", "employees:manage", "employees:assign-role"],
  reports: ["reports:view", "reports:export"],
  settings: ["settings:view", "settings:manage", "settings:security"],
  billing: ["billing:view", "billing:manage"],
  branches: ["branches:view", "branches:manage"],
} as const;

export type PermissionGroup = keyof typeof permissions;
export type PermissionKey = (typeof permissions)[PermissionGroup][number];

export const roleTemplates = {
  owner: Object.values(permissions).flat(),
  admin: [
    "dashboard:view",
    "onboarding:manage",
    "pos:view",
    "pos:sell",
    "pos:return",
    "sales:view",
    "sales:create",
    "sales:refund",
    "inventory:view",
    "inventory:manage",
    "inventory:transfer",
    "accounting:view",
    "accounting:manage",
    "employees:view",
    "employees:manage",
    "reports:view",
    "reports:export",
    "settings:view",
    "settings:manage",
    "billing:view",
    "branches:view",
    "branches:manage",
  ] satisfies PermissionKey[],
  worker: [
    "dashboard:view",
    "pos:view",
    "pos:sell",
    "sales:view",
    "inventory:view",
    "reports:view",
    "branches:view",
  ] satisfies PermissionKey[],
  accountant: [
    "dashboard:view",
    "sales:view",
    "inventory:view",
    "accounting:view",
    "accounting:manage",
    "reports:view",
    "reports:export",
  ] satisfies PermissionKey[],
} as const;

export type RoleKey = keyof typeof roleTemplates;
