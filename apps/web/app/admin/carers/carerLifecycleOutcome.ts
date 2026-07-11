import type { CarerAccessLifecycleItem } from "../../../lib/graphql/queries";

export type LifecycleAction = "revoke" | "reissue" | "retry" | "deactivate";
export type LifecycleNotice = {
  tone: "info" | "attention" | "success";
  message: string;
};

export function getInvitationSavedNotice(
  item: CarerAccessLifecycleItem,
): LifecycleNotice {
  if (item.deliveryStatus === "DELIVERED") {
    return {
      tone: "success",
      message: "The secure Carer invitation was sent.",
    };
  }
  if (item.deliveryStatus === "RETRYABLE") {
    return {
      tone: "attention",
      message:
        "The invitation was saved, but secure delivery needs to be retried.",
    };
  }
  if (
    item.deliveryStatus === "NEEDS_ATTENTION" ||
    item.deliveryStatus === "UNAVAILABLE"
  ) {
    return {
      tone: "attention",
      message:
        "The invitation was saved, but secure delivery needs administrator support.",
    };
  }
  return {
    tone: "info",
    message: "The invitation was saved and secure delivery is in progress.",
  };
}

export function getLifecycleActionNotice(
  action: LifecycleAction,
  item: CarerAccessLifecycleItem,
): LifecycleNotice {
  if (action === "revoke" || action === "deactivate") {
    const subject = action === "revoke" ? "The invitation" : "Carer access";
    if (item.cleanupStatus === "MANUAL_REVIEW") {
      return {
        tone: "attention",
        message: `${subject} is disabled in Oasis, but provider cleanup needs administrator support.`,
      };
    }
    if (item.cleanupStatus === "PENDING") {
      return {
        tone: "attention",
        message: `${subject} is disabled in Oasis and provider cleanup is still in progress.`,
      };
    }
    return {
      tone: "success",
      message:
        action === "revoke"
          ? "The invitation was revoked."
          : "Carer access was deactivated.",
    };
  }

  if (action === "reissue" && item.cleanupStatus !== "COMPLETE") {
    return {
      tone: "attention",
      message:
        item.cleanupStatus === "MANUAL_REVIEW"
          ? "The previous invitation still needs provider cleanup. No replacement was sent."
          : "The previous invitation cleanup is still in progress. No replacement has been sent yet.",
    };
  }

  const prefix =
    action === "reissue" ? "The new invitation" : "Secure delivery";
  if (item.deliveryStatus === "DELIVERED") {
    return {
      tone: "success",
      message:
        action === "reissue"
          ? "A new secure Carer invitation was sent."
          : "Secure invitation delivery completed.",
    };
  }
  if (item.deliveryStatus === "RETRYABLE") {
    return {
      tone: "attention",
      message: `${prefix} still needs a delivery retry.`,
    };
  }
  if (
    item.deliveryStatus === "NEEDS_ATTENTION" ||
    item.deliveryStatus === "UNAVAILABLE"
  ) {
    return {
      tone: "attention",
      message: `${prefix} needs administrator support before delivery can complete.`,
    };
  }
  return {
    tone: "info",
    message: `${prefix} is in progress.`,
  };
}
