import { getStockLevels } from "./ips-db";
import ShopifyGQL from "./shopify";
import { getLogger } from "./logging";
import config, { initConfig } from "./config";
import fs from "fs";
import Path from "path";
import { parseArgs } from "util";

async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv,
    options: {
      "create-csv": {
        type: "boolean",
      },
    },
    strict: true,
    allowPositionals: true,
  });

  console.log("Running");
  await initConfig();
  const logger = getLogger();

  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Rejection at:", promise, "reason:", reason);
    // Application-specific logging or cleanup code here
  });

  // Process exceptions and promise rejection events
  [`uncaughtException`, `rejectionHandled`, `warning`].forEach((eventType) => {
    process.on(eventType, catchEvent.bind(null, eventType));
  });

  function catchEvent(eventType: any, ...args: any[]) {
    logger.error("Caught event...", { eventType, args });
  }

  try {
    const stockLevels = await getStockLevels();
    logger.info("Loaded IPS stock levels", stockLevels.length);
    const shopify = new ShopifyGQL();
    var inventoryLevels = await shopify.getInventoryLevels();
    logger.info("Loaded Shopify inventory levels " + inventoryLevels.length);

    // remove any shopify inventory levels that do not have a SKU
    const before = inventoryLevels.length;
    inventoryLevels = inventoryLevels.filter((level) => level.sku);
    const afterSkuRemoval = inventoryLevels.length;
    logger.info(
      "Removed inventory levels without SKU " + (before - afterSkuRemoval),
    );

    // remove any shopify inventory levels that are archived
    inventoryLevels = inventoryLevels.filter((level) => !level.acrhived);
    const afterArchivedRemoval = inventoryLevels.length;
    logger.info(
      "Removed archived inventory levels " +
        (afterSkuRemoval - afterArchivedRemoval),
    );

    // count any stock levels in Shopify that are not in IPS
    inventoryLevels = inventoryLevels.filter((level) => {
      const ipsLevel = stockLevels.find(
        (ipsLevel) => ipsLevel.sku.trim() === level.sku.trim(),
      );
      if (!ipsLevel) {
        logger.debug(`SKU ${level.sku} not found in IPS`);
      }
      return !!ipsLevel;
    });
    const afterIpsRemoval = inventoryLevels.length;
    logger.info(
      "Removed inventory levels not in IPS " +
        (afterArchivedRemoval - afterIpsRemoval),
    );

    if (values["create-csv"]) {
      if (!config.create_csv_with_pos_items_not_in_shopify_file_location) {
        logger.error(
          "create_csv_with_pos_items_not_in_shopify_file_location is not set in config. Cannot create CSV",
        );
        return;
      }

      // list all stock levels in IPS that are not in Shopify
      const missingLevels = stockLevels.filter(
        (level) =>
          !inventoryLevels.find(
            (ipsLevel) => ipsLevel.sku === level.sku.trim(),
          ),
      );
      logger.info("Missing inventory levels in Shopify", missingLevels.length);

      const rows = missingLevels.map((level) => {
        return `${level.sku},${level.description},${level.quantity}`;
      });

      const csv = ["SKU,Description,Quantity"].concat(rows).join("\n");
      const prettyDate = new Date().toISOString().replace(/[:.]/g, "-");
      const filePath = Path.resolve(
        config.create_csv_with_pos_items_not_in_shopify_file_location,
        "pos_items_not_in_shopify_" + prettyDate + ".csv",
      );

      fs.writeFileSync(filePath, csv);
      return;
    }

    for (const level of inventoryLevels) {
      const progressString = `[${inventoryLevels.indexOf(level) + 1}/${
        inventoryLevels.length
      }]`;
      const ipsLevel = stockLevels.find(
        (ipsLevel) => ipsLevel.sku.trim() === level.sku.trim(),
      );

      if (!ipsLevel) {
        logger.info(`SKU ${level.sku} not found in IPS`);
        return;
      }

      if (ipsLevel.quantity !== level.quantity) {
        if (ipsLevel.quantity < 0) {
          logger.warn(
            `${progressString} Negative stock level for SKU ${level.sku} in IPS. Skipping update`,
          );
          continue;
        }

        logger.info(
          `${progressString} Updating SKU: ${level.sku} IPS: ${ipsLevel.quantity} Shopify: ${level.quantity}`,
        );

        await shopify.setInventoryLevel(
          level.id,
          ipsLevel.quantity,
          level.quantity,
        );
      }

      if (!level.tracked) {
        logger.info(
          `${progressString} Updating SKU ${level.sku} to be marked as tracked in Shopify`,
        );
        await shopify.markAsTracked(level.id);
      }

      if (level.tracked && ipsLevel.quantity === level.quantity) {
        logger.debug(`${progressString} SKU ${level.sku} is up to date`);
      }
    }
  } catch (error) {
    logger.error("Error in main function", error);
  }
}

main();
