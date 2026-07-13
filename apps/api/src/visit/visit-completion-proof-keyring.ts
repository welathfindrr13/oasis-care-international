import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";

export const VISIT_COMPLETION_PROOF_VERSION = 3;

export type VisitCompletionProofDomain = "request" | "record";

export type VisitCompletionProof = {
  keyId: string;
  fingerprint: string;
};

export type VisitCompletionProofContext = {
  organizationId: string;
  visitId: string;
  expectedCarerId: string;
  authSubject: string;
  identityProvider: string;
  membershipId: string;
  actorRole: string;
  actorSurface: string;
};

export function visitCompletionRequestProofPayload(input: {
  context: VisitCompletionProofContext;
  completionNote: string | null;
}) {
  return {
    version: VISIT_COMPLETION_PROOF_VERSION,
    context: input.context,
    completionNote: input.completionNote,
  };
}

export function visitCompletionRecordProofPayload(input: {
  context: VisitCompletionProofContext;
  notes: string | null;
  actualEnd: string | null;
}) {
  return {
    version: VISIT_COMPLETION_PROOF_VERSION,
    context: input.context,
    notes: input.notes,
    actualEnd: input.actualEnd,
  };
}

type VisitCompletionProofKey = {
  id: string;
  secret: string;
};

@Injectable()
export class VisitCompletionProofKeyring {
  private readonly active: VisitCompletionProofKey;
  private readonly keys: ReadonlyMap<string, VisitCompletionProofKey>;

  constructor(config: ConfigService) {
    const active = this.readRequiredKey(config, "ACTIVE");
    const previous = this.readOptionalPreviousKey(config);
    if (previous?.id === active.id) {
      throw new Error("Visit completion proof key identifiers must be unique");
    }
    if (previous?.secret === active.secret) {
      throw new Error("Visit completion proof keys must use distinct secrets");
    }

    this.active = active;
    this.keys = new Map(
      [active, previous]
        .filter((key): key is VisitCompletionProofKey => Boolean(key))
        .map((key) => [key.id, key]),
    );
  }

  sign(
    domain: VisitCompletionProofDomain,
    payload: unknown,
  ): VisitCompletionProof {
    return {
      keyId: this.active.id,
      fingerprint: this.fingerprint(this.active, domain, payload),
    };
  }

  verify(
    keyId: string,
    domain: VisitCompletionProofDomain,
    payload: unknown,
    expectedFingerprint: string,
  ): boolean {
    const key = this.keys.get(keyId);
    if (!key || !this.isFingerprint(expectedFingerprint)) return false;
    const actualFingerprint = this.fingerprint(key, domain, payload);
    return timingSafeEqual(
      Buffer.from(actualFingerprint, "hex"),
      Buffer.from(expectedFingerprint, "hex"),
    );
  }

  private readRequiredKey(
    config: ConfigService,
    slot: "ACTIVE",
  ): VisitCompletionProofKey {
    const id = this.readKeyId(
      config.get<string>(`VISIT_COMPLETION_PROOF_${slot}_KEY_ID`),
      slot,
    );
    const secret = this.readSecret(
      config.get<string>(`VISIT_COMPLETION_PROOF_${slot}_SECRET`),
      slot,
    );
    return { id, secret };
  }

  private readOptionalPreviousKey(
    config: ConfigService,
  ): VisitCompletionProofKey | null {
    const rawId = config.get<string>("VISIT_COMPLETION_PROOF_PREVIOUS_KEY_ID");
    const rawSecret = config.get<string>(
      "VISIT_COMPLETION_PROOF_PREVIOUS_SECRET",
    );
    const hasId = Boolean(rawId?.trim());
    const hasSecret = Boolean(rawSecret?.trim());
    if (!hasId && !hasSecret) return null;
    if (!hasId || !hasSecret) {
      throw new Error(
        "Visit completion previous proof key id and secret must be configured together",
      );
    }
    return {
      id: this.readKeyId(rawId, "PREVIOUS"),
      secret: this.readSecret(rawSecret, "PREVIOUS"),
    };
  }

  private readKeyId(value: string | undefined, slot: string): string {
    const normalized = String(value || "").trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(normalized)) {
      throw new Error(
        `Visit completion ${slot.toLowerCase()} proof key id is invalid`,
      );
    }
    return normalized;
  }

  private readSecret(value: string | undefined, slot: string): string {
    const normalized = String(value || "").trim();
    if (Buffer.byteLength(normalized, "utf8") < 32) {
      throw new Error(
        `Visit completion ${slot.toLowerCase()} proof secret must be at least 32 bytes`,
      );
    }
    return normalized;
  }

  private fingerprint(
    key: VisitCompletionProofKey,
    domain: VisitCompletionProofDomain,
    payload: unknown,
  ): string {
    return createHmac("sha256", key.secret)
      .update(
        `oasis:visit-completion-proof:v${VISIT_COMPLETION_PROOF_VERSION}:${domain}\0`,
        "utf8",
      )
      .update(JSON.stringify(payload), "utf8")
      .digest("hex");
  }

  private isFingerprint(value: string): boolean {
    return /^[a-f0-9]{64}$/.test(value);
  }
}
