import { getDashboardUserCollection, createDashboardUserIndexes } from '../models/DashboardUser.js';
import { DashboardUser } from '../interfaces/auth.types.js';

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
  return await collection.findOne({ _id: id });
}

export async function findAllDashboardUsers(): Promise<DashboardUser[]> {
  const collection = getDashboardUserCollection();
  return await collection.find({}).toArray();
}

export async function countDashboardUsers(): Promise<number> {
  const collection = getDashboardUserCollection();
  return await collection.countDocuments();
}
