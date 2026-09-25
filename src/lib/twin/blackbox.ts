import type { BlackBoxEntry } from "./types";

export const GENESIS_HASH = "0".repeat(64);

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** SHA-256 over seq + timestamp + kind + payload + previous hash. */
export async function hashEntry(
  entry: Omit<BlackBoxEntry, "hash">,
  overridePayload?: Record<string, unknown>,
): Promise<string> {
  const body = JSON.stringify({
    seq: entry.seq,
    loggedAt: entry.loggedAt,
    kind: entry.kind,
    payload: overridePayload ?? entry.payload,
    prevHash: entry.prevHash,
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(body),
  );
  return toHex(digest);
}

export async function appendEntry(
  chain: BlackBoxEntry[],
  kind: string,
  payload: Record<string, unknown>,
): Promise<BlackBoxEntry> {
  const prev = chain[chain.length - 1];
  const base = {
    seq: (prev?.seq ?? 0) + 1,
    loggedAt: Date.now(),
    kind,
    payload,
    prevHash: prev?.hash ?? GENESIS_HASH,
  };
  return { ...base, hash: await hashEntry(base) };
}

export interface VerifyResult {
  ok: boolean;
  brokenAt: number | null;
  checked: number;
}

export async function verifyChain(
  chain: BlackBoxEntry[],
): Promise<VerifyResult> {
  let expectedPrev = GENESIS_HASH;
  for (const entry of chain) {
    const recomputed = await hashEntry(entry);
    if (entry.prevHash !== expectedPrev || recomputed !== entry.hash) {
      return { ok: false, brokenAt: entry.seq, checked: chain.length };
    }
    expectedPrev = entry.hash;
  }
  return { ok: true, brokenAt: null, checked: chain.length };
}
