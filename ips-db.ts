import { Connection, Request, type ConnectionConfiguration } from "tedious";
import config from "./config";
import {getLogger} from "./logging";


interface IpsStockLevel {
  sku: string;
  quantity: number;
  description: string;
}

export function getStockLevels(): Promise<IpsStockLevel[]> {
  const logger = getLogger();
  
  const promise: Promise<IpsStockLevel[]> = new Promise((resolve, reject) => {
    const returnData: IpsStockLevel[] = [];
    const connection = new Connection(
      config.ips.database as ConnectionConfiguration
    );

    connection.connect((err) => {
      if (err) {
        logger.error("DB Connection Failed");
        logger.error(err);
        throw err;
      }

      executeStatement();
    });

    function executeStatement() {
      const request = new Request(
        `
          SELECT si.code SKU, SUM(sil.StkLevel) StockLevelSum, si.Description Description
          FROM StockItemsByLocation sil
                   INNER JOIN StockItemsValue siv ON siv.[Type] = 1 AND siv.[Level] = 1 AND siv.StockItemID = sil.StockItemID
                   INNER JOIN StockItems si ON si.ID = sil.StockItemID and Discontinue = 0
          WHERE siv.Value > 0
          GROUP BY si.code, si.Description 
              `,
        (err, rowCount) => {
          if (err) {
            logger.error("DB Request Failed");
            logger.error(err);
            throw err;
          }

          connection.close();
        }
      );

      // Emits a 'DoneInProc' event when completed.
      request.on("row", (columns) => {
        var sku = columns[0].value;
        var quantity = columns[1].value;
        var description = columns[2].value;
        returnData.push({ sku, quantity, description });
      });

      request.on("done", () => {
        resolve(returnData);
      });

      request.on("doneInProc", () => {
        resolve(returnData);
      });

      connection.execSql(request);
    }
  });

  promise.catch((err) => {
    logger.error("Error getting stock levels");
    logger.error(err);
  });

  return promise;
}
