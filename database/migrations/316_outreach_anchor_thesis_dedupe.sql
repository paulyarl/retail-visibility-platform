-- Strip the duplicated "{observed_issue} — " prefix from generated sibling-variant
-- anchor theses. suggestVariantsForSeed originally wrote operator_thesis as
-- "{problem} — {outreach_use}" while observed_issue + title already carried the
-- problem text, so the issue rendered twice on cards and in call-script anchor
-- boxes. New rows write thesis = outreach_use only; this normalizes existing rows.
-- Idempotent: only touches rows whose thesis literally starts with their own
-- observed_issue followed by " — ".

UPDATE mkt_outreach_anchors
SET operator_thesis = substring(operator_thesis from char_length(observed_issue) + 4)
WHERE observed_issue IS NOT NULL
  AND observed_issue <> ''
  AND operator_thesis LIKE observed_issue || ' — %';
