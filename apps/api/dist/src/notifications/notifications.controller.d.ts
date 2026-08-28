import type { JwtUser } from "../auth/auth.types";
import { NotificationsService } from './notifications.service';
export declare class NotificationsController {
    private readonly notificationsService;
    constructor(notificationsService: NotificationsService);
    list(user: JwtUser): Promise<{
        total: number;
        items: import("./notifications.service").NotificationItem[];
    }>;
}
