import type { JwtUser } from "../auth/auth.types";
import { UploadFileDto } from './dto/upload.dto';
import { UploadsService } from './uploads.service';
export declare class UploadsController {
    private readonly uploadsService;
    constructor(uploadsService: UploadsService);
    upload(user: JwtUser, dto: UploadFileDto, file: Express.Multer.File): Promise<{
        id: string;
        createdAt: Date;
        organizationId: string;
        status: import("@prisma/client").$Enums.FileStatus;
        module: string;
        uploadedById: string | null;
        originalName: string;
        mimeType: string;
        sizeBytes: number;
        storageKey: string;
        checksum: string | null;
    }>;
}
