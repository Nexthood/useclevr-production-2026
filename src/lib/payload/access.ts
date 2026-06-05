import type { Access, CollectionConfig, GlobalConfig } from "payload"

type CmsUser = {
  role?: "base" | "superadmin"
}

export const isCmsUser: Access = ({ req }) => Boolean(req.user)

export const isCmsSuperAdmin: Access = ({ req }) => {
  const user = req.user as CmsUser | null | undefined
  return user?.role === "superadmin"
}

export const publishedOrCmsUser: Access = ({ req }) => {
  if (req.user) {
    return true
  }

  return {
    _status: {
      equals: "published",
    },
  }
}

export function withCollectionGroup<T extends CollectionConfig>(config: T, group = "CMS"): T {
  return {
    ...config,
    admin: {
      ...config.admin,
      group,
    },
  }
}

export function withGlobalLabel<T extends GlobalConfig>(config: T, group = "Pages"): T {
  return {
    ...config,
    admin: {
      ...config.admin,
      group,
    },
  }
}
