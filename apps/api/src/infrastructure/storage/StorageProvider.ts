import * as fs   from 'fs'
import * as path from 'path'
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

function createStorageProvider(): StorageProvider {
  switch (config.STORAGE_PROVIDER) {
    case 'local': return new LocalStorageProvider()
    default:      return new LocalStorageProvider()
  }
}

export const storage = createStorageProvider()
