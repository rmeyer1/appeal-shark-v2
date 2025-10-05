import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getStorageConfig, type StorageConfig } from "@/lib/storage-config";

let bucketEnsured = false;
const storageConfig: StorageConfig = getStorageConfig();

export function getSupabaseServiceRoleClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("SUPABASE_URL is not set.");
  }

  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function ensureUserDocumentsBucket(client: SupabaseClient): Promise<void> {
  if (bucketEnsured) {
    return;
  }

  const { data: buckets, error } = await client.storage.listBuckets();

  if (error) {
    throw new Error(`Failed to list storage buckets: ${error.message}`);
  }

  const bucketExists = buckets?.some(bucket => bucket.name === storageConfig.bucketName);

  if (!bucketExists) {
    const { error: createError } = await client.storage.createBucket(storageConfig.bucketName, {
      public: false,
      fileSizeLimit: `${storageConfig.maxFileSizeBytes}`,
      allowedMimeTypes: storageConfig.allowedMimeTypes,
    });

    if (createError) {
      throw new Error(`Failed to create storage bucket: ${createError.message}`);
    }
  }

  bucketEnsured = true;
}

export { getStorageConfig };
