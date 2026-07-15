export const severityRank = (severity) => {
  switch (severity?.toUpperCase()) {
    case "CRITICAL":
      return 4;
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    case "LOW":
      return 1;
    default:
      return 0;
  }
};

export const vulnerabilitySeverity = (vulnerability) => {
  const fromDatabase = vulnerability.database_specific?.severity;
  if (typeof fromDatabase === "string" && fromDatabase.length > 0) {
    return fromDatabase.toUpperCase();
  }

  return "UNKNOWN";
};

export const collectFindings = (report) => {
  const findings = [];
  for (const result of report.results ?? []) {
    for (const pkg of result.packages ?? []) {
      for (const vulnerability of pkg.vulnerabilities ?? []) {
        findings.push({
          id: vulnerability.id,
          package: pkg.package?.name ?? "unknown",
          severity: vulnerabilitySeverity(vulnerability),
        });
      }
    }
  }
  return findings;
};

export const blockingFindings = (report, minSeverity) => {
  const minRank = severityRank(minSeverity);
  return collectFindings(report).filter((finding) => severityRank(finding.severity) >= minRank);
};
