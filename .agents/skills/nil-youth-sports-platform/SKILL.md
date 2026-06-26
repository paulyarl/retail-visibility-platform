Functional Specification Document: NIL Youth Sports Platform

Document Version: 1.0

Project Phase Scope: MVP Core Integration & Scalable Private Foundation
1. Executive Summary & Vision

The platform is a digital presence engine and multi-tenant marketplace designed specifically for youth sports (grade school, middle school, high school). Operating under a non-profit motivation, the system capitalizes on emerging Name, Image, and Likeness (NIL) trends to provide financial opportunities for student-athletes. The platform balances high-performance public marketing layers with strict, secure, and privacy-first data routing architectures to protect minors and maintain legal compliance.
2. Platform User Personas & Ecosystem Actors
Public-Facing Actors

    Student-Athlete (Child): Grade school through high school participants. They showcase aggregated academic and athletic achievements, manage physical profile matrices, and post highlight media galleries.

    Sponsor: Commercial entities or local businesses offering NIL financial deals. They maintain public profiles showcasing their "NIL Portfolio" of sponsored children to demonstrate community impact.

    School / Athletic Department: Educational and institutional entities serving as sport and achievement providers. They manage dynamic rosters and compliance metrics.

    Coach / Talent Scout: High school or external club recruiters who manage team rosters, follow prospective athletes on custom boards, and review athletic profiles.

    Fan (Family, Friends, & Community): Public grass-roots supporters who follow specific teams or athletes, interact via social feeds, and earn gamified engagement badges.

    Public Web Tier: Anonymous site visitors accessing global marketing assets and safety-vetted public profiles.

Isolated Private Actors

    Legal Guardian (Parent): The primary legal owner and controller of the minor's data. Parents manage financial routing, approve or deny NIL sponsorship requests, and toggle public visibility permissions. They have zero public profile visibility.

    Compliance Auditor / Admin: Internal system administrators or independent compliance officers responsible for vetting contracts against evolving regional and high school athletic association bylaws.

3. Core Architectural Strategy

The platform utilizes a Two-Tier Architecture to completely segregate public display layers from the sensitive private transactional core.

    The Public Pipeline: Highly cached (e.g., 5-to-15-minute Time-To-Live loops) to ensure fast, scalable, and anonymous read access to public profiles, highlight video metadata, and community feeds.

    The Private Pipeline: A secure, zero-cache (0-TTL) live proxy handling data mutations, contract negotiations, compliance reviews, secure communication streams, and financial processing.

A state-driven database firewall (utilizing workflow flags like pending, approved, and archived) ensures no minor's personal data or highlight reel goes live on the public site without active parental confirmation and compliance validation.

3a. Onboarding & Invitation Architecture

Every actor enters the platform through a structured onboarding flow tied to a bidirectional invitation system. The athlete (via their guardian) sits at the center — they can invite any other actor to connect, and any actor can invite an athlete to establish a platform-connected link. This creates an organic, network-effect-driven growth model where each new actor expands the ecosystem.

Invitation Architecture (Bidirectional)

    Athlete → Actor Invitations: The guardian (or athlete post age-out) can invite:
        School/Club: "Join my institution's roster" — creates an athlete_tenant_memberships_list link
        Sponsor: "Connect for NIL opportunities" — establishes a sponsor-athlete relationship
        Coach: "Connect with my coach" — establishes a coach-athlete following link
        Fan (Family/Friends): "Follow my journey" — creates a fan follow link
        Second Guardian: "Co-manage this athlete" — creates a guardian_athlete_links_list co-ownership row

    Actor → Athlete Invitations: Any actor can invite an athlete to connect:
        School/Club: "Join our roster" — sends a membership invitation to the guardian
        Sponsor: "We'd like to offer a NIL deal" — sends a deal inquiry (guardian-gated)
        Coach: "I'd like to follow your athlete" — sends a follow request (guardian-gated)
        Fan: "Follow request" — sends a public follow request (auto-accepted for public profiles)

    Invitation Lifecycle: sent → viewed → accepted/rejected/expired → connection established (or not). Every invitation carries:
        Inviter actor type + ID
        Invitee actor type + email/identifier
        Connection type (membership, sponsorship, follow, co-guardianship, coaching)
        Guardian consent gate (if the invitee or subject is a minor)
        Expiration (7-day default, configurable per connection type)
        Audit trail (who invited whom, when, response timestamp)

Actor-Aware Onboarding Flows

    Guardian Onboarding: Register → verify email → create athlete-tenant(s) → COPPA consent flow → complete athlete profile → grant scoped consent → invite school/coach/sponsors → KYC for payouts (when first deal is accepted). Guided by the Guardian Onboarding Bot (§17).

    Athlete Onboarding (post age-out): Accept transfer of athlete-tenant control from guardian → verify identity → review existing profile/consent/deals → accept or update financial routing → take ownership of future decisions.

    Institution (School/Club) Onboarding: Register → verify email → create institution-tenant → set tier/subscription → invite athletes to roster → assign coaches → verify achievements → submit compliance report.

    Coach Onboarding: Receive invitation from institution → accept role → access recruiting board → invite athletes to follow → rate prospects → contact guardians (guardian-gated).

    Sponsor Onboarding: Register → verify email → create sponsor-tenant → set tier/subscription → complete business verification → discover athletes (public/consented) → propose deals → fund escrow.

    Fan Onboarding: Register → verify email → search/discover athletes → follow athletes/teams → earn badges → engage with public feed. No invitation required — fans self-register and follow public profiles.

    Compliance/Admin Onboarding: Platform-provisioned account → verify identity → access review queues → configure eligibility rules → manage moderation → process erasure requests.

Connection Establishment Rules

    Minor safety: Any invitation involving a minor athlete requires guardian acceptance. The athlete cannot self-accept invitations until post age-out.
    Most-restrictive-wins: If multiple guardians exist, any guardian can reject an invitation. Acceptance requires all consent-authority guardians to approve (or the inviting actor withdraws).
    Consent-gated connections: School/Club connections trigger a membership consent scope request. Sponsor connections trigger a nil_deals consent scope request. Coach connections trigger a messaging consent scope request.
    Auto-accept for fans: Fan follow requests to public (approved) profiles are auto-accepted — no guardian gate needed for public-only engagement.
    Re-invitation block: A rejected invitation cannot be re-sent for 30 days (anti-spam). Expired invitations can be re-sent after 7 days.

4. Phased Functional Implementation Roadmap

Phase 1: The Credibility Shell ──> Phase 2: The Native Pipeline ──> Phase 3: The Unified Service ──> Phase 4: Multi-Tenant Mesh
   (Investor Readiness)              (Core Data Loop)               (Persona Specialization)          (Enterprise Scaling)

Phase 1: The Credibility Shell (Investor Validation Focus)

    Objective: Eliminate investor resistance regarding "lack of digital presence" and instantly establish brand authority.

    Functional Scope:

        Deploy a world-class static storefront landing page linked to the custom agency brand domain.

        Implement an administrative placeholder containing integrated core business value propositions.

        Establish edge-routed https:// secure SSL validation.

        Deploy a lightweight "Coming Soon" or pre-launch capture interface featuring an integrated email intake module (differentiating between athletes/parents, sponsors, and investors).

Phase 2: The Native Pipeline (Core Ingestion & Display Foundation)

    Objective: Build the secure data-loop foundation for profile creation, data collection, and roster display.

    Functional Scope:

        Profile Intake: Form schemas capturing student athlete registration data (Name, position, school, grade, cumulative GPA, physical stats, and third-party highlight video links from YouTube or Hudl).

        Data Isolation Layer: Backend partition where incoming profiles default to a pending status, visible only to administrative review pipelines.

        The Public Roster: A dynamic, searchable directory page displaying only profiles actively marked as approved.

        Administrative Roster Controller: A basic GUI portal allowing the administrator to toggle an athlete's visibility status, which triggers a cache eviction to update the public roster.

Phase 3: The Unified Service (Persona Specialization & Verification)

    Objective: Formally deploy specialized, authenticated user portals with distinct privacy rules.

    Functional Scope:

        Parental Dashboard: Private authentication node enabling parents to securely manage minor account settings, link multiple domestic children, and grant legal consent for public marketing.

        Coach Portal & Recruiting Board: A guarded view allowing coaches to assemble custom recruitment lists and tag internal star-ratings for prospect tracking.

        Sponsor Portal & NIL Tracking: Interface for businesses to offer sponsorship deals, track pending contract escrow states, and verify cumulative NIL spending.

        Achievement Aggregation Engine: Structured data log allowing schools, clubs, or parents to submit verified athletic, academic, or community milestones to a student's public feed.

        The Gamified Fan Network: Implementation of a public social-activity tier where local fans can follow teams, interact with public feeds, and earn distinct digital badges (e.g., SUPER_FAN, NIL_SUPPORTER).

Phase 4: Full Multi-Tenant Mesh (Enterprise Scale)

    Objective: Scale operations into a robust, high-volume multi-tenant commercial mesh.

    Functional Scope:

        Compliance Automated Vetting: Algorithmic auditing that evaluates contract values against specific high school athletic association bylaw indices based on state geography.

        Integrated Financial Infrastructure: Embedded escrow systems handling milestone-based payouts, non-profit distribution adjustments, and secure parent bank account routing.

        Advanced Row-Level Security (RLS): Total, infrastructure-enforced tenant isolation ensuring zero data cross-contamination between competing schools, clubs, or external sponsors.

5. Master Data Element Track

The system relies on three emerging structural data groups, keeping track of elements that remain flexible to UI layouts but fixed in data logic:

    The Event Track: Schedules, recruitment tryouts, media upload timestamps, and contract signature actions.

    The Financial Track: Base NIL offer amounts, escrow lock milestones, payment distribution schedules, non-profit funding allocation pools, and sponsor ROI spending limits.

    The Media & Metrics Track: Sport-agnostic JSON blocks (storing changing performance stats like passing yards or points per game), third-party video stream URLs, and gamified community badge arrays.

6. Functional Verification Checklist

    [ ] Domain names and DNS records cleanly pointed away from standard registrars to modern, zero-downtime edge-hosting infrastructures.

    [ ] Public roster API routes strictly conditioned to return zero records unless the database entry contains an approved flag.

    [ ] The parental control loop successfully blocks public display of a minor's profile until explicit guardian authentication tokens match the athlete's parent mapping attribute.

    [ ] The system architecture forces all code communication pipelines to flow through the centralized service instance manager rather than using raw, un-cached data requests.