import { Request, Response } from 'express';
import * as productService from '../services/product.service.js';
import type { CreateProductRequest, ListProductsQuery, UpdateProductRequest } from '../interfaces/product.types.js';
import { uploadImage } from '../../../utils/cloudinary.js';

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export async function createProduct(req: Request, res: Response): Promise<void> {
  try {
    const body: any = req.body ?? {};

    // Handle file upload to Cloudinary
    const file = (req as any).file as
      | { buffer: Buffer; originalname: string; mimetype: string; size: number }
      | undefined;

    let uploadedFile: {
      url: string;
      originalName: string;
      mimeType: string;
      size: number;
      cloudinaryPublicId?: string;
    } | undefined;

    if (file) {
      try {
        const cloudinaryResult = await uploadImage(file.buffer, { folder: 'products' });
        uploadedFile = {
          url: cloudinaryResult.secureUrl,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          cloudinaryPublicId: cloudinaryResult.publicId,
        };
      } catch (uploadError) {
        console.error('Cloudinary upload failed:', uploadError);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to upload image',
        });
        return;
      }
    }

    const payload: CreateProductRequest = {
      name: typeof body.name === 'string' ? body.name : '',
      description: typeof body.description === 'string' ? body.description : undefined,
      sku: typeof body.sku === 'string' ? body.sku : '',
      category: typeof body.category === 'string' ? body.category : undefined,
      price: parseNumber(body.price) ?? NaN,
      stock: parseNumber(body.stock) ?? NaN,
      status: typeof body.status === 'string' ? (body.status as any) : undefined,
      imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : undefined,
      unitId: typeof body.unitId === 'string' ? body.unitId : '',
      isFreeShipping: body.isFreeShipping === 'true' || body.isFreeShipping === true,
    };

    const created = await productService.createProduct(payload, uploadedFile);

    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create product';

    if (error instanceof productService.DuplicateSkuError) {
      res.status(409).json({ error: 'Conflict', message });
      return;
    }

    const status =
      message === 'name is required' ||
        message === 'sku is required' ||
        message.startsWith('price is required') ||
        message.startsWith('stock is required') ||
        message.startsWith('Invalid imageUrl') ||
        message.startsWith('Invalid status')
        ? 400
        : 500;

    res.status(status).json({
      error: status === 400 ? 'Bad Request' : 'Internal Server Error',
      message,
    });
  }
}

export async function getProducts(req: Request, res: Response): Promise<void> {
  try {
    const q = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
    const category = Array.isArray(req.query.category) ? req.query.category[0] : req.query.category;
    const status = Array.isArray(req.query.status) ? req.query.status[0] : req.query.status;

    const limit = parseNumber(Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit);
    const skip = parseNumber(Array.isArray(req.query.skip) ? req.query.skip[0] : req.query.skip);

    const result = await productService.listProducts({
      q: typeof q === 'string' ? q : undefined,
      category: typeof category === 'string' ? category : undefined,
      status: typeof status === 'string' ? (status as any) : undefined,
      limit,
      skip,
    } satisfies ListProductsQuery);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to fetch products',
    });
  }
}

export async function getProductDetails(req: Request, res: Response): Promise<void> {
  try {
    const idRaw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = typeof idRaw === 'string' ? idRaw.trim() : String(idRaw ?? '').trim();
    if (!id) {
      res.status(400).json({ error: 'Bad Request', message: 'Product id is required' });
      return;
    }

    const product = await productService.getProductDetails(id);
    if (!product) {
      res.status(404).json({ error: 'Not Found', message: 'Product not found' });
      return;
    }

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to get product',
    });
  }
}

export async function editProduct(req: Request, res: Response): Promise<void> {
  try {
    const idRaw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = typeof idRaw === 'string' ? idRaw.trim() : String(idRaw ?? '').trim();
    if (!id) {
      res.status(400).json({ error: 'Bad Request', message: 'Product id is required' });
      return;
    }

    const body: any = req.body ?? {};

    const update: UpdateProductRequest = {
      name: typeof body.name === 'string' ? body.name : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      sku: typeof body.sku === 'string' ? body.sku : undefined,
      category: typeof body.category === 'string' ? body.category : undefined,
      price: parseNumber(body.price),
      stock: parseNumber(body.stock),
      status: typeof body.status === 'string' ? (body.status as any) : undefined,
      imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : undefined,
      unitId: typeof body.unitId === 'string' ? body.unitId : undefined,
      isFreeShipping: body.isFreeShipping !== undefined ? (body.isFreeShipping === 'true' || body.isFreeShipping === true) : undefined,
    };

    // Handle file upload to Cloudinary
    const file = (req as any).file as
      | { buffer: Buffer; originalname: string; mimetype: string; size: number }
      | undefined;

    let uploadedFile: {
      url: string;
      originalName: string;
      mimeType: string;
      size: number;
      cloudinaryPublicId?: string;
    } | undefined;

    if (file) {
      try {
        const cloudinaryResult = await uploadImage(file.buffer, { folder: 'products' });
        uploadedFile = {
          url: cloudinaryResult.secureUrl,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          cloudinaryPublicId: cloudinaryResult.publicId,
        };
      } catch (uploadError) {
        console.error('Cloudinary upload failed:', uploadError);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to upload image',
        });
        return;
      }
    }

    const updated = await productService.editProduct(id, update, uploadedFile);
    if (!updated) {
      res.status(404).json({ error: 'Not Found', message: 'Product not found' });
      return;
    }

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update product';
    const status =
      message.startsWith('Invalid imageUrl') || message.startsWith('Invalid status')
        ? 400
        : 500;

    res.status(status).json({
      error: status === 400 ? 'Bad Request' : 'Internal Server Error',
      message,
    });
  }
}

export async function deleteProduct(req: Request, res: Response): Promise<void> {
  try {
    const idRaw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = typeof idRaw === 'string' ? idRaw.trim() : String(idRaw ?? '').trim();
    if (!id) {
      res.status(400).json({ error: 'Bad Request', message: 'Product id is required' });
      return;
    }

    const result = await productService.deleteProduct(id);

    if (result === null) {
      res.status(400).json({ error: 'Bad Request', message: 'Invalid product id' });
      return;
    }

    if (!result) {
      res.status(404).json({ error: 'Not Found', message: 'Product not found' });
      return;
    }

    res.status(200).json({ success: true, message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to delete product',
    });
  }
}
