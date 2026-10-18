/** Shapes returned by the GROQ projections in sanity/lib/queries.ts. */
import type { ApplicationChannel, City, Sector, WorkModel } from './company-taxonomy'
import type { CompanyEditFields } from './company-edit'
import type { SocialLinks } from './social-links'

export type LinkStatus = 'ok' | 'broken' | 'redirect' | 'suspect' | 'unchecked'
export type Pricing = 'free' | 'freemium' | 'paid'
export type Domain = 'developer' | 'designer' | 'general'
export type TagKind = 'tech' | 'topic' | 'language' | 'general'

/** Public profile fields (the safe, publicly-readable subset of a user). */
export interface PublicProfile {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  /** Profile links by platform (lib/social-links.ts). */
  social_links: SocialLinks | null
  /** Whether the user opted to show their email publicly. */
  show_email: boolean
}

/** Minimal profile for inline attribution (resource cards/modals). */
export interface PublicProfileCompact {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
}

/** The signed-in user's own editable profile (private columns included). */
export interface Profile extends PublicProfile {
  email: string | null
}

export interface CategoryRef {
  _id: string
  title: string
  slug: string
  domain?: Domain
}

export interface TagRef {
  _id: string
  title: string
  slug: string
  kind?: TagKind
}

export interface Resource {
  _id: string
  name: string
  slug: string
  url: string
  description?: string
  author?: string
  language: string[]
  pricing?: Pricing
  featured?: boolean
  addedAt?: string
  linkStatus?: LinkStatus
  /** User id of the community member who submitted it (if any). */
  submittedBy?: string
  categories: CategoryRef[]
  tags: TagRef[]
}

/**
 * A resource as list pages ship it: category and tag ids instead of the
 * objects (those were repeated in every one of ~500 resources, over a third
 * of the page). lib/expand-resources.ts turns it back into a Resource.
 */
export type CompactResource = Omit<Resource, 'categories' | 'tags'> & {
  categoryIds: string[] | null
  tagIds: string[] | null
}

export interface Category {
  _id: string
  title: string
  slug: string
  icon?: string
  description?: string
  domain?: Domain
  order?: number
  parentSlug?: string
  count: number
}

export interface Tag {
  _id: string
  title: string
  slug: string
  kind?: TagKind
  count: number
}

export type SubmissionStatus = 'pending' | 'approved' | 'rejected'

export type SubmissionKind = 'new' | 'fix' | 'taxonomy' | 'company' | 'companyEdit'

/** A user's own submission row (public.submissions mirror, RLS read-own). */
export interface Submission {
  id: string
  sanity_submission_id: string | null
  kind: SubmissionKind
  target_resource_id: string | null
  name: string | null
  url: string | null
  status: SubmissionStatus
  suggested_category: string | null
  pricing: Pricing | null
  tags: string[]
  proposed_categories: string[]
  proposed_tags: string[]
  proposed_description: string | null
  proposed_name: string | null
  proposed_url: string | null
  propose_removal: boolean
  original_categories: string[]
  original_tags: string[]
  original_description: string | null
  proposed_fields: CompanyEditFields | null
  original_fields: CompanyEditFields | null
  note: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string | null
}

/** A single resource plus its related resources (detail page query). */
export interface ResourceWithRelated extends Resource {
  related: Resource[]
}

/** A category with its resolved resource list (detail page query). */
export interface CategoryWithResources extends Omit<Category, 'count' | 'parentSlug'> {
  resources: Resource[]
}

export interface TagWithResources extends Omit<Tag, 'count'> {
  resources: Resource[]
}

/* ------------------------------ company directory ----------------------------- */

export interface Company {
  _id: string
  name: string
  slug: string
  website?: string
  linkedin?: string
  description?: string
  emails: string[]
  careerLinks: string[]
  channels: ApplicationChannel[]
  cities: City[]
  /** Free-text places outside the quick-pick cities ("Berlin, Germany"). */
  otherLocations: string[]
  workModels: WorkModel[]
  sectors: Sector[]
  clients: string[]
  addedAt?: string
  /** User id of the community member whose suggestion added it. */
  submittedBy?: string | null
}

export interface CompanyWithRelated extends Company {
  related: Company[]
}

/** A resource as the ⌘K palette needs it — the slim shape /api/search-index serves. */
export type ResourceHit = Pick<Resource, '_id' | 'name' | 'url' | 'featured' | 'author' | 'description'> & {
  categories: { title: string }[]
  tags: { title: string }[]
}

/** A company as the ⌘K palette needs it. */
export type CompanyHit = Pick<
  Company,
  '_id' | 'name' | 'slug' | 'website' | 'emails' | 'clients' | 'otherLocations'
>

export interface SearchIndex {
  resources: ResourceHit[]
  companies: CompanyHit[]
}

/** Public per-resource counts served by /api/counts. */
export interface ResourceCounts {
  clicks: Record<string, number>
  favorites: Record<string, number>
}

/** A published CV as listed in the directory (/api/cvs). The PDF itself is behind sign-in. */
export interface CvListing {
  id: string
  title: string
  field: string
  seniority: string
  language: string
  technologies: string[]
  summary: string | null
  likeCount: number
  publishedAt: string | null
  owner: { username: string | null; name: string | null; avatar: string | null }
}
