export declare const permissions: {
    readonly dashboard: readonly ["dashboard:view"];
    readonly onboarding: readonly ["onboarding:manage"];
    readonly pos: readonly ["pos:view", "pos:sell", "pos:return", "pos:discount"];
    readonly sales: readonly ["sales:view", "sales:create", "sales:refund", "sales:export"];
    readonly inventory: readonly ["inventory:view", "inventory:manage", "inventory:transfer", "inventory:audit"];
    readonly accounting: readonly ["accounting:view", "accounting:manage", "accounting:close-period"];
    readonly employees: readonly ["employees:view", "employees:manage", "employees:assign-role"];
    readonly reports: readonly ["reports:view", "reports:export"];
    readonly settings: readonly ["settings:view", "settings:manage", "settings:security"];
    readonly billing: readonly ["billing:view", "billing:manage"];
    readonly branches: readonly ["branches:view", "branches:manage"];
};
export type PermissionGroup = keyof typeof permissions;
export type PermissionKey = (typeof permissions)[PermissionGroup][number];
export declare const roleTemplates: {
    readonly owner: ("dashboard:view" | "onboarding:manage" | "pos:view" | "pos:sell" | "pos:return" | "pos:discount" | "sales:view" | "sales:create" | "sales:refund" | "sales:export" | "inventory:view" | "inventory:manage" | "inventory:transfer" | "inventory:audit" | "accounting:view" | "accounting:manage" | "accounting:close-period" | "employees:view" | "employees:manage" | "employees:assign-role" | "reports:view" | "reports:export" | "settings:view" | "settings:manage" | "settings:security" | "billing:view" | "billing:manage" | "branches:view" | "branches:manage")[];
    readonly admin: ("dashboard:view" | "onboarding:manage" | "pos:view" | "pos:sell" | "pos:return" | "sales:view" | "sales:create" | "sales:refund" | "inventory:view" | "inventory:manage" | "inventory:transfer" | "accounting:view" | "accounting:manage" | "employees:view" | "employees:manage" | "reports:view" | "reports:export" | "settings:view" | "settings:manage" | "billing:view" | "branches:view" | "branches:manage")[];
    readonly worker: ("dashboard:view" | "pos:view" | "pos:sell" | "sales:view" | "inventory:view" | "reports:view" | "branches:view")[];
    readonly accountant: ("dashboard:view" | "sales:view" | "inventory:view" | "accounting:view" | "accounting:manage" | "reports:view" | "reports:export")[];
};
export type RoleKey = keyof typeof roleTemplates;
