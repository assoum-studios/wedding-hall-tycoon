// Food quality and supplier tiers (kept separate so both the invoice and the night can use them).
export const FOOD = { standard: { costMult: 1, happy: 0 }, premium: { costMult: 1.35, happy: 3 }, luxury: { costMult: 1.8, happy: 6 } } as const;
export type FoodTier = keyof typeof FOOD;
/** index 0 = budget supplier, 1 = standard, 2 = premium */
export const SUPPLIER_HAPPY = [-2, 0, 2];
export const SUPPLIER_COST = [0.82, 1, 1.25];
export const SUPPLIER_KINDS = ['flowers', 'cake', 'photo'] as const;
