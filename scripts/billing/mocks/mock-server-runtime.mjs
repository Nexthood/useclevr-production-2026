/**
 * Empty stand-in for browser/renderer-only modules (`server-only`,
 * `next/cache`) that throw or need a Next.js runtime when imported by
 * behavioral tests.
 */

export const revalidatePath = () => {}
export const revalidateTag = () => {}
export const unstable_noStore = () => {}
