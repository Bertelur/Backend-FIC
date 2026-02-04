import multer from 'multer';

// Use memory storage so file buffer is available for Cloudinary upload
const storage = multer.memoryStorage();

function fileFilter(_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.mimetype)) {
    cb(new Error('Only image files are allowed (jpeg/png/webp/gif)'));
    return;
  }
  cb(null, true);
}

export const uploadProductImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});
