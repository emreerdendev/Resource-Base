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
 * A single published resource by slug, plus up to 6 "suggested" resources.
 * Categories come in pairs (a broad parent like "Design Assets" + a specific
 * subcategory like "Icons"), so a shared parent alone says little: a candidate
 * must share a tag or a subcategory — or, for a resource with no subcategory,
 * a parent. Ranked by overlap (tag and subcategory 3, parent 1), then
 * featured/recency. Broken links are never suggested.
 */
export const resourceBySlugQuery = groq`
  *[${PUBLISHED} && slug.current == $slug][0] {
    ${RESOURCE_FIELDS},
    "related": *[
      ${PUBLISHED} && slug.current != ^.slug.current && linkStatus != "broken" &&
      (count(tags[@._ref in ^.^.tags[]._ref]) > 0 ||
       count(categories[@._ref in ^.^.categories[]._ref && defined(@->parent)]) > 0 ||
       (count(^.categories[defined(@->parent)]) == 0 &&
        count(categories[@._ref in ^.^.categories[]._ref]) > 0))
    ] {
      ${RESOURCE_FIELDS},
      "_score": count(tags[@._ref in ^.^.tags[]._ref]) * 3 +
                count(categories[@._ref in ^.^.categories[]._ref && defined(@->parent)]) * 3 +
                count(categories[@._ref in ^.^.categories[]._ref && !defined(@->parent)])
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
  addedAt,
  submittedBy
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

/**
 * A company by slug plus candidates for "Similar Companies": others sharing a
 * sector, a known client or a location (a shared work model only adds to the
 * score). Ranked by overlap; equal scores are shuffled per company by
 * `rankRelatedCompanies`, so the top 24 are fetched and trimmed to 6 there.
 */
export const companyBySlugQuery = groq`
  *[${PUBLISHED_COMPANY} && slug.current == $slug][0] {
    ${COMPANY_FIELDS},
    "related": *[
      ${PUBLISHED_COMPANY} && slug.current != ^.slug.current &&
      (count(sectors[@ in ^.^.sectors]) > 0 ||
       count(clients[@ in ^.^.clients]) > 0 ||
       count(cities[@ in ^.^.cities]) > 0 ||
       count(otherLocations[@ in ^.^.otherLocations]) > 0)
    ] {
      ${COMPANY_FIELDS},
      "_score": count(sectors[@ in ^.^.sectors]) * 4 +
                count(clients[@ in ^.^.clients]) * 3 +
                count(cities[@ in ^.^.cities]) * 2 +
                count(otherLocations[@ in ^.^.otherLocations]) * 2 +
                count(workModels[@ in ^.^.workModels])
    } | order(_score desc)[0...24]
  }
`

/**
 * The ⌘K palette's dataset, served by /api/search-index and fetched only when
 * the palette opens — so pages no longer carry every resource and company.
 */
export const searchIndexQuery = groq`{
  "resources": *[${PUBLISHED}] | order(featured desc, addedAt desc) {
    _id, name, url, featured, author,
    description,
    "categories": coalesce(categories[]->{ title }, []),
    "tags": coalesce(tags[]->{ title }, [])
  },
  "companies": *[${PUBLISHED_COMPANY}] | order(name asc) {
    _id, name, "slug": slug.current, website,
    "emails": coalesce(emails, []),
    "clients": coalesce(clients, []),
    "otherLocations": coalesce(otherLocations, [])
  }
}`
