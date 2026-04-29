"use server"

import { PRODUCTS, type ProductId } from "@/lib/products"

export async function createCheckoutSession(productId: ProductId) {
  const product = PRODUCTS[productId]
  if (!product) {
    throw new Error(`Product with id "${productId}" not found`)
  }

  throw new Error("BILLING_DISABLED")
}

export async function getCheckoutSession(_sessionId: string) {
  return null
}
