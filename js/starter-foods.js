function isTestStarterFood(food) {
  const id = String(food?.id ?? '').trim().toLowerCase();
  const name = String(food?.name ?? '').trim().toLowerCase();
  return id === 'test' || name === 'test';
}

const RAW_STARTER_FOODS = [
  { id: 'eggs', name: 'Eggs (Large)', servingSize: 100, servingUnit: 'g', calories: 155, carbs: 1.1, protein: 13, fat: 11, defaultServingSize: 50 },
  { id: 'oats', name: 'Oats (Dry)', servingSize: 100, servingUnit: 'g', calories: 389, carbs: 66, protein: 17, fat: 6.9, defaultServingSize: 40 },
  { id: 'apple', name: 'Apple (Medium)', servingSize: 100, servingUnit: 'g', calories: 52, carbs: 14, protein: 0.3, fat: 0.2, defaultServingSize: 182 },
  { id: 'banana', name: 'Banana (Medium)', servingSize: 100, servingUnit: 'g', calories: 89, carbs: 23, protein: 1.1, fat: 0.3, defaultServingSize: 118 },
  { id: 'chicken_breast', name: 'Chicken Breast (Skinless)', servingSize: 100, servingUnit: 'g', calories: 165, carbs: 0, protein: 31, fat: 3.6, defaultServingSize: 100 },
  { id: 'salmon', name: 'Salmon (Cooked)', servingSize: 100, servingUnit: 'g', calories: 280, carbs: 0, protein: 25, fat: 20, defaultServingSize: 100 },
  { id: 'broccoli', name: 'Broccoli (Raw)', servingSize: 100, servingUnit: 'g', calories: 34, carbs: 7, protein: 2.8, fat: 0.4, defaultServingSize: 100 },
  { id: 'sweet_potato', name: 'Sweet Potato (Baked)', servingSize: 100, servingUnit: 'g', calories: 86, carbs: 20, protein: 1.6, fat: 0.1, defaultServingSize: 100 },
  { id: 'brown_rice', name: 'Brown Rice (Cooked)', servingSize: 100, servingUnit: 'g', calories: 112, carbs: 24, protein: 2.6, fat: 0.9, defaultServingSize: 150 },
  { id: 'almonds', name: 'Almonds (Raw)', servingSize: 100, servingUnit: 'g', calories: 579, carbs: 22, protein: 21, fat: 50, defaultServingSize: 28 },
  { id: 'greek_yogurt', name: 'Greek Yogurt (Plain)', servingSize: 100, servingUnit: 'g', calories: 59, carbs: 3.3, protein: 10, fat: 0.4, defaultServingSize: 100 },
  { id: 'cottage_cheese', name: 'Cottage Cheese (Low-fat)', servingSize: 100, servingUnit: 'g', calories: 72, carbs: 2.8, protein: 11, fat: 2.3, defaultServingSize: 100 },
  { id: 'spinach', name: 'Spinach (Raw)', servingSize: 100, servingUnit: 'g', calories: 23, carbs: 3.6, protein: 2.9, fat: 0.4, defaultServingSize: 30 },
  { id: 'peanut_butter', name: 'Peanut Butter', servingSize: 100, servingUnit: 'g', calories: 588, carbs: 20, protein: 25, fat: 50, defaultServingSize: 32 },
  { id: 'blueberries', name: 'Blueberries (Fresh)', servingSize: 100, servingUnit: 'g', calories: 57, carbs: 14, protein: 0.7, fat: 0.3, defaultServingSize: 100 },
  { id: 'ground_beef', name: 'Ground Beef (93% Lean)', servingSize: 100, servingUnit: 'g', calories: 165, carbs: 0, protein: 23, fat: 7.5, defaultServingSize: 100 },
  { id: 'white_rice', name: 'White Rice (Cooked)', servingSize: 100, servingUnit: 'g', calories: 130, carbs: 28, protein: 2.7, fat: 0.3, defaultServingSize: 150 },
  { id: 'avocado', name: 'Avocado (Half)', servingSize: 100, servingUnit: 'g', calories: 160, carbs: 8.6, protein: 2, fat: 15, defaultServingSize: 100 },
  { id: 'tuna', name: 'Canned Tuna (in Water)', servingSize: 100, servingUnit: 'g', calories: 99, carbs: 0, protein: 22, fat: 0.8, defaultServingSize: 100 },
  { id: 'whole_wheat_bread', name: 'Whole Wheat Bread (Slice)', servingSize: 100, servingUnit: 'g', calories: 247, carbs: 41, protein: 8.7, fat: 3.3, defaultServingSize: 28 },
];

/** Default library seeded into a new account's food list (per 100g unless noted). */
export const STARTER_FOODS = RAW_STARTER_FOODS.filter((food) => !isTestStarterFood(food));

/** Sample log lines for today on first sign-in (food ids from starter library). */
export const STARTER_LOG_ENTRIES = [
  { foodId: 'banana', meal: 'breakfast' },
  { foodId: 'eggs', meal: 'breakfast' },
  { foodId: 'oats', meal: 'breakfast' },
];
