export type AuditSeverity = 'error' | 'warning' | 'suggestion'

export interface AuditIssue {
  severity: AuditSeverity
  code: string
  message: string
  context?: Record<string, string>
}

export interface AuditReport {
  issues: AuditIssue[]
  canProceed: boolean
  errorCount: number
  warningCount: number
  suggestionCount: number
}

export function buildAuditReport(issues: AuditIssue[]): AuditReport {
  const errorCount = issues.filter((i) => i.severity === 'error').length
  const warningCount = issues.filter((i) => i.severity === 'warning').length
  const suggestionCount = issues.filter((i) => i.severity === 'suggestion').length
  return {
    issues,
    canProceed: errorCount === 0,
    errorCount,
    warningCount,
    suggestionCount,
  }
}
