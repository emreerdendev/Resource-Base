import { groq } from 'next-sanity'

/** Projection shared by every resource query. */
const RESOURCE_FIELDS = groq`
  _id,
  name,
  "slug": slug.current,
  url,
  description,
  author,
  language,
  pricing,
  featured,
  addedAt,
  linkStatus,
  submittedBy,
  "categories": categories[]->{ _id, title, "slug": slug.current, domain },
  "tags": tags[]->{ _id, title, "slug": slug.current, kind }
`

const PUBLISHED = groq`_type == "resource" && submissionStatus == "published"`

/** Every published resource — the dataset the client-side search indexes. */
export const allResourcesQuery = groq`
  *[${PUBLISHED}] | order(featured desc, addedAt desc) {
    ${RESOURCE_FIELDS}
  }
`

/** Published resources contributed by a given Supabase user id. */
export const resourcesBySubmitterQuery = groq`
  *[${PUBLISHED} && submittedBy == $userId] | order(addedAt desc) {
    ${RESOURCE_FIELDS}
  }
`

export const featuredResourcesQuery = groq`
  *[${PUBLISHED} && featured == true] | order(addedAt desc)[0...12] {
    ${RESOURCE_FIELDS}
  }
`

/** All categories, with parent reference resolved to a slug for tree building. */
export const allCategoriesQuery = groq`
  *[_type == "category"] | order(order asc, title asc) {
    _id,
    title,
    "slug": slug.current,
    icon,
    description,
    domain,
    order,
    "parentSlug": parent->slug.current,
    "count": count(*[${PUBLISHED} && references(^._id)])
  }
`

export const allTagsQuery = groq`
  *[_type == "tag"] | order(title asc) {
    _id,
    title,
    "slug": slug.current,
    kind,
    "count": count(*[${PUBLISHED} && references(^._id)])
  }
`

export const categoryBySlugQuery = groq`
  *[_type == "category" && slug.current == $slug][0] {
    _id, title, "slug": slug.current, icon, description, domain,
    "resources": *[${PUBLISHED} && references(^._id)] | order(featured desc, name asc) {
      ${RESOURCE_FIELDS}
    }
  }
`

export const tagBySlugQuery = groq`
  *[_type == "tag" && slug.current == $slug][0] {
    _id, title, "slug": slug.current, kind,
    "resources": *[${PUBLISHED} && references(^._id)] | order(featured desc, name asc) {
      ${RESOURCE_FIELDS}
    }
  }
`

export const categorySlugsQuery = groq`*[_type == "category" && defined(slug.current)].slug.current`
export const tagSlugsQuery = groq`*[_type == "tag" && defined(slug.current)].slug.current`
export const resourceSlugsQuery = groq`*[${PUBLISHED} && defined(slug.current)].slug.current`
export const resourceIdsQuery = groq`*[${PUBLISHED}]._id`

/**
 * A single published resource by slug, plus "suggested" resources: others that
 * share at least one category OR tag, ranked by how many they share (tag
 * overlap weighted higher than category, since tags are more specific), then by
 * featured/recency. Top 6.
 */
export const resourceBySlugQuery = groq`
  *[${PUBLISHED} && slug.current == $slug][0] {
    ${RESOURCE_FIELDS},
    "related": *[
      ${PUBLISHED} && slug.current != ^.slug.current &&
      (count(categories[@._ref in ^.^.categories[]._ref]) > 0 ||
       count(tags[@._ref in ^.^.tags[]._ref]) > 0)
    ] {
      ${RESOURCE_FIELDS},
      "_score": count(tags[@._ref in ^.^.tags[]._ref]) * 2 +
                count(categories[@._ref in ^.^.categories[]._ref])
    } | order(_score desc, featured desc, addedAt desc)[0...6]
  }
`

/* ------------------------------ company directory ----------------------------- */

const COMPANY_FIELDS = groq`
  _id,
  name,
  "slug": slug.current,
  website,
  linkedin,
  description,
  "emails": coalesce(emails, []),
  "careerLinks": coalesce(careerLinks, []),
  "channels": coalesce(channels, []),
  "cities": coalesce(cities, []),
  "otherLocations": coalesce(otherLocations, []),
  "workModels": coalesce(workModels, []),
  "sectors": coalesce(sectors, []),
  "clients": coalesce(clients, []),
  addedAt
`

const PUBLISHED_COMPANY = groq`_type == "company" && status == "published" && defined(slug.current)`

/** Every published company — the (small) set the directory searches client-side. */
export const allCompaniesQuery = groq`
  *[${PUBLISHED_COMPANY}] | order(name asc) {
    ${COMPANY_FIELDS}
  }
`

export const companySlugsQuery = groq`*[${PUBLISHED_COMPANY}].slug.current`
export const companyIdsQuery = groq`*[${PUBLISHED_COMPANY}]._id`

/** A company by slug plus a few others sharing a sector or city. */
export const companyBySlugQuery = groq`
  *[${PUBLISHED_COMPANY} && slug.current == $slug][0] {
    ${COMPANY_FIELDS},
    "related": *[
      ${PUBLISHED_COMPANY} && slug.current != ^.slug.current &&
      (count(sectors[@ in ^.^.sectors]) > 0)
    ] {
      ${COMPANY_FIELDS},
      "_score": count(sectors[@ in ^.^.sectors]) * 2 + count(cities[@ in ^.^.cities])
    } | order(_score desc, name asc)[0...6]
  }
`
