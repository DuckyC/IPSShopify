import { createGraphQLClient } from "@shopify/graphql-client";
import config from "./config";
import {getLogger} from "./logging";

export default class ShopifyGQL {
  private client;
  private logger = getLogger();

  constructor() {
    this.client = createGraphQLClient({
      url:
        "https://" +
        config.shopify.shop_url +
        "/admin/api/2024-10/graphql.json",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": config.shopify.access_token,
      },
    });
  }

  async getInventoryLevels(): Promise<InventoryLevel[]> {
    var nodes: InventoryLevel[] = [];
    var pageInfo = null;

    do {
      var resp: any = await this.client.request(
        `query inventoryLevels($locationId: ID!, $cursor: String) {
                    inventoryItems(first: 250, after: $cursor) {
                        edges {
                            node {
                                id
                                tracked
                                sku
                                variant {
                                    product {
                                        status
                                    }
                                }
                                inventoryLevel(locationId: $locationId) {
                                    quantities(names: ["on_hand"]) {
                                        name
                                        quantity
                                    }
                                }
                            }   
                        }
                        pageInfo {
                            hasNextPage
                            endCursor
                        }
                    }
                    }`,
        {
          variables: {
            locationId: config.shopify.location_id,
            cursor: pageInfo?.endCursor,
          },
        }
      );

      this.logger.debug(resp)

      nodes.push(
        ...resp.data.inventoryItems.edges.map((edge: any) => {
          return {
            id: edge.node.id,
            sku: edge.node.sku,
            quantity: edge.node.inventoryLevel.quantities[0].quantity,
            acrhived: edge.node.variant.product.status === "ARCHIVED",
            tracked: edge.node.tracked
          };
        })
      );

      pageInfo = resp.data.inventoryItems.pageInfo;
      this.logger.debug(
        "Got inventory items",
        nodes.length,
        "next page",
        pageInfo.hasNextPage
      );
    } while (pageInfo.hasNextPage);

    return nodes;
  }

  async setInventoryLevel(
    inventoryItemId: string,
    quantity: number,
    compareQuantity: Number
  ) {
    var resp = await this.client.request(
      `mutation setInventoryOnHand($locationId: ID!, $inventoryItemId: ID!, $quantity: Int!, $compareQuantity: Int!) {
            inventorySetQuantities(
                input: {
                    name: "on_hand", 
                    ignoreCompareQuantity: false, 
                    reason: "correction", 
                    quantities: [
                        {
                            inventoryItemId: $inventoryItemId, 
                            locationId: $locationId, 
                            quantity: $quantity, 
                            compareQuantity: $compareQuantity
                        }
                    ]
                }
            ) {
                userErrors {
                    message
                    code
                    field
                }
            }
        }`,
      {
        variables: {
          locationId: config.shopify.location_id,
          inventoryItemId,
          quantity,
          compareQuantity,
        },
      }
    );

    if(resp.errors) {
      this.logger.debug(resp);
      throw new Error("Error setting inventory level");
    }

    if (resp.data.inventorySetQuantities.userErrors.length > 0) {
      this.logger.error(
        "Error setting inventory level",
        resp.data.inventorySetQuantities.userErrors
      );
      this.logger.debug(resp);
      throw new Error("Error setting inventory level");
    }
  }

  async markAsTracked(inventoryItemId: string) {
    var resp = await this.client.request(
      `mutation MarkAsTracked($inventoryItemId: ID!) {
        inventoryItemUpdate(
          id: $inventoryItemId,
          input: {tracked: true}
        ) {
          inventoryItem {
            id
            tracked
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          inventoryItemId,
        },
      }
    );

    if (resp.data.inventoryItemUpdate.userErrors.length > 0) {
      this.logger.error(
        "Error marking inventory item as tracked",
        resp.data.inventoryItemUpdate.userErrors
      );
      this.logger.debug(resp);
      throw new Error("Error marking inventory item as tracked");
    }
  }
}

interface InventoryLevel {
  id: string;
  sku: string;
  quantity: number;
  acrhived: boolean;
  tracked: boolean;
}
