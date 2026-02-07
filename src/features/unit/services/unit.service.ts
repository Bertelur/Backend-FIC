import * as unitRepo from '../repositories/unit.repository.js';
import { Unit } from '../interfaces/unit.types.js';

export async function createUnit(name: string): Promise<Unit> {
  const normalized = name.trim();
  if (!normalized) throw new Error('Unit name is required');

  const existing = await unitRepo.findUnitByName(normalized);
  if (existing) throw new Error('Unit already exists');

  return await unitRepo.createUnit(normalized);
}

export async function getAllUnits(): Promise<Unit[]> {
  return await unitRepo.findAllUnits();
}

export async function updateUnit(id: string, name: string): Promise<Unit | null> {
  const normalized = name.trim();
  if (!normalized) throw new Error('Unit name is required');

  const existingByName = await unitRepo.findUnitByName(normalized);
  if (existingByName && String(existingByName._id) !== id) {
    throw new Error('Unit already exists');
  }

  return await unitRepo.updateUnitById(id, normalized);
}

export async function deleteUnit(id: string): Promise<boolean> {
  return await unitRepo.deleteUnitById(id);
}
