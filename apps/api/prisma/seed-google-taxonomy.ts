import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Basic Google Product Categories for testing
const categories = [
  // Level 1 categories
  { categoryId: "1", categoryPath: "Animals & Pet Supplies", level: 1, parentId: null },
  { categoryId: "2", categoryPath: "Apparel & Accessories", level: 1, parentId: null },
  { categoryId: "3", categoryPath: "Arts & Entertainment", level: 1, parentId: null },
  { categoryId: "4", categoryPath: "Baby & Toddler", level: 1, parentId: null },
  { categoryId: "5", categoryPath: "Business & Industrial", level: 1, parentId: null },
  { categoryId: "6", categoryPath: "Cameras & Optics", level: 1, parentId: null },
  { categoryId: "7", categoryPath: "Electronics", level: 1, parentId: null },
  { categoryId: "8", categoryPath: "Food, Beverages & Tobacco", level: 1, parentId: null },
  { categoryId: "9", categoryPath: "Furniture", level: 1, parentId: null },
  { categoryId: "10", categoryPath: "Hardware", level: 1, parentId: null },
  { categoryId: "11", categoryPath: "Health & Beauty", level: 1, parentId: null },
  { categoryId: "12", categoryPath: "Home & Garden", level: 1, parentId: null },
  { categoryId: "13", categoryPath: "Luggage & Bags", level: 1, parentId: null },
  { categoryId: "14", categoryPath: "Mature", level: 1, parentId: null },
  { categoryId: "15", categoryPath: "Media", level: 1, parentId: null },
  { categoryId: "16", categoryPath: "Office Supplies", level: 1, parentId: null },
  { categoryId: "17", categoryPath: "Religious & Ceremonial", level: 1, parentId: null },
  { categoryId: "18", categoryPath: "Software", level: 1, parentId: null },
  { categoryId: "19", categoryPath: "Sporting Goods", level: 1, parentId: null },
  { categoryId: "20", categoryPath: "Toys & Games", level: 1, parentId: null },
  { categoryId: "21", categoryPath: "Vehicles & Parts", level: 1, parentId: null },

  // Some level 2 categories under Food, Beverages & Tobacco
  { categoryId: "499685", categoryPath: "Food, Beverages & Tobacco > Food Items", level: 2, parentId: "8" },
  { categoryId: "499686", categoryPath: "Food, Beverages & Tobacco > Beverages", level: 2, parentId: "8" },
  { categoryId: "499687", categoryPath: "Food, Beverages & Tobacco > Tobacco Products", level: 2, parentId: "8" },

  // Some level 3 categories under Beverages
  { categoryId: "499776", categoryPath: "Food, Beverages & Tobacco > Beverages > Coffee", level: 3, parentId: "499686" },
  { categoryId: "499777", categoryPath: "Food, Beverages & Tobacco > Beverages > Tea & Infusions", level: 3, parentId: "499686" },
  { categoryId: "499778", categoryPath: "Food, Beverages & Tobacco > Beverages > Soda", level: 3, parentId: "499686" },
  { categoryId: "499779", categoryPath: "Food, Beverages & Tobacco > Beverages > Juice", level: 3, parentId: "499686" },
  { categoryId: "499780", categoryPath: "Food, Beverages & Tobacco > Beverages > Milk", level: 3, parentId: "499686" },

  // Some level 3 categories under Food Items
  { categoryId: "499781", categoryPath: "Food, Beverages & Tobacco > Food Items > Fruits & Vegetables", level: 3, parentId: "499685" },
  { categoryId: "499782", categoryPath: "Food, Beverages & Tobacco > Food Items > Meat & Seafood", level: 3, parentId: "499685" },
  { categoryId: "499783", categoryPath: "Food, Beverages & Tobacco > Food Items > Dairy Products", level: 3, parentId: "499685" },
  { categoryId: "499784", categoryPath: "Food, Beverages & Tobacco > Food Items > Bakery", level: 3, parentId: "499685" },
];

async function seedGoogleTaxonomy() {
  console.log("🌱 Seeding Google Product Taxonomy...");

  for (const category of categories) {
    try {
      await db.googleTaxonomy.upsert({
        where: { categoryId: category.categoryId },
        update: {
          categoryPath: category.categoryPath,
          level: category.level,
          parentId: category.parentId,
          isActive: true,
        },
        create: {
          categoryId: category.categoryId,
          categoryPath: category.categoryPath,
          level: category.level,
          parentId: category.parentId,
          isActive: true,
        },
      });
      console.log(`✅ Created/Updated: ${category.categoryPath}`);
    } catch (error) {
      console.error(`❌ Failed to create ${category.categoryPath}:`, error);
    }
  }

  console.log("🎉 Google Product Taxonomy seeding complete!");
}

seedGoogleTaxonomy()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
