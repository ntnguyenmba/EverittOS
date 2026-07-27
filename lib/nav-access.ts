import { canManageDepartments } from '@/lib/departments';
import { limitsForPlan } from '@/lib/everittos-limits';
import { hasTeamManagement, normalizePlan, planShortBadgeName, type EverittosPlan } from '@/lib/everittos-plans';
import { meetsMinimumPlan, minimumPlanForPath, planRank } from '@/lib/plan-access';
import { canSeeOrgWideData, hasPermission } from '@/lib/permissions';
