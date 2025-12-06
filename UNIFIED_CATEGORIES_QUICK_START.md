# Unified Categories - Quick Start Guide

## 🎯 Purpose

This guide helps you **safely assess** the impact of unifying GBP and Directory category management before making any changes.

---

## 📋 Pre-Implementation Checklist

### Step 1: Run Dependency Analysis (5 minutes)

**What it does:** Analyzes your database to understand all category-related dependencies

```bash
# Connect to your database and run the analysis
psql $DATABASE_URL -f scripts/analyze-category-dependencies.sql > category-analysis-report.txt

# Review the report
cat category-analysis-report.txt
```

**What to look for:**
- ✅ How many tenants have GBP categories
- ✅ How many tenants have Directory categories
- ✅ How many have both (overlap)
- ✅ Which materialized views use category data
- ✅ What triggers exist on category tables
- ✅ Most common categories

**Red flags:**
- 🚩 Large number of tenants (>1000) = Need careful migration planning
- 🚩 Complex triggers = May need to be updated
- 🚩 Many materialized views = Refresh strategy needed

---

### Step 2: Run System Validation (3 minutes)

**What it does:** Validates current system health before making changes

```bash
# Make script executable
chmod +x scripts/validate-category-system.sh

# Run validation
./scripts/validate-category-system.sh
```

**Expected output:**
```
═══════════════════════════════════════════════════
Phase 1: Database Structure Validation
═══════════════════════════════════════════════════

✓ PASS: Verify tenant_business_profiles_list exists
✓ PASS: Verify directory_listings exists
✓ PASS: Verify GBP category columns exist
✓ PASS: Verify Directory category columns exist

...

Total Tests:  15
Passed:       15
Failed:       0

╔════════════════════════════════════════════════════╗
║  ✓ ALL TESTS PASSED - System is healthy!          ║
╚════════════════════════════════════════════════════╝
```

**If tests fail:**
- 🚨 **DO NOT PROCEED** with migration
- Review failed tests
- Fix underlying issues first
- Re-run validation

---

### Step 3: Review Impact Assessment (10 minutes)

Open and review: `UNIFIED_CATEGORIES_IMPLEMENTATION_PLAN.md`

**Key sections to review:**

1. **Impact Assessment** (page 1)
   - What will be affected?
   - What are the risks?

2. **Phased Implementation Plan** (page 2-8)
   - 6-8 week timeline
   - 5 phases with clear goals
   - Rollback strategy at each phase

3. **Test Script Summary** (page 9)
   - Comprehensive test coverage
   - Performance benchmarks
   - Data integrity checks

4. **Risk Matrix** (page 10)
   - Probability vs Impact
   - Mitigation strategies

---

## 🚦 Decision Matrix

### ✅ **GREEN LIGHT - Proceed with confidence**

**Criteria:**
- All validation tests pass
- < 500 tenants with categories
- No complex triggers or materialized views
- Team has 6-8 weeks for phased rollout
- Rollback plan is acceptable

**Next steps:**
1. Review full implementation plan
2. Schedule Phase 0 (Discovery)
3. Assign team members
4. Set up test environment

---

### 🟡 **YELLOW LIGHT - Proceed with caution**

**Criteria:**
- Most validation tests pass (1-2 failures)
- 500-2000 tenants with categories
- Some materialized views or triggers
- Team has 8-12 weeks for careful rollout
- Need additional testing

**Next steps:**
1. Fix validation failures
2. Create additional test scenarios
3. Plan for extended testing phase
4. Consider staged rollout (10% → 50% → 100%)

---

### 🔴 **RED LIGHT - Do not proceed yet**

**Criteria:**
- Multiple validation tests fail
- > 2000 tenants with categories
- Complex triggers or many materialized views
- Team has < 6 weeks available
- High business risk if something breaks

**Next steps:**
1. Fix all validation failures
2. Consider alternative approaches:
   - Keep systems separate but improve UX
   - Unify UI only, keep separate data
   - Gradual migration over 6+ months
3. Re-assess after fixes

---

## 📊 Sample Analysis Output

### Good Scenario ✅
```
Category Data Counts:
- GBP Primary: 250 tenants
- Directory Primary: 180 tenants
- Overlap: 120 tenants (48%)

Materialized Views: 1 (mv_directory_stores)
Triggers: 0
Foreign Keys: 2 (standard tenant references)

Recommendation: GREEN LIGHT - Proceed with standard 6-week plan
```

### Concerning Scenario 🟡
```
Category Data Counts:
- GBP Primary: 1,500 tenants
- Directory Primary: 1,200 tenants
- Overlap: 800 tenants (53%)

Materialized Views: 3 (mv_directory_stores, mv_store_analytics, mv_search_index)
Triggers: 2 (category_sync_trigger, search_update_trigger)
Foreign Keys: 5

Recommendation: YELLOW LIGHT - Extend to 10-week plan, add extra testing phase
```

### High Risk Scenario 🔴
```
Category Data Counts:
- GBP Primary: 5,000 tenants
- Directory Primary: 4,500 tenants
- Overlap: 3,000 tenants (60%)

Materialized Views: 8 (multiple complex views)
Triggers: 6 (complex sync and audit triggers)
Foreign Keys: 12
Custom Functions: 4 (category-related stored procedures)

Recommendation: RED LIGHT - Consider alternative approach or 6-month gradual migration
```

---

## 🔧 Quick Commands Reference

### Run all pre-checks at once:
```bash
# 1. Dependency analysis
psql $DATABASE_URL -f scripts/analyze-category-dependencies.sql > reports/dependency-analysis.txt

# 2. System validation
./scripts/validate-category-system.sh > reports/validation-results.txt

# 3. Review reports
cat reports/dependency-analysis.txt
cat reports/validation-results.txt
```

### Check specific areas:
```bash
# Count categories
psql $DATABASE_URL -c "SELECT COUNT(*) FROM tenant_business_profiles_list WHERE gbp_primary_category_id IS NOT NULL"

# Check materialized views
psql $DATABASE_URL -c "SELECT matviewname FROM pg_matviews WHERE schemaname = 'public'"

# Check triggers
psql $DATABASE_URL -c "SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_schema = 'public'"
```

---

## 📝 Reporting Template

After running analysis, fill out this template:

```markdown
# Category Unification - Pre-Implementation Report

**Date:** [DATE]
**Analyst:** [NAME]
**Database:** [ENVIRONMENT]

## Summary
- Total tenants with GBP categories: [NUMBER]
- Total tenants with Directory categories: [NUMBER]
- Overlap (both): [NUMBER] ([PERCENTAGE]%)

## Dependencies
- Materialized views: [NUMBER]
- Triggers: [NUMBER]
- Foreign keys: [NUMBER]
- Custom functions: [NUMBER]

## Validation Results
- Tests passed: [NUMBER]/[TOTAL]
- Tests failed: [NUMBER]
- Critical failures: [YES/NO]

## Risk Assessment
- Overall risk level: [GREEN/YELLOW/RED]
- Estimated timeline: [WEEKS]
- Recommended approach: [STANDARD/CAUTIOUS/ALTERNATIVE]

## Recommendation
[PROCEED / PROCEED WITH CAUTION / DO NOT PROCEED]

Reasoning:
[EXPLAIN REASONING]

## Next Steps
1. [ACTION 1]
2. [ACTION 2]
3. [ACTION 3]
```

---

## 🆘 Troubleshooting

### "Script won't run"
```bash
# Make sure script is executable
chmod +x scripts/validate-category-system.sh

# Check if psql is installed
which psql

# Verify DATABASE_URL is set
echo $DATABASE_URL
```

### "Database connection fails"
```bash
# Test connection manually
psql $DATABASE_URL -c "SELECT 1"

# Check if DATABASE_URL format is correct
# Should be: postgresql://user:pass@host:port/database
```

### "Tests fail unexpectedly"
1. Check database is up and running
2. Verify you have read permissions
3. Check if tables exist: `\dt` in psql
4. Review specific error messages

---

## 📚 Additional Resources

- **Full Implementation Plan:** `UNIFIED_CATEGORIES_IMPLEMENTATION_PLAN.md`
- **Simplification Details:** `UNIFIED_CATEGORIES_SIMPLIFICATION.md`
- **Original Proposal:** `UNIFIED_CATEGORY_MANAGEMENT_PROPOSAL.md`
- **Test Scripts:** `scripts/` directory

---

## ✅ Final Checklist Before Proceeding

- [ ] Ran dependency analysis
- [ ] Ran system validation
- [ ] All tests passed (or failures understood)
- [ ] Reviewed impact assessment
- [ ] Assessed risk level (GREEN/YELLOW/RED)
- [ ] Team has adequate time (6-8 weeks minimum)
- [ ] Rollback plan is acceptable
- [ ] Stakeholders are informed
- [ ] Test environment is ready
- [ ] Backup strategy is in place

**If all boxes are checked and risk is GREEN/YELLOW, proceed to Phase 0 of the implementation plan.**

**If risk is RED or critical tests fail, address issues before proceeding.**
