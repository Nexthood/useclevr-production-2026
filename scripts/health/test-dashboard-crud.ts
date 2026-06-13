import { ensureBuiltinUserRecord } from "../../src/lib/auth/builtin-user-store"
import {
  archiveBusiness,
  deleteBusiness,
  getBusinessDetailsById,
  restoreBusiness,
  upsertBusinessDetails,
} from "../../src/lib/business/business-store"

const ownerId = "base-user-id"
const otherUserId = "demo-user-id"

async function main() {
  await ensureBuiltinUserRecord(ownerId)
  await ensureBuiltinUserRecord(otherUserId)

  const businessId = await upsertBusinessDetails(ownerId, "new", {
    businessName: "CRUD verification",
    businessEmail: "crud@example.invalid",
    industry: "Testing",
    location: "Amsterdam",
    website: "https://example.invalid",
    businessDescription: "Temporary dashboard persistence verification record",
  })

  try {
    const created = await getBusinessDetailsById(ownerId, businessId)
    if (created.businessName !== "CRUD verification") throw new Error("Business creation failed.")

    await upsertBusinessDetails(ownerId, businessId, {
      ...created,
      businessName: "CRUD verification updated",
    })

    const updated = await getBusinessDetailsById(ownerId, businessId)
    if (updated.businessName !== "CRUD verification updated") throw new Error("Business update failed.")
    if (await archiveBusiness(otherUserId, businessId)) throw new Error("Cross-user archive was allowed.")
    if (!(await archiveBusiness(ownerId, businessId))) throw new Error("Business archive failed.")
    if (!(await restoreBusiness(ownerId, businessId))) throw new Error("Business restore failed.")
    if (await deleteBusiness(ownerId, businessId)) throw new Error("Active business deletion was allowed.")
    if (!(await archiveBusiness(ownerId, businessId))) throw new Error("Second business archive failed.")
    if (await deleteBusiness(otherUserId, businessId)) throw new Error("Cross-user deletion was allowed.")
    if (!(await deleteBusiness(ownerId, businessId))) throw new Error("Business deletion failed.")

    const removed = await getBusinessDetailsById(ownerId, businessId)
    if (removed.businessName) throw new Error("Deleted business remains available.")

    console.log("Dashboard business CRUD ownership verification passed.")
  } finally {
    await archiveBusiness(ownerId, businessId)
    await deleteBusiness(ownerId, businessId)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
