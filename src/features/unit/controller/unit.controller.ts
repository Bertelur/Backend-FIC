import { Request, Response } from 'express';
import * as unitService from '../services/unit.service.js';
import * as productRepo from '../../product/repositories/product.repository.js';

export async function createUnit(req: Request, res: Response): Promise<void> {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Bad Request', message: 'Name is required' });
      return;
    }

    const unit = await unitService.createUnit(String(name));
    res.status(201).json({ success: true, data: unit });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create unit';
    if (message === 'Unit already exists') {
      res.status(409).json({ error: 'Conflict', message });
    } else {
      res.status(400).json({ error: 'Bad Request', message });
    }
  }
}

export async function getUnits(_req: Request, res: Response): Promise<void> {
  try {
    const units = await unitService.getAllUnits();
    res.status(200).json({ success: true, data: units });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to fetch units',
    });
  }
}

export async function updateUnit(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const { name } = req.body as { name?: string };
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: 'Name is required' });
      return;
    }
    const updated = await unitService.updateUnit(id, name);
    if (!updated) {
      res.status(404).json({ error: 'Not Found', message: 'Unit not found' });
      return;
    }
    res.status(200).json({
      success: true,
      data: { _id: updated._id, name: updated.name, createdAt: updated.createdAt, updatedAt: updated.updatedAt },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update unit';
    if (message === 'Unit already exists') {
      res.status(409).json({ error: 'Conflict', message });
      return;
    }
    res.status(400).json({ error: 'Bad Request', message });
  }
}

export async function deleteUnit(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const count = await productRepo.countProducts({ unitId: id });
    if (count > 0) {
      const products = await productRepo.findProducts({ unitId: id, limit: 50 });
      res.status(409).json({
        error: 'Conflict',
        message: 'Unit is in use by products',
        products: products.map((p) => ({ id: String(p._id), name: p.name })),
      });
      return;
    }
    const deleted = await unitService.deleteUnit(id);
    if (!deleted) {
      res.status(404).json({ error: 'Not Found', message: 'Unit not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Unit deleted' });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to delete unit',
    });
  }
}
