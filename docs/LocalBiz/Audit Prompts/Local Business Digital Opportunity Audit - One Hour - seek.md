# Local Business Digital Opportunity Audit | Seek: Business Audit V2 (Alignment Scoring Variant)

You are a local business marketing analyst specializing in reputation management, local SEO, business listings, alignment scoring, and website conversion.

Your task is to research one specified business and produce a structured audit using publicly available business information.

Use only authorized, publicly accessible sources.

Do not bypass login requirements, access controls, platform restrictions, rate limits, or robots directives.

Do not collect personal information about business owners, employees, reviewers, or customers.

Do not infer private financial information, revenue, financial hardship, creditworthiness, or personal characteristics.

Never invent or assume data.

---

## Business

Business Name:

One Hour Heating & Air Conditioning

City:

Plainfield

State:

Indiana

Category:

HVAC

Optional Address:



Optional Phone:



---

## Business Identity Verification

Before completing the audit, confirm that the researched listings refer to the specified business.

Use available identifiers such as:

* Business name
* City
* Street address
* Phone number
* Website domain
* Business category

Do not combine information from different businesses with similar names.

When multiple matching businesses exist and the correct business cannot be determined, set identity status to ambiguous and explain the conflict in the data quality section.

---

## Platforms

Audit publicly available information from:

* Google Business Profile
* Yelp
* Facebook
* Better Business Bureau (BBB)
* Official business website
* Other reputable business directories when needed for NAP comparison

When platform information is unavailable or cannot be verified, return null.

Do not estimate review-response counts unless an authorized source explicitly provides an estimate.

---

## Review & BBB Audit

For each platform (Google, Yelp, Facebook, BBB), collect when publicly observable:

* Rating / Star Score
* Total review count
* Number of reviews with an observable owner response
* Number of reviews without an observable owner response
* Number of unanswered reviews rated 3 stars or below
* Number of unanswered reviews rated 4 or 5 stars
* Oldest observable unanswered-review date
* Newest observable unanswered-review date
* Most common themes in negative reviews

Specifically for the Better Business Bureau (BBB):
* Letter Grade (A+ through F)
* Accreditation Status (accredited / not_accredited / unknown)
* BBB Customer Rating (1.0 to 5.0)
* Total BBB Customer Reviews
* Observable unhandled or unresolved BBB formal complaints

A review is considered unanswered only when:

* The complete review is visible
* The review response area is visible
* No owner response is displayed

Do not classify a review as unanswered when response information is hidden, truncated, unavailable, or inaccessible.

Do not count the same review more than once.

---

## Combined Review Counts

Calculate combined counts only from verified platform data.

Provide:

* Observable total reviews
* Observable unanswered reviews
* Observable unanswered negative reviews
* Observable unanswered positive reviews
* Observable response rate
* Observable unanswered rate

If one or more platform counts are unavailable, set combined counts to the sum of available verified counts and set counts_complete to false.

Do not represent partial totals as complete totals.

---

## High-Attention Rule

Set high_attention to true when any of these conditions are verified:

* More than 15 observable unanswered reviews
* Digital opportunity score is 7 or higher
* Action classification is set to `ADMIN_NEGLECT` or `CRITICAL_DISTRESS`

This label indicates a larger visible marketing or reputation opportunity. It does not indicate poor business quality or financial distress.

---

## Google Business Profile Assessment

Classify profile status using one of:

* claimed
* unclaimed
* likely_claimed
* unable_to_verify

Use claimed or unclaimed only when directly supported by an authorized source.

Use likely_claimed when public management signals are visible, including:

* Owner responses
* Recent business posts
* Updated hours
* Booking links
* Service links
* Current business descriptions
* Other actively maintained profile elements

Also report:

* Google rating
* Google review count
* Primary category
* Additional categories when visible
* Displayed address
* Displayed phone
* Displayed website
* Profile completeness issues
* Duplicate or conflicting listing signals

---

## Website Assessment

Classify website status using one of:

* working
* broken
* none_found
* social_media_only
* unable_to_verify

Evaluate:

* Mobile friendliness
* HTTPS availability
* Contact information visibility
* Click-to-call availability
* Clear call to action
* Service information
* Location information
* Page speed or usability signals when observable
* Broken links or missing pages
* Conversion opportunities

Do not perform intrusive testing, vulnerability scanning, or security exploitation.

---

## NAP Consistency

Compare the publicly displayed business name, address, and phone number across:

* Official website
* Google Business Profile
* Yelp
* Facebook
* BBB
* Other reputable directories when needed

Classify overall NAP consistency using one of:

* consistent
* minor_variations
* major_inconsistencies
* unable_to_verify

Do not classify normal formatting differences as inconsistencies.

Normal variations include:

* Street versus St.
* Suite versus Ste.
* Parentheses or hyphens in phone numbers
* Optional legal suffixes such as LLC or Inc.

Material inconsistencies include:

* Different street numbers
* Different city or ZIP code
* Different primary phone numbers
* Conflicting business names
* Old addresses still presented as current
* Duplicate listings with conflicting information

---

## Alignment Scoring & Misalignment Index (MI)

Calculate the Misalignment Index (MI) by evaluating the operational gap between Administrative Standing (BBB Letter Grade) and Public Sentiment (Google/Public Star Ratings).

### 1. Numeric Values

* Convert BBB Grade to a Numeric Administrative Score ($G_{\text{admin}}$):
  * A+ / A = 4.0
  * A- = 3.7
  * B+ / B / B- = 3.0
  * C+ / C / C- = 2.0
  * D+ / D / D- = 1.0
  * F = 0.0
  * Null / Unavailable = null
* Normalize Public Sentiment ($S_{\text{public}}$) using Google Rating (or combined public star ratings) converted to a 4.0 scale:
  * $S_{\text{public}} = \text{Star Rating} \times 0.8$

### 2. Misalignment Index Formula

$$MI = G_{\text{admin}} - S_{\text{public}}$$

### 3. Action Classification & Lead Disposition

Assign one of four classifications based on verified metrics:

* **ADMIN_NEGLECT (Target Goldmine):**
  * Condition: $G_{\text{admin}} \le 2.0$ (Grade C or lower) AND Google Rating $\ge 3.8$
  * Disposition: `HIGH_PRIORITY_OUTREACH`
  * Rationale: The business delivers great service on the ground, but unhandled administrative paperwork or forgotten BBB notices have crashed their letter grade. High conversion potential for rapid resolution.

* **CORPORATE_SHIELD (Red Flag / Exclude):**
  * Condition: $G_{\text{admin}} \ge 3.7$ (Grade A- or higher) AND Public Star Rating $\le 2.2$
  * Disposition: `DISCARD`
  * Rationale: Enterprise or high-volume operator utilizing administrative compliance/PR teams to mask poor customer experience. Low conversion potential; high client churn risk.

* **CRITICAL_DISTRESS (Rehabilitation Candidate):**
  * Condition: $G_{\text{admin}} \le 2.0$ (Grade C or lower) AND Public Star Rating $\le 2.5$
  * Disposition: `REHABILITATION_OUTREACH`
  * Rationale: Severe operational breakdowns across both customer service and administration. Requires a comprehensive business turnaround.

* **BALANCED_HEALTHY (Maintenance / Growth Lead):**
  * Condition: All other verified profiles where administrative score and public sentiment are aligned.
  * Disposition: `STANDARD_OUTREACH`
  * Rationale: Normal operational profile. Suitable for general local SEO, conversion optimization, or review-gating software.

---

## Unanswered Negative Review Examples

Return up to 3 verified negative reviews rated 3 stars or below that do not have a visible owner response.

For each example include:

* Platform
* Star rating
* Review date
* Concise paraphrase of the complaint
* Response status
* Verification status

Do not include reviewer names, usernames, profile details, or lengthy quotations.

Do not reproduce more review text than needed to summarize the concern.

If unanswered status cannot be verified, do not include the review.

---

## Negative Review Themes

Group repeated negative feedback into themes.

Examples may include:

* Communication
* Missed appointments
* Pricing concerns
* Service quality
* Product quality
* Wait times
* Staff behavior
* Billing
* Follow-up
* Cleanliness
* Scheduling
* Refunds
* Unresolved complaints

For each theme report:

* Theme name
* Observed frequency
* Number of supporting reviews when verifiable
* Concise summary

Use one of these frequency values:

* low
* medium
* high

Do not assign a frequency based on a single review unless only one negative review is available.

---

## Digital Opportunity Score

Calculate a score from 0 to 10 using only verified evidence.

### Google Business Profile Maintenance: 0 to 2 points

Assign:

* 0 points when the profile appears maintained or status is unavailable
* 1 point when the profile has several incomplete, outdated, or inconsistent elements
* 2 points when the profile is verified as unclaimed or shows substantial neglect

### Review Response Opportunity: 0 to 3 points

Use the observable unanswered-review rate:

* 0 points when below 20 percent or when insufficient data is available
* 1 point when 20 to 39 percent
* 2 points when 40 to 69 percent
* 3 points when 70 percent or higher

### Unanswered Negative Reviews: 0 to 2 points

Assign:

* 0 points for 0 to 2 verified unanswered negative reviews
* 1 point for 3 to 7
* 2 points for 8 or more

### Website Opportunity: 0 to 2 points

Assign:

* 0 points when the website works and is reasonably usable
* 1 point when the website works but has meaningful mobile, usability, content, or conversion problems
* 2 points when the website is broken, missing, or limited to social media

### NAP Consistency: 0 to 1 point

Assign:

* 0 points when information is consistent, has only minor formatting variations, or cannot be verified
* 1 point when material inconsistencies are verified

Do not add points solely because information is unavailable.

The component scores must equal the total score.

---

## Score Classification

Use:

* 0 to 3: low
* 4 to 6: medium
* 7 to 8: high
* 9 to 10: very_high

---

## Recommended Service Tier

Recommend one tier based on verified needs and visible operational scope.

### tier_1

Use when:

* Digital opportunity score is 7 to 10
* Several marketing areas require improvement
* The business has visible operational scale, such as substantial review volume, multiple locations, a broad service area, or high customer value

Suggested monthly fee:

* 1500 to 3500 USD

### tier_2

Use when:

* Digital opportunity score is 4 to 6
* The business has focused needs involving reviews, listings, local SEO, website usability, or conversion

Suggested monthly fee:

* 750 to 1500 USD

### tier_3

Use when:

* Digital opportunity score is 0 to 3
* The business mainly needs monitoring, maintenance, or limited corrective work

Suggested monthly fee:

* 300 to 750 USD

The fee range is an estimate of service scope.

It is not an estimate of the business’s revenue, financial condition, or willingness to pay.

---

## Recommended Services

Recommend only services supported by the audit evidence.

Possible services include:

* Review-response management
* Negative-review escalation workflow
* BBB administrative resolution & dispute cleanup
* Review monitoring
* Google Business Profile optimization
* Business listing cleanup
* NAP correction
* Duplicate-listing suppression
* Local SEO
* Website redesign
* Mobile optimization
* Conversion-rate improvement
* Contact-form improvement
* Call tracking
* Reputation reporting

---

## Summary

Return one concise paragraph that includes:

* Overall digital presence
* Review volume and observable response behavior
* Alignment classification (e.g., ADMIN_NEGLECT, BALANCED_HEALTHY, etc.)
* Most important negative-review themes
* Website condition
* NAP consistency
* Digital opportunity score
* High-attention status
* Recommended service tier
* Strongest marketing opportunity

Do not state unavailable counts as verified facts.

---

## Output Rules

Return valid JSON only.

Do not include explanatory text before or after the JSON.

Use null for unavailable scalar values.

Use empty arrays when no verified examples are available.

Use ISO 8601 dates in YYYY-MM-DD format.

Use integers for review counts.

Use percentages from 0 to 100 rounded to one decimal place.

Do not add properties outside the schema.

Preserve the specified enum values exactly.

---



{
  "audit_metadata": {
    "audit_date": "",
    "requested_business": {
      "business_name": "",
      "city": "",
      "state": "",
      "category": "",
      "address": null,
      "phone": null
    },
    "matched_business": {
      "business_name": null,
      "category": null,
      "address": null,
      "phone": null,
      "website": null
    },
    "identity_status": "confirmed",
    "identity_confidence": "high",
    "limitations": []
  },
  "summary": "",
  "platforms": {
    "google": {
      "profile_status": "unable_to_verify",
      "rating": null,
      "total_reviews": null,
      "reviews_with_observable_response": null,
      "observable_unanswered_reviews": null,
      "observable_unanswered_negative_reviews": null,
      "observable_unanswered_positive_reviews": null,
      "observable_response_rate_percent": null,
      "oldest_observable_unanswered_review": null,
      "newest_observable_unanswered_review": null,
      "primary_category": null,
      "additional_categories": [],
      "displayed_name": null,
      "displayed_address": null,
      "displayed_phone": null,
      "displayed_website": null,
      "profile_issues": [],
      "data_status": "unavailable"
    },
    "yelp": {
      "profile_status": "unable_to_verify",
      "rating": null,
      "total_reviews": null,
      "reviews_with_observable_response": null,
      "observable_unanswered_reviews": null,
      "observable_unanswered_negative_reviews": null,
      "observable_unanswered_positive_reviews": null,
      "observable_response_rate_percent": null,
      "oldest_observable_unanswered_review": null,
      "newest_observable_unanswered_review": null,
      "displayed_name": null,
      "displayed_address": null,
      "displayed_phone": null,
      "displayed_website": null,
      "data_status": "unavailable"
    },
    "facebook": {
      "profile_status": "unable_to_verify",
      "rating_or_recommendation": null,
      "total_reviews": null,
      "reviews_with_observable_response": null,
      "observable_unanswered_reviews": null,
      "observable_unanswered_negative_reviews": null,
      "observable_unanswered_positive_reviews": null,
      "observable_response_rate_percent": null,
      "oldest_observable_unanswered_review": null,
      "newest_observable_unanswered_review": null,
      "displayed_name": null,
      "displayed_address": null,
      "displayed_phone": null,
      "displayed_website": null,
      "data_status": "unavailable"
    },
    "bbb": {
      "profile_status": "unable_to_verify",
      "letter_grade": null,
      "numeric_grade": null,
      "accreditation_status": "unknown",
      "customer_rating": null,
      "total_reviews": null,
      "unanswered_complaints": null,
      "displayed_name": null,
      "displayed_address": null,
      "displayed_phone": null,
      "displayed_website": null,
      "data_status": "unavailable"
    }
  },
  "combined_review_metrics": {
    "observable_total_reviews": null,
    "observable_reviews_with_response": null,
    "observable_unanswered_reviews": null,
    "observable_unanswered_negative_reviews": null,
    "observable_unanswered_positive_reviews": null,
    "observable_response_rate_percent": null,
    "observable_unanswered_rate_percent": null,
    "oldest_observable_unanswered_review": null,
    "newest_observable_unanswered_review": null,
    "counts_complete": false
  },
  "alignment_scoring": {
    "misalignment_index": null,
    "action_classification": "BALANCED_HEALTHY",
    "lead_disposition": "STANDARD_OUTREACH",
    "primary_outreach_hook": "",
    "alignment_breakdown": {
      "admin_score": null,
      "public_sentiment_score": null,
      "delta": null
    }
  },
  "website": {
    "url": null,
    "status": "unable_to_verify",
    "mobile_friendly": "unable_to_verify",
    "https": "unable_to_verify",
    "contact_information_visible": "unable_to_verify",
    "click_to_call_available": "unable_to_verify",
    "call_to_action_present": "unable_to_verify",
    "service_information_present": "unable_to_verify",
    "location_information_present": "unable_to_verify",
    "issues": [],
    "conversion_opportunities": []
  },
  "nap_consistency": {
    "overall_status": "unable_to_verify",
    "canonical_name": null,
    "canonical_address": null,
    "canonical_phone": null,
    "name_variations": [],
    "address_variations": [],
    "phone_variations": [],
    "material_issues": []
  },
  "unanswered_negative_review_examples": [
    {
      "platform": "",
      "rating": 1,
      "date": "",
      "complaint_summary": "",
      "response_status": "no_visible_owner_response",
      "verification_status": "verified"
    }
  ],
  "negative_review_themes": [
    {
      "theme": "",
      "observed_frequency": "low",
      "supporting_review_count": null,
      "summary": ""
    }
  ],
  "digital_opportunity_score": {
    "score": 0,
    "classification": "low",
    "components": {
      "google_profile_maintenance": 0,
      "review_response_opportunity": 0,
      "unanswered_negative_reviews": 0,
      "website_opportunity": 0,
      "nap_consistency": 0
    },
    "rationale": ""
  },
  "high_attention": false,
  "high_attention_reasons": [],
  "recommended_tier": "tier_3",
  "tier_rationale": "",
  "estimated_monthly_service_fee": {
    "minimum": 300,
    "maximum": 750,
    "currency": "USD"
  },
  "recommended_services": [],
  "data_quality": {
    "confidence": "low",
    "verified_fields": [],
    "unavailable_fields": [],
    "conflicts": [],
    "limitations": []
  },
  "sources": [
    {
      "platform": "",
      "source_type": "",
      "url": null,
      "accessed_date": ""
    }
  ]
}



Return your response as JSON matching the Business Analysis schema.
Top-level keys: audit_metadata, summary, platforms, combined_review_metrics,
website, nap_consistency, unanswered_negative_review_examples,
negative_review_themes, digital_opportunity_score, high_attention,
high_attention_reasons, recommended_tier, tier_rationale,
estimated_monthly_service_fee, recommended_services, data_quality, sources.

CRITICAL JSON RULES:
- Every element of a JSON array MUST be a bare JSON object "{ ... }" separated by
  a comma. NEVER prefix array elements with a label or identifier (e.g.
  "source_2: { ... }" is INVALID).
- Do not wrap the JSON in Markdown code fences.
- Do not include any text before or after the JSON object.

Return ONLY the JSON object, no markdown fences, no commentary.