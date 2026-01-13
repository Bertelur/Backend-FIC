import {
  getDashboardUserCollection,
  createDashboardUserIndexes,
} from "../models/DashboardUser";
import { DashboardUser } from "../interfaces/auth.types";

export async function initializeDashboardUserIndexes(): Promise<void> {
  await createDashboardUserIndexes();
}

export async function createDashboardUser(
  user: Omit<DashboardUser, "_id" | "createdAt" | "updatedAt">
): Promise<DashboardUser> {
  const collection = getDashboardUserCollection();
  const now = new Date();
  const newUser: Omit<DashboardUser, "_id"> = {
    ...user,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(newUser as DashboardUser);
  return { ...newUser, _id: result.insertedId.toString() };
}

export async function findDashboardUserByUsername(
  username: string
): Promise<DashboardUser | null> {
  const collection = getDashboardUserCollection();
  return await collection.findOne({ username });
}

export async function findDashboardUserById(
  id: string
): Promise<DashboardUser | null> {
  const collection = getDashboardUserCollection();
  return await collection.findOne({ _id: id });
}
