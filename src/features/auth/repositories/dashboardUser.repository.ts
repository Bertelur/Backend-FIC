import { ObjectId } from 'mongodb';
import { getDashboardUserCollection, createDashboardUserIndexes } from '../models/DashboardUser.js';
import { DashboardUser } from '../interfaces/auth.types.js';

function toIdFilter(id: string): { _id: ObjectId } | { _id: string } {
  if (ObjectId.isValid(id)) return { _id: new ObjectId(id) };
  return { _id: id };
}

export async function initializeDashboardUserIndexes(): Promise<void> {
  await createDashboardUserIndexes();
}

export async function createDashboardUser(user: Omit<DashboardUser, '_id' | 'createdAt' | 'updatedAt'>): Promise<DashboardUser> {
  const collection = getDashboardUserCollection();
  const now = new Date();
  const newUser: Omit<DashboardUser, '_id'> = {
    ...user,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(newUser as DashboardUser);
  return { ...newUser, _id: result.insertedId.toString() };
}

export async function findDashboardUserByUsername(username: string): Promise<DashboardUser | null> {
  const collection = getDashboardUserCollection();
  return await collection.findOne(
    { username },
    {
      projection: {
        _id: 1,
        username: 1,
        password: 1,
        role: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  );
}

export async function findDashboardUserById(id: string): Promise<DashboardUser | null> {
  const collection = getDashboardUserCollection();
  return await collection.findOne(toIdFilter(id) as any);
}

export async function updateDashboardUserRole(id: string, role: DashboardUser['role']): Promise<DashboardUser | null> {
  const collection = getDashboardUserCollection();
  const now = new Date();
  const result = await collection.findOneAndUpdate(
    toIdFilter(id) as any,
    { $set: { role, updatedAt: now } },
    { returnDocument: 'after' },
  );
  return result;
}

export async function deleteDashboardUserById(id: string): Promise<boolean> {
  const collection = getDashboardUserCollection();
  const result = await collection.deleteOne(toIdFilter(id) as any);
  return result.deletedCount === 1;
}

export async function findAllDashboardUsers(): Promise<DashboardUser[]> {
  const collection = getDashboardUserCollection();
  return await collection.find({}).toArray();
}

export async function countDashboardUsers(): Promise<number> {
  const collection = getDashboardUserCollection();
  return await collection.countDocuments();
}
