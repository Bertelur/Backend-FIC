import { ObjectId } from 'mongodb';
import { getUnitCollection } from '../models/Unit.js';
import { Unit } from '../interfaces/unit.types.js';

export async function createUnit(name: string): Promise<Unit> {
  const collection = getUnitCollection();
  const now = new Date();
  const unit: Unit = {
    name,
    createdAt: now,
    updatedAt: now,
  };
  const result = await collection.insertOne(unit);
  return { ...unit, _id: result.insertedId };
}

export async function findAllUnits(): Promise<Unit[]> {
  const collection = getUnitCollection();
  return await collection.find({}).sort({ name: 1 }).toArray();
}

export async function findUnitById(id: string): Promise<Unit | null> {
  const collection = getUnitCollection();
  try {
    return await collection.findOne({ _id: new ObjectId(id) });
  } catch {
    return null;
  }
}

export async function findUnitByName(name: string): Promise<Unit | null> {
  const collection = getUnitCollection();
  return await collection.findOne({ name });
}

export async function deleteUnitById(id: string): Promise<boolean> {
  const collection = getUnitCollection();
  const result = await collection.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}
