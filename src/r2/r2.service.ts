import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

@Injectable()
export class R2Service {
  private readonly client: S3Client;
  readonly bucket: string;
  readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${this.config.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.get('R2_ACCESS_KEY_ID')!,
        secretAccessKey: this.config.get('R2_SECRET_ACCESS_KEY')!,
      },
    });
    this.bucket = this.config.get('R2_BUCKET_NAME')!;
    this.publicUrl = this.config.get('R2_PUBLIC_URL')!;
  }

  /** 删除 R2 对象（fire-and-forget 时请用 .catch(() => {})） */
  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
