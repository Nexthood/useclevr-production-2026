import { PayloadListInfo as PayloadListInfo_7ff3c83942f86e4d0dadc6be04c1c4b5 } from '@/components/payload/payload-admin-shell'
import { PayloadListSubheader as PayloadListSubheader_7ff3c83942f86e4d0dadc6be04c1c4b5 } from '@/components/payload/payload-admin-shell'
import { PayloadAdminLogo as PayloadAdminLogo_79108ba5474e00f2abe107cc5c104d5d } from '@/components/payload/payload-auth-brand'
import { PayloadAiActions as PayloadAiActions_dbf5d2e1a2c63efdf8749ecb7188a404 } from '@/components/payload/payload-operational-views'
import { PayloadDashboardInfo as PayloadDashboardInfo_7ff3c83942f86e4d0dadc6be04c1c4b5 } from '@/components/payload/payload-admin-shell'
import { PayloadDashboardLink as PayloadDashboardLink_79108ba5474e00f2abe107cc5c104d5d } from '@/components/payload/payload-auth-brand'
import { PayloadNavFooter as PayloadNavFooter_6b1b1dd6fd36290f2f0f6400feddc22f } from '@/components/payload/payload-admin-shell-footer'
import { PayloadDashboardHeader as PayloadDashboardHeader_7ff3c83942f86e4d0dadc6be04c1c4b5 } from '@/components/payload/payload-admin-shell'
import { PayloadLoginIntro as PayloadLoginIntro_79108ba5474e00f2abe107cc5c104d5d } from '@/components/payload/payload-auth-brand'
import { PayloadNavHeader as PayloadNavHeader_7ff3c83942f86e4d0dadc6be04c1c4b5 } from '@/components/payload/payload-admin-shell'
import { PayloadTopbarControls as PayloadTopbarControls_ccaa8d67890e18386724baa0235420bd } from '@/components/payload/payload-admin-topbar'
import { PayloadOperationsNav as PayloadOperationsNav_dbf5d2e1a2c63efdf8749ecb7188a404 } from '@/components/payload/payload-operational-views'
import { PayloadAdminManagementNav as PayloadAdminManagementNav_96e0e6f616a3208171d6014b12ca05e3 } from '@/components/payload/payload-admin-management-views'
import { S3ClientUploadHandler as S3ClientUploadHandler_f97aa6c64367fa259c5bc0567239ef24 } from '@payloadcms/storage-s3/client'
import { PayloadLoginView as PayloadLoginView_9e5a627ba22dd05b94f8b7e4f50bfcdb } from '@/components/payload/payload-login-view'
import { PayloadBusinessProfilesView as PayloadBusinessProfilesView_dbf5d2e1a2c63efdf8749ecb7188a404 } from '@/components/payload/payload-operational-views'
import { PayloadAccountancyView as PayloadAccountancyView_dbf5d2e1a2c63efdf8749ecb7188a404 } from '@/components/payload/payload-operational-views'
import { PayloadDatasetsView as PayloadDatasetsView_dbf5d2e1a2c63efdf8749ecb7188a404 } from '@/components/payload/payload-operational-views'
import { PayloadDatasetUploadView as PayloadDatasetUploadView_dbf5d2e1a2c63efdf8749ecb7188a404 } from '@/components/payload/payload-operational-views'
import { PayloadCustomersView as PayloadCustomersView_96e0e6f616a3208171d6014b12ca05e3 } from '@/components/payload/payload-admin-management-views'
import { PayloadDiscountsView as PayloadDiscountsView_96e0e6f616a3208171d6014b12ca05e3 } from '@/components/payload/payload-admin-management-views'
import { PayloadLevelsView as PayloadLevelsView_96e0e6f616a3208171d6014b12ca05e3 } from '@/components/payload/payload-admin-management-views'
import { PayloadProgressView as PayloadProgressView_96e0e6f616a3208171d6014b12ca05e3 } from '@/components/payload/payload-admin-management-views'
import { CollectionCards as CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1 } from '@payloadcms/next/rsc'

/** @type import('payload').ImportMap */
export const importMap = {
  "@/components/payload/payload-admin-shell#PayloadListInfo": PayloadListInfo_7ff3c83942f86e4d0dadc6be04c1c4b5,
  "@/components/payload/payload-admin-shell#PayloadListSubheader": PayloadListSubheader_7ff3c83942f86e4d0dadc6be04c1c4b5,
  "@/components/payload/payload-auth-brand#PayloadAdminLogo": PayloadAdminLogo_79108ba5474e00f2abe107cc5c104d5d,
  "@/components/payload/payload-operational-views#PayloadAiActions": PayloadAiActions_dbf5d2e1a2c63efdf8749ecb7188a404,
  "@/components/payload/payload-admin-shell#PayloadDashboardInfo": PayloadDashboardInfo_7ff3c83942f86e4d0dadc6be04c1c4b5,
  "@/components/payload/payload-auth-brand#PayloadDashboardLink": PayloadDashboardLink_79108ba5474e00f2abe107cc5c104d5d,
  "@/components/payload/payload-admin-shell-footer#PayloadNavFooter": PayloadNavFooter_6b1b1dd6fd36290f2f0f6400feddc22f,
  "@/components/payload/payload-admin-shell#PayloadDashboardHeader": PayloadDashboardHeader_7ff3c83942f86e4d0dadc6be04c1c4b5,
  "@/components/payload/payload-auth-brand#PayloadLoginIntro": PayloadLoginIntro_79108ba5474e00f2abe107cc5c104d5d,
  "@/components/payload/payload-admin-shell#PayloadNavHeader": PayloadNavHeader_7ff3c83942f86e4d0dadc6be04c1c4b5,
  "@/components/payload/payload-admin-topbar#PayloadTopbarControls": PayloadTopbarControls_ccaa8d67890e18386724baa0235420bd,
  "@/components/payload/payload-operational-views#PayloadOperationsNav": PayloadOperationsNav_dbf5d2e1a2c63efdf8749ecb7188a404,
  "@/components/payload/payload-admin-management-views#PayloadAdminManagementNav": PayloadAdminManagementNav_96e0e6f616a3208171d6014b12ca05e3,
  "@payloadcms/storage-s3/client#S3ClientUploadHandler": S3ClientUploadHandler_f97aa6c64367fa259c5bc0567239ef24,
  "@/components/payload/payload-login-view#PayloadLoginView": PayloadLoginView_9e5a627ba22dd05b94f8b7e4f50bfcdb,
  "@/components/payload/payload-operational-views#PayloadBusinessProfilesView": PayloadBusinessProfilesView_dbf5d2e1a2c63efdf8749ecb7188a404,
  "@/components/payload/payload-operational-views#PayloadAccountancyView": PayloadAccountancyView_dbf5d2e1a2c63efdf8749ecb7188a404,
  "@/components/payload/payload-operational-views#PayloadDatasetsView": PayloadDatasetsView_dbf5d2e1a2c63efdf8749ecb7188a404,
  "@/components/payload/payload-operational-views#PayloadDatasetUploadView": PayloadDatasetUploadView_dbf5d2e1a2c63efdf8749ecb7188a404,
  "@/components/payload/payload-admin-management-views#PayloadCustomersView": PayloadCustomersView_96e0e6f616a3208171d6014b12ca05e3,
  "@/components/payload/payload-admin-management-views#PayloadDiscountsView": PayloadDiscountsView_96e0e6f616a3208171d6014b12ca05e3,
  "@/components/payload/payload-admin-management-views#PayloadLevelsView": PayloadLevelsView_96e0e6f616a3208171d6014b12ca05e3,
  "@/components/payload/payload-admin-management-views#PayloadProgressView": PayloadProgressView_96e0e6f616a3208171d6014b12ca05e3,
  "@payloadcms/next/rsc#CollectionCards": CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1
}
