import { v2 as cloudinary } from 'cloudinary';

let isConfigured = false;

/**
 * Get a configured Cloudinary instance.
 * Configuration is done lazily to ensure env vars are loaded.
 */
export function getCloudinary() {
  if (!isConfigured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    isConfigured = true;
  }
  return cloudinary;
}

export default cloudinary;
