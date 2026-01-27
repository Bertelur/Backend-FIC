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

export async function deleteUnit(id: string): Promise<boolean> {
  return await unitRepo.deleteUnitById(id);
}
