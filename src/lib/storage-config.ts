export type StorageConfig = {
  bucketName: string;
  allowedMimeTypes: string[];
  maxFileSizeBytes: number;
};

const storageConfig: StorageConfig = {
  bucketName: "user-documents",
  allowedMimeTypes: ["application/pdf"],
  maxFileSizeBytes: 25 * 1024 * 1024,
};

export function getStorageConfig(): StorageConfig {
  return storageConfig;
}

export function getMaxFileSizeInMb(): number {
  return Math.round(storageConfig.maxFileSizeBytes / (1024 * 1024));
}
