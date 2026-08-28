import type { PermissionKey } from "@atria/contracts";
export declare const REQUIRED_PERMISSIONS_KEY = "requiredPermissions";
export declare const RequirePermissions: (...permissions: PermissionKey[]) => import("@nestjs/common").CustomDecorator<string>;
