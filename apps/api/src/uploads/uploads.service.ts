import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import type { Express } from 'express';
import type { JwtUser } from '@/auth/auth.types';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';

const allowedMimeTypes = new Set([
  'image/png',
  'image/jpeg',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Optional() @InjectQueue('uploads') private readonly uploadsQueue?: Queue,
  ) {}

  async upload(user: JwtUser, module: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Debes adjuntar un archivo.');
    }

    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException('Tipo de archivo no permitido.');
    }

    const maxBytes =
      this.configService.get<number>('UPLOAD_MAX_BYTES') ?? 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException('El archivo excede el tamaño permitido.');
    }

    const uploadDir = join(process.cwd(), 'uploads', 'pending');
    await mkdir(uploadDir, { recursive: true });

    const storageKey = join(
      uploadDir,
      `${randomUUID()}${extname(file.originalname)}`,
    );
    await writeFile(storageKey, file.buffer);

    const asset = await this.prisma.fileAsset.create({
      data: {
        organizationId: user.organizationId,
        uploadedById: user.sub,
        module,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageKey,
      },
    });

    if (this.uploadsQueue) {
      await this.uploadsQueue.add('scan', {
        fileAssetId: asset.id,
      });
    } else {
      this.logger.warn(
        `Archivo ${asset.id} no encolado para escaneo: BullMQ inactivo.`,
      );
    }

    return asset;
  }
}
