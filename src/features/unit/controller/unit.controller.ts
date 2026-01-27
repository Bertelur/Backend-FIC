import { Request, Response } from 'express';
import * as unitService from '../services/unit.service.js';

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

export async function deleteUnit(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
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
