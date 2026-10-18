import 'server-only'

import { createClient } from '@sanity/client'

import { apiVersion, dataset, projectId } from '../env'

/**
 * Server-only write client. Carries the write token, so it must NEVER be
 * imported into a Client Component. Used by the migration script (via a
 * standalone client), /api/submit and the cron link-checker.
 */
export const writeClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  token: process.env.SANITY_API_WRITE_TOKEN,
  timeout: 15_000,
})
