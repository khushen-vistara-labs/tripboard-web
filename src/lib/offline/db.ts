import Dexie, { type EntityTable } from "dexie";

export type MutationStatus = "PENDING" | "SYNCING" | "CONFLICT" | "FAILED";

export interface OfflineMutation {
  id: string;
  tripId: string;
  entity: "itinerary" | "checklist" | "financial";
  command: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: string;
  attempts: number;
  status: MutationStatus;
  lastError?: string;
}

export interface CachedTripRecord {
  key: string;
  tripId: string;
  kind: string;
  value: unknown;
  updatedAt: string;
}

class TripBoardDatabase extends Dexie {
  mutations!: EntityTable<OfflineMutation, "id">;
  cache!: EntityTable<CachedTripRecord, "key">;

  constructor() {
    super("tripboard");
    this.version(1).stores({
      mutations: "id, tripId, status, createdAt, idempotencyKey",
      cache: "key, tripId, kind, updatedAt",
    });
  }
}

export const offlineDb = new TripBoardDatabase();
