import { offlineDb, type OfflineMutation } from "./db";

export async function enqueueMutation(input: Omit<OfflineMutation, "id" | "idempotencyKey" | "createdAt" | "attempts" | "status">) {
  const operationId = crypto.randomUUID();
  const mutation: OfflineMutation = {
    ...input,
    id: operationId,
    idempotencyKey: operationId,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: "PENDING",
  };
  await offlineDb.mutations.add(mutation);
  return mutation;
}

export async function replayQueue(send: (mutation: OfflineMutation) => Promise<void>) {
  const pending = await offlineDb.mutations.where("status").anyOf(["PENDING", "FAILED"]).sortBy("createdAt");
  for (const mutation of pending) {
    await offlineDb.mutations.update(mutation.id, { status: "SYNCING", attempts: mutation.attempts + 1 });
    try {
      await send(mutation);
      await offlineDb.mutations.delete(mutation.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown sync error";
      const conflict = /balance|version|conflict/i.test(message);
      await offlineDb.mutations.update(mutation.id, { status: conflict ? "CONFLICT" : "FAILED", lastError: message });
    }
  }
}
