import { configValidationSchema } from "./config.module";

const baseConfig = {
  NODE_ENV: "test",
  JWT_SECRET: "jwt-secret-at-least-32-characters-for-test",
  DATABASE_URL: "postgresql://example.invalid/oasis",
  VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID: "test-v1",
  VISIT_COMPLETION_PROOF_ACTIVE_SECRET:
    "visit-completion-proof-test-secret-32-bytes-minimum",
};

describe("API configuration validation", () => {
  it.each([
    ["missing", undefined],
    ["weak", "too-short"],
  ])("rejects %s visit completion proof secret", (_label, secret) => {
    const values = {
      ...baseConfig,
      VISIT_COMPLETION_PROOF_ACTIVE_SECRET: secret,
    };

    expect(configValidationSchema.validate(values).error).toBeDefined();
  });

  it("accepts a complete active and previous proof key ring", () => {
    const result = configValidationSchema.validate({
      ...baseConfig,
      VISIT_COMPLETION_PROOF_PREVIOUS_KEY_ID: "test-v0",
      VISIT_COMPLETION_PROOF_PREVIOUS_SECRET:
        "previous-visit-completion-proof-test-secret-32-bytes",
    });

    expect(result.error).toBeUndefined();
  });

  it("treats empty previous-key variables as unset", () => {
    const result = configValidationSchema.validate({
      ...baseConfig,
      VISIT_COMPLETION_PROOF_PREVIOUS_KEY_ID: "",
      VISIT_COMPLETION_PROOF_PREVIOUS_SECRET: "",
    });

    expect(result.error).toBeUndefined();
  });

  it("rejects a partial or colliding previous proof key", () => {
    const partial = configValidationSchema.validate({
      ...baseConfig,
      VISIT_COMPLETION_PROOF_PREVIOUS_KEY_ID: "test-v0",
    });
    const collision = configValidationSchema.validate({
      ...baseConfig,
      VISIT_COMPLETION_PROOF_PREVIOUS_KEY_ID: "test-v1",
      VISIT_COMPLETION_PROOF_PREVIOUS_SECRET:
        "previous-visit-completion-proof-test-secret-32-bytes",
    });

    expect(partial.error).toBeDefined();
    expect(collision.error).toBeDefined();
  });
});
