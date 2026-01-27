import { ObjectId } from 'mongodb';

export interface Unit {
  _id?: ObjectId | string;
  name: string; // e.g. "ikat", "karton"
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductUnitResponse {
  id: string;
  name: string;
}

export interface CreateUnitRequest {
  name: string;
}
