// Subscription plans, shown on the landing page. One file, so billing can use the same numbers later.
import data from "./plans.json";

export const TRIAL_DAYS = data.trialDays;
export const ANNUAL_MONTHS_FREE = data.annualMonthsFree;
export const PLATFORM_FEE_PERCENT = data.platformFeePercent;
export const PLANS = data.plans;
// What every plan has: plans differ only by crew size and texts.
export const EVERY_PLAN = data.everyPlan;

// A year paid up front: the months not free, at the monthly price.
export function annualPrice(plan) {
  return plan.monthly * (12 - ANNUAL_MONTHS_FREE);
}

// What a year paid up front works out to per month, rounded down to whole dollars.
export function annualMonthly(plan) {
  return Math.floor(annualPrice(plan) / 12);
}

export function crewLabel(plan) {
  return plan.crewLimit === null ? "You plus unlimited crew" : `You plus up to ${plan.crewLimit} crew`;
}

export function planById(id) {
  return PLANS.find((plan) => plan.id === id) || null;
}
