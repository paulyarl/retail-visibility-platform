-- 322_owner_request_triage.sql
-- Owner-request triage records for Directory Presence seeds (D-1 follow-up).
--
-- Anonymous claim/takedown forms on /place/[slug] and the seed-preview
-- /shops/[slug] banner already flow through POST /api/public/inquiries →
-- crm_inquiries + an outreach touch. crm_inquiries has no seed linkage and
-- directory_seed_outreach_touches has no structured column, so this table
-- carries the triageable record: asserted intent/role, the server-computed
-- credibility summary, and an SLA clock (sla_due_at set only for
-- intent='remove' — the privileged action). Operator verdicts
-- (acknowledge / actioned / dismiss_spam / dismiss_not_credible) are
-- recorded with triaged_at/by/note and mirrored onto crm_inquiries.status.

CREATE TABLE IF NOT EXISTS directory_presence_owner_requests (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_id         varchar(60)  NOT NULL REFERENCES directory_presence_seeds(id) ON DELETE CASCADE,
  -- crm_inquiries.id (text PK). No FK — the request row is the durable audit
  -- record even if the inquiry is later purged.
  inquiry_id      varchar(255),
  intent          varchar(20)  NOT NULL DEFAULT 'question',  -- claim | remove | question
  requester_role  varchar(20),                               -- owner | manager | employee | other
  -- Joined server-computed signal summary (e.g. "phone matches listing
  -- phone; social profile matches listing same_as link"). Triage aid, not
  -- verification — a match does not auto-approve anything.
  credibility     text,
  sender_name     varchar(255),
  sender_email    varchar(255),
  sender_phone    varchar(50),
  sender_social   varchar(200),
  subject         varchar(255),
  -- Set only when intent='remove' (created_at + TAKEDOWN_SLA_HOURS). NULL
  -- means no SLA clock — claim/question requests don't carry one.
  sla_due_at      timestamptz,
  status          varchar(24)  NOT NULL DEFAULT 'open',
  -- open → acknowledged → actioned | dismissed_spam | dismissed_not_credible
  triaged_at      timestamptz,
  triaged_by      varchar(255),
  triage_note     text,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dpor_seed_created
  ON directory_presence_owner_requests (seed_id, created_at DESC);

-- Operator queue: unresolved requests across seeds.
CREATE INDEX IF NOT EXISTS idx_dpor_open
  ON directory_presence_owner_requests (status, sla_due_at)
  WHERE status IN ('open', 'acknowledged');
