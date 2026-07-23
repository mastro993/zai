export const recurringFailureCauseLabel = (causeCategory: string): string => {
  switch (causeCategory) {
    case "template":
      return "Template problem";
    case "reference":
      return "Missing reference";
    case "validation":
      return "Validation problem";
    default:
      return "Generation problem";
  }
};

export const recurringFailureResolutionLabel = (
  resolutionKind: string | null | undefined,
): string => {
  switch (resolutionKind) {
    case "fulfilled":
      return "Recovered";
    case "repaired":
      return "Repaired";
    default:
      return "Resolved";
  }
};
