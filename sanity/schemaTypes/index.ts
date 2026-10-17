import type { SchemaTypeDefinition } from 'sanity'

import { category } from './category'
import { tag } from './tag'
import { resource } from './resource'
import { submission } from './submission'
import { company } from './company'
import { accountRequest } from './account-request'

export const schemaTypes: SchemaTypeDefinition[] = [
  category,
  tag,
  resource,
  submission,
  company,
  accountRequest,
]
