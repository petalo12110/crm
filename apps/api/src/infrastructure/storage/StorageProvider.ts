import * as fs   from 'fs'
import * as path from 'path'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  NotFound,
} from '@aws-sdk/client-s3'
import { config } from '../../config/env'
import { log }    from '../../config/logger'

export interface StorageProvider {
  upload(key: string, buffer: Buffer, metadata: { mimeType: string; originalName: string }): Promise<void>
  download(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
}

export class LocalStorageProvider implements StorageProvider {
  private readonly basePath: string

  constructor() {
    this.basePath = path.resolve(config.STORAGE_LOCAL_PATH)
    fs.mkdirSync(this.basePath, { recursive: true })
  }

  private resolvePath(key: string): string {
    const safe = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, '')
    return path.join(this.basePath, safe)
  }

  async upload(key: string, buffer: Buffer): Promise<void> {
    const filePath = this.resolvePath(key)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    await fs.promises.writeFile(filePath, buffer)
    log.debug('File uploaded to local storage', { key })
  }

  async download(key: string): Promise<Buffer> {
    return fs.promises.readFile(this.resolvePath(key))
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.promises.unlink(this.resolvePath(key))
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.promises.access(this.resolvePath(key))
      return true
    } catch {
      return false
    }
  }
}

export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client
  private readonly bucket: string

  constructor() {
    // env.ts's superRefine guarantees these are set when
    // STORAGE_PROVIDER=s3, so the non-null assertions here are safe.
    this.bucket = config.S3_BUCKET!
    this.client = new S3Client({
      region: config.S3_REGION!,
      credentials: {
        accessKeyId:     config.S3_ACCESS_KEY!,
        secretAccessKey: config.S3_SECRET_KEY!,
      },
      // Only set for S3-compatible providers (R2, B2, MinIO); leaving
      // these undefined for real AWS S3 lets the SDK use its defaults.
      ...(config.S3_ENDPOINT ? { endpoint: config.S3_ENDPOINT } : {}),
      forcePathStyle: config.S3_FORCE_PATH_STYLE,
    })
  }

  async upload(key: string, buffer: Buffer, metadata: { mimeType: string; originalName: string }): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket:      this.bucket,
      Key:         key,
      Body:        buffer,
      ContentType: metadata.mimeType,
      Metadata:    { originalName: encodeURIComponent(metadata.originalName) },
    }))
    log.debug('File uploaded to S3', { key })
  }

  async download(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
    const chunks: Buffer[] = []
    for await (const chunk of result.Body as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      return true
    } catch (err) {
      if (err instanceof NotFound) return false
      // HeadObject on a missing key can also surface as a generic 404
      // rather than the typed NotFound error, depending on the provider.
      if ((err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode === 404) return false
      throw err
    }
  }
}

function createStorageProvider(): StorageProvider {
  switch (config.STORAGE_PROVIDER) {
    case 's3':    return new S3StorageProvider()
    case 'local': return new LocalStorageProvider()
    default:      return new LocalStorageProvider()
  }
}

export const storage = createStorageProvider()
