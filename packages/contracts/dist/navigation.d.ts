import type { PermissionKey } from "./permissions";
export type NavigationItem = {
    key: string;
    label: string;
    href: string;
    permission?: PermissionKey;
};
export declare const primaryNavigation: NavigationItem[];
