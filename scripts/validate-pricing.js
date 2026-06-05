import { readdir, stat, readFile } from "fs/promises";
import { join, sep } from "path";

// Files to check
const patterns = ["src/app", "src/components", "src/lib/content"];

// Files to exclude (contains legitimate prices like config or product definitions)
const excludePatterns = ["src/lib/billing/plans.ts", "src/lib/business/products.ts"];

const priceRegex = /€\d+/g;

async function isExcluded(filePath) {
  return excludePatterns.some((exclude) => filePath.includes(exclude));
}

async function scanDirectory(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await scanDirectory(fullPath)));
    } else if (entry.isFile() && (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx"))) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  let allFiles = [];

  for (const pattern of patterns) {
    try {
      const files = await scanDirectory(pattern);
      allFiles.push(...files);
    } catch (err) {
      console.error(`Error scanning directory ${pattern}:`, err.message);
    }
  }

  let hasError = false;

  for (const file of allFiles) {
    if (await isExcluded(file)) {
      continue;
    }

    try {
      const content = await readFile(file, "utf8");
      let match;
      while ((match = priceRegex.exec(content)) !== null) {
        // Calculate line number
        const lineNum = content.substr(0, match.index).split("\n").length;
        console.error(`\x1b[31mHardcoded price found: ${match[0]} in ${file}:${lineNum}\x1b[0m`);
        hasError = true;
      }
    } catch (err) {
      console.error(`Error reading file ${file}:`, err.message);
    }
  }

  if (hasError) {
    process.exit(1);
  } else {
    console.log("\x1b[32mPricing validation passed: no hardcoded prices found in UI files.\x1b[0m");
    process.exit(0);
  }
}

main();
