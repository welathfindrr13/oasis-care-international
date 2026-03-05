# Oasis Care Data Monetization Playbook

Date: 2026-03-02
Status: Draft for founder/product/legal review

## Purpose
Define how Oasis can monetize data-driven products without selling raw identifiable care records and without breaking tenant trust.

This is a product and compliance blueprint, not legal advice.

## What This Means for Oasis
You can monetize:
1. Analytics products.
2. Benchmarking products.
3. Risk-scoring products.
4. Research products using anonymized or tightly governed datasets.

You should avoid monetizing:
1. Raw row-level client datasets.
2. Free-text notes or exports containing re-identification risk.
3. Any secondary use not covered by transparent contracts/privacy notices and lawful basis.

## Core Rules (Non-Negotiable)
1. Health/care records are special category personal data and need extra protection.
2. Pseudonymized data is still personal data.
3. Purpose limitation applies: no "keep forever for anything later".
4. Storage limitation applies: retention must be justified and documented.
5. High-risk secondary-use processing needs DPIA and, if residual high risk remains, ICO consultation.
6. If using NHS patient data/systems, DSP Toolkit requirements apply and should be maintained annually.
7. If processing for research/planning beyond individual care in NHS contexts, national data opt-out rules may apply depending on legal basis.

## Product Strategy (Revenue First, Lowest Legal Risk First)
### Tier A: In-Tenant Premium Analytics (Recommended First)
Sell advanced dashboards to each agency about their own population:
1. Care-log completion rates.
2. Medication adherence trends.
3. Escalation/incident trends.
4. Staffing pressure and service quality indicators.

No cross-tenant sharing required.

### Tier B: Cross-Tenant Benchmarking (De-Identified Aggregate Only)
Sell "compare me to peers" reports:
1. Agency percentile vs similar providers.
2. Regional trend snapshots.
3. Outcome trend deltas over time.

Requirements:
1. Aggregates only.
2. Minimum cohort thresholds (for example, k >= 20).
3. No small-cell leakage.
4. No free text.

### Tier C: Risk/Quality Scores API
Sell model outputs, not underlying records:
1. Deterioration risk score.
2. Missed-medication risk score.
3. Care-log non-compliance risk score.

Requirements:
1. Strict feature allowlist.
2. Tenant-isolated model execution.
3. Explainability and human override path.

### Tier D: Research/Synthetic Data Products
Only after governance maturity:
1. Controlled research environment.
2. Anonymized extracts where possible.
3. Synthetic datasets for external licensing.

## Contract Packaging for Agencies
Use clear commercial tiers in MSA + DPA:

1. `Core Care Platform` (default):
- Uses data only for service delivery, safety, support, and platform operation.

2. `Advanced Analytics Add-On` (recommended default upsell):
- In-tenant analytics only.
- No external data sharing.

3. `Benchmarking Add-On` (explicit opt-in):
- Allows contribution of de-identified aggregate metrics to benchmark pool.
- Prohibits row-level personal data export to third parties.

4. `Research Program Add-On` (separate, explicit):
- Specific research purpose, lawful basis, safeguards, retention terms, and withdrawal process.

## Data Architecture for Monetization
Implement and enforce 4 data classes:

1. `Class 0 - Identified Clinical`:
- Full care record with direct identifiers.
- Use: care delivery only.

2. `Class 1 - Pseudonymized Product`:
- No direct identifiers; internal re-link key exists.
- Use: internal model development under DPA controls.

3. `Class 2 - Anonymized Aggregate`:
- Irreversible aggregates with thresholding.
- Use: benchmarking and external insight products.

4. `Class 3 - Synthetic`:
- Generated datasets with privacy testing and utility checks.
- Use: external licensing/training packs.

## AI Summary Guardrail Requirements
For AI summaries, do not send direct identifiers to model input.

Model input allowlist should include only:
1. Age band (not DOB).
2. Medication classes/regimens.
3. Conditions/flags needed for care context.
4. Structured care events (toileting, sleep, nutrition, mood, mobility, medication administration).
5. Time-windowed trend features.

Model input denylist:
1. Name, exact DOB, address/postcode, phone, email, NHS number.
2. Unredacted free-text notes containing personal identifiers.

Output guardrails:
1. Block identifier leakage in generated text.
2. Log and alert on policy violations.
3. Store only redacted prompt/response traces.

## Technical Controls Backlog (Implementation)
1. Add field-level classification tags in schema (`IDENTIFIED`, `PSEUDONYMIZED`, `AGGREGATE`, `SYNTHETIC`).
2. Add secondary-use policy engine by tenant/org (`none`, `analytics_only`, `benchmark_opt_in`, `research_opt_in`).
3. Build anonymization service for benchmark exports:
- k-threshold checks,
- low-frequency suppression,
- free-text removal,
- date binning.
4. Add immutable audit logs for:
- secondary-use exports,
- benchmark jobs,
- model-training jobs.
5. Add retention scheduler by data class and purpose.
6. Add data-subject rights workflows and evidencing (SAR/erasure/objection) from existing GDPR checklist.
7. Add release gate: block benchmark/research jobs without active DPA + policy flag + DPIA record.

## GTM Monetization Model
1. Base SaaS per agency (platform).
2. Add-on: Advanced Analytics (per location or per active client band).
3. Add-on: Benchmarking Insights (flat + usage tier).
4. Add-on: Risk API (volume-based).
5. Enterprise Research Program (custom contract).

## 90-Day Execution Plan
1. Days 1-30:
- Ship Tier A analytics only.
- Ship AI summary input/output guardrails.
- Add policy flags per org.

2. Days 31-60:
- Ship benchmark pipeline with anonymization thresholds.
- Update contracts/privacy notices for benchmark add-on.
- Complete DPIA for benchmark processing.

3. Days 61-90:
- Launch benchmark commercial pilot.
- Build synthetic data prototype and privacy test harness.
- Prepare research add-on templates and governance pack.

## Decision Gate Before Any External Data Product
All must be true:
1. Purpose is explicit and documented.
2. Lawful basis and special category condition are documented.
3. DPA/controller-controller agreements are signed where applicable.
4. DPIA completed and approved.
5. Data minimization and retention policies enforced in code.
6. Re-identification risk assessed and accepted.
7. Tenant can opt in/out according to contract terms.

## Sources
1. ICO Purpose limitation: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/purpose-limitation
2. ICO Storage limitation: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation
3. ICO Special category data: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data
4. ICO Pseudonymisation: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/anonymisation/pseudonymisation
5. ICO Introduction to anonymisation: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/anonymisation/introduction-to-anonymisation
6. ICO DPIA guidance: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/when-do-we-need-to-do-a-dpia
7. ICO Prior consultation: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/do-we-need-to-consult-the-ico
8. ICO Data sharing agreements: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/accountability-framework/contracts-and-data-sharing/data-sharing-agreements
9. ICO Controller/processor contracts: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/guide-to-accountability-and-governance/contracts
10. NHS DSP Toolkit: https://www.dsptoolkit.nhs.uk/
11. NHS National data opt-out overview: https://digital.nhs.uk/services/national-data-opt-out/understanding-the-national-data-opt-out
12. AWS Bedrock FAQ (model training/use of content): https://aws.amazon.com/bedrock/faqs/
13. AWS Bedrock data protection: https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html

