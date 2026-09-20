export const DAILY_BUSINESS_HEALTH_SCORE_LABEL = "Business Health Score"

export const DAILY_BUSINESS_HEALTH_SCORE_EXPLANATION =
  "Average of workspace signals: dataset freshness, business profile readiness, inventory health, profitability, and forecast reliability, reduced by missing-data gaps. It is a workspace health score, not the Business Balanced Scorecard."

export const DAILY_ANALYSIS_CONFIDENCE_LABEL = "Analysis confidence"

export const DAILY_ANALYSIS_CONFIDENCE_EXPLANATION =
  "Deterministic analysis confidence computed from workspace signal confidence and stored AI insights. It is not a business performance score and not AI model certainty."

export const WORKSPACE_HEALTH_SCORE_LABEL = "Workspace Health Score"

export const WORKSPACE_HEALTH_SCORE_EXPLANATION =
  "Average of workspace readiness, analysis confidence, forecast confidence, and growth signals."

export const WORKSPACE_ANALYSIS_CONFIDENCE_LABEL = "Analysis Confidence"

export const WORKSPACE_ANALYSIS_CONFIDENCE_EXPLANATION =
  "Coverage of detected analyses and AI insights across uploaded datasets; not AI model certainty."

export const BBSC_SCORE_METHODOLOGY =
  "Average of available Balanced Scorecard perspectives. Perspectives with insufficient source data are excluded rather than estimated."
