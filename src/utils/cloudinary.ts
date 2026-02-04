import { getCloudinary } from '../config/cloudinary.js';

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
}

/**
 * Upload an image buffer to Cloudinary
 */
export async function uploadImage(
  buffer: Buffer,
  options?: {
    folder?: string;
    publicId?: string;
    transformation?: object;
  },
): Promise<CloudinaryUploadResult> {
  const cloudinary = getCloudinary();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options?.folder ?? 'products',
        public_id: options?.publicId,
        resource_type: 'image',
        transformation: options?.transformation ?? [
          { quality: 'auto', fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        if (!result) {
          reject(new Error('No result from Cloudinary upload'));
          return;
        }
        resolve({
          url: result.url,
          secureUrl: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      },
    );

    uploadStream.end(buffer);
  });
}

/**
 * Delete an image from Cloudinary by public ID
 */
export async function deleteImage(publicId: string): Promise<boolean> {
  const cloudinary = getCloudinary();
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    return false;
  }
}

/**
 * Get optimized URL for an image
 */
export function getOptimizedUrl(
  publicId: string,
  options?: {
    width?: number;
    height?: number;
    crop?: string;
  },
): string {
  const cloudinary = getCloudinary();
  return cloudinary.url(publicId, {
    secure: true,
    quality: 'auto',
    fetch_format: 'auto',
    width: options?.width,
    height: options?.height,
    crop: options?.crop ?? 'limit',
  });
}
