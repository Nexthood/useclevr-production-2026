import type { RetailProvider } from "./normalized-types";
import type { RetailPOSConnector } from "./connector.interface";
import { SquareConnector } from "../providers/square/square.connector";

export function getRetailConnector(provider: RetailProvider): RetailPOSConnector {
  if (provider === "square") return new SquareConnector();
  throw new Error(`Unsupported retail provider: ${provider}`);
}
