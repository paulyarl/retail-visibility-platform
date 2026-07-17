/**
 * Org Standing Inheritance Job
 *
 * Scheduled job that runs daily alongside the grace period job to:
 * 1. Detect organizations that have fallen out of good standing
 * 2. Set a grace period (7 days) on inherited tenants — standing_mode_grace_until
 * 3. Send CRM alerts to org admin + affected tenants (notify only, no flip yet)
 * 4. After grace period expires, auto-flip inherited tenants → independent
 * 5. Clear grace timestamps when org recovers
 *
 * Run schedule: Daily at midnight (00:00 UTC) — called from processGracePeriodExpiry
 */

import { prisma, basePrisma } from '../prisma';
import { deriveInternalStatus } from '../utils/subscription-status';
import { CrmAlertService } from '../services/CrmAlertService';
import { logger } from '../logger';

export const ORG_STANDING_GRACE_DAYS = 7;

export interface OrgStandingJobResult {
  orgsDetectedBad: number;
  gracePeriodSet: number;
  tenantsAutoFlipped: number;
  graceCleared: number;
  alertsSent: number;
  errors: string[];
}

/**
 * Check if an organization is in good standing
 */
function isOrgInGoodStanding(orgStatus: string | null, orgTier: string | null): boolean {
  if (!orgStatus || !orgTier) return false;
  const internalStatus = deriveInternalStatus({
    subscription_status: orgStatus,
    subscription_tier: orgTier,
    trialEndsAt: null,
    subscription_ends_at: null,
  });
  return internalStatus === 'active' || internalStatus === 'trialing' || internalStatus === 'past_due';
}

/**
 * Main job: process org standing inheritance grace periods
 */
export async function processOrgStandingInheritance(): Promise<OrgStandingJobResult> {
  const result: OrgStandingJobResult = {
    orgsDetectedBad: 0,
    gracePeriodSet: 0,
    tenantsAutoFlipped: 0,
    graceCleared: 0,
    alertsSent: 0,
    errors: [],
  };

  const now = new Date();
  const graceUntil = new Date(now);
  graceUntil.setDate(graceUntil.getDate() + ORG_STANDING_GRACE_DAYS);

  try {
    // 1. Find all organizations that have inherited tenants
    const orgsWithInheritedTenants = await prisma.organizations_list.findMany({
      where: {
        tenants: {
          some: { org_standing_mode: 'inherited' },
        },
      },
      select: {
        id: true,
        name: true,
        subscription_status: true,
        subscription_tier: true,
        tenants: {
          where: { org_standing_mode: 'inherited' },
          select: {
            id: true,
            name: true,
            org_standing_mode: true,
            standing_mode_grace_until: true,
            subscription_status: true,
            subscription_tier: true,
          },
        },
      },
    });

    for (const org of orgsWithInheritedTenants) {
      const orgGood = isOrgInGoodStanding(org.subscription_status, org.subscription_tier);

      if (!orgGood) {
        result.orgsDetectedBad++;

        // 2a. Set grace period on inherited tenants that don't have one yet
        const tenantsNeedingGrace = org.tenants.filter(t => !t.standing_mode_grace_until);
        for (const tenant of tenantsNeedingGrace) {
          try {
            await prisma.tenants.update({
              where: { id: tenant.id },
              data: { standing_mode_grace_until: graceUntil },
            });
            result.gracePeriodSet++;

            // Send CRM alert to tenant about upcoming standing mode change
            await CrmAlertService.getInstance().create({
              tenant_id: tenant.id,
              type: 'subscription',
              title: 'Organization coverage ending soon',
              body: `Your organization "${org.name}" is no longer in good standing. ` +
                `Inherited standing coverage will end in ${ORG_STANDING_GRACE_DAYS} days ` +
                `(on ${graceUntil.toLocaleDateString()}). After that, your location will ` +
                `switch to independent billing and your own subscription status will apply. ` +
                `Please ensure your subscription is active or contact your organization admin.`,
              icon: '⚠️',
              metadata: {
                org_id: org.id,
                org_name: org.name,
                grace_until: graceUntil.toISOString(),
                auto_flip: true,
              },
            }).catch(err => console.error(`[OrgStandingJob] Failed to create CRM alert for tenant ${tenant.id}:`, err));
            result.alertsSent++;
          } catch (error: any) {
            logger.error(`[OrgStandingJob] Error setting grace for tenant ${tenant.id}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
            result.errors.push(`Grace set ${tenant.id}: ${error.message}`);
          }
        }

        // 2b. Auto-flip tenants whose grace period has expired
        const tenantsToFlip = org.tenants.filter(
          t => t.standing_mode_grace_until && new Date(t.standing_mode_grace_until) < now
        );
        for (const tenant of tenantsToFlip) {
          try {
            await prisma.tenants.update({
              where: { id: tenant.id },
              data: {
                org_standing_mode: 'independent',
                standing_mode_grace_until: null,
              },
            });
            result.tenantsAutoFlipped++;

            // Send CRM alert about the flip
            await CrmAlertService.getInstance().create({
              tenant_id: tenant.id,
              type: 'subscription',
              title: 'Standing mode changed to Independent',
              body: `Your organization "${org.name}" did not recover within the grace period. ` +
                `Your location has been automatically switched to Independent billing. ` +
                `Your own subscription status now determines your access. ` +
                `To restore inherited coverage, ask your organization admin to update their payment method.`,
              icon: '🔄',
              metadata: {
                org_id: org.id,
                org_name: org.name,
                auto_flipped: true,
              },
            }).catch(err => console.error(`[OrgStandingJob] Failed to create flip alert for tenant ${tenant.id}:`, err));
            result.alertsSent++;
          } catch (error: any) {
            logger.error(`[OrgStandingJob] Error auto-flipping tenant ${tenant.id}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
            result.errors.push(`Flip ${tenant.id}: ${error.message}`);
          }
        }
      } else {
        // 3. Org is in good standing — clear any pending grace periods
        const tenantsWithGrace = org.tenants.filter(t => t.standing_mode_grace_until);
        for (const tenant of tenantsWithGrace) {
          try {
            await prisma.tenants.update({
              where: { id: tenant.id },
              data: { standing_mode_grace_until: null },
            });
            result.graceCleared++;

            // Send CRM alert that coverage is restored
            await CrmAlertService.getInstance().create({
              tenant_id: tenant.id,
              type: 'subscription',
              title: 'Organization coverage restored',
              body: `Your organization "${org.name}" is back in good standing. ` +
                `Inherited standing coverage has been restored. The pending switch to independent billing has been cancelled.`,
              icon: '✅',
              metadata: {
                org_id: org.id,
                org_name: org.name,
                coverage_restored: true,
              },
            }).catch(err => console.error(`[OrgStandingJob] Failed to create restore alert for tenant ${tenant.id}:`, err));
            result.alertsSent++;
          } catch (error: any) {
            logger.error(`[OrgStandingJob] Error clearing grace for tenant ${tenant.id}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
            result.errors.push(`Clear ${tenant.id}: ${error.message}`);
          }
        }
      }
    }

    console.log(`[OrgStandingJob] Complete. Orgs bad: ${result.orgsDetectedBad}, Grace set: ${result.gracePeriodSet}, Flipped: ${result.tenantsAutoFlipped}, Cleared: ${result.graceCleared}, Alerts: ${result.alertsSent}, Errors: ${result.errors.length}`);
    return result;
  } catch (error: any) {
    logger.error('[OrgStandingJob] Fatal error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    result.errors.push(`Fatal error: ${error.message}`);
    return result;
  }
}
