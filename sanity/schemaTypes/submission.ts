import { defineField, defineType } from 'sanity'

import { CITIES, WORK_MODELS, studioOptions } from '../../lib/company-taxonomy'
import { CV_FIELDS, CV_LANGUAGES, CV_SENIORITIES, cvStudioOptions } from '../../lib/cv-taxonomy'

/**
 * Community-suggested resource, company or CV. Kept separate from `resource` /
 * `company` so the public submit endpoint only needs create access on this one
 * type and can never touch live content. An editor reviews, then approves.
 */
/** A suggestion for a new resource (older ones have no kind). */
const isNewResource = (parent: unknown) => {
  const kind = (parent as { kind?: string } | undefined)?.kind
  return !kind || kind === 'new'
}

export const submission = defineType({
  name: 'submission',
  title: 'Submission',
  type: 'document',
  fields: [
    defineField({
      name: 'kind',
      title: 'Submission type',
      type: 'string',
      options: {
        list: [
          { title: 'New resource', value: 'new' },
          { title: 'URL fix', value: 'fix' },
          { title: 'Category / tag fix', value: 'taxonomy' },
          { title: 'New company', value: 'company' },
          { title: 'Company edit', value: 'companyEdit' },
          { title: 'CV', value: 'cv' },
        ],
        layout: 'radio',
      },
      initialValue: 'new',
      readOnly: true,
    }),
    defineField({
      name: 'targetResourceId',
      title: 'Target document (_id) — for fixes and edits',
      type: 'string',
      description:
        'The resource or company this suggestion changes. On approval the relevant fields are updated automatically.',
      readOnly: true,
      hidden: ({ parent }) => !['fix', 'taxonomy', 'companyEdit'].includes(parent?.kind),
    }),
    defineField({
      name: 'proposedCategories',
      title: 'Proposed categories (slug or new title)',
      type: 'array',
      of: [{ type: 'string' }],
      description:
        'For taxonomy fixes. Existing category slugs are applied automatically; unrecognized values are left for you to add.',
      options: { layout: 'tags' },
      hidden: ({ parent }) => parent?.kind !== 'taxonomy',
    }),
    defineField({
      name: 'proposedTags',
      title: 'Proposed tags (slug or new title)',
      type: 'array',
      of: [{ type: 'string' }],
      description:
        'For taxonomy fixes. Existing tag slugs are applied automatically; unrecognized values are left for you to add.',
      options: { layout: 'tags' },
      hidden: ({ parent }) => parent?.kind !== 'taxonomy',
    }),
    defineField({
      name: 'proposeRemoval',
      title: 'Reported as gone / should be removed',
      type: 'boolean',
      description:
        'The submitter says this resource no longer exists. Approving hides it from the directory (status → Removed); undo by setting it back to Published.',
      readOnly: true,
      hidden: ({ parent }) =>
        !['taxonomy', 'companyEdit'].includes(parent?.kind) || !parent?.proposeRemoval,
    }),
    defineField({
      name: 'clearFields',
      title: 'Fields to clear',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Company edits: links/emails the submitter says should be removed (cleared on approval).',
      options: { layout: 'tags' },
      readOnly: true,
      hidden: ({ parent }) => parent?.kind !== 'companyEdit' || !parent?.clearFields?.length,
    }),
    defineField({
      name: 'proposedName',
      title: 'Proposed name',
      type: 'string',
      description: 'Applied to the resource or company on approval.',
      hidden: ({ parent }) =>
        !['taxonomy', 'companyEdit'].includes(parent?.kind) || !parent?.proposedName,
    }),
    defineField({
      name: 'proposedUrl',
      title: 'Proposed link',
      type: 'url',
      description: 'Applied to the resource on approval (its link status is reset).',
      hidden: ({ parent }) => parent?.kind !== 'taxonomy' || !parent?.proposedUrl,
    }),
    defineField({
      name: 'proposedDescription',
      title: 'Proposed description',
      type: 'text',
      rows: 3,
      description:
        'For taxonomy fixes. The submitter’s suggested description — review and apply to the resource on approval.',
      hidden: ({ parent }) => parent?.kind !== 'taxonomy',
    }),
    defineField({
      name: 'originalDescription',
      title: 'Original description (at submit time)',
      type: 'text',
      rows: 3,
      readOnly: true,
      hidden: ({ parent }) => parent?.kind !== 'taxonomy',
    }),
    defineField({
      name: 'originalCategories',
      title: 'Original categories (slugs at submit time)',
      type: 'array',
      of: [{ type: 'string' }],
      readOnly: true,
      hidden: ({ parent }) => parent?.kind !== 'taxonomy',
    }),
    defineField({
      name: 'originalTags',
      title: 'Original tags (slugs at submit time)',
      type: 'array',
      of: [{ type: 'string' }],
      readOnly: true,
      hidden: ({ parent }) => parent?.kind !== 'taxonomy',
    }),
    // --- Company suggestions (kind "company"). Review/edit these, then set
    // the status to Approved: the company is created automatically. ---
    defineField({
      name: 'companyWebsite',
      title: 'Company website',
      type: 'url',
      hidden: ({ parent }) => parent?.kind !== 'company' && parent?.kind !== 'companyEdit',
    }),
    defineField({
      name: 'companyCareerUrl',
      title: 'Career page / job board',
      type: 'url',
      hidden: ({ parent }) => parent?.kind !== 'company' && parent?.kind !== 'companyEdit',
    }),
    defineField({
      name: 'companyLinkedin',
      title: 'LinkedIn',
      type: 'url',
      hidden: ({ parent }) => parent?.kind !== 'company' && parent?.kind !== 'companyEdit',
    }),
    defineField({
      name: 'companyEmails',
      title: 'Application emails',
      type: 'array',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      description: 'Generic inboxes only — remove personal employee addresses before approving.',
      hidden: ({ parent }) => parent?.kind !== 'company' && parent?.kind !== 'companyEdit',
    }),
    defineField({
      name: 'companyCities',
      title: 'Cities',
      type: 'array',
      of: [{ type: 'string' }],
      options: { list: studioOptions(CITIES), layout: 'grid' },
      hidden: ({ parent }) => parent?.kind !== 'company' && parent?.kind !== 'companyEdit',
    }),
    defineField({
      name: 'companyOtherLocations',
      title: 'Other locations',
      type: 'array',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      description: 'Free-text places outside the quick-pick cities, e.g. "Berlin, Germany".',
      hidden: ({ parent }) => parent?.kind !== 'company' && parent?.kind !== 'companyEdit',
    }),
    defineField({
      name: 'companyWorkModels',
      title: 'Work models',
      type: 'array',
      of: [{ type: 'string' }],
      options: { list: studioOptions(WORK_MODELS), layout: 'grid' },
      hidden: ({ parent }) => parent?.kind !== 'company' && parent?.kind !== 'companyEdit',
    }),
    defineField({
      name: 'cvFileUrl',
      title: 'CV file (PDF)',
      type: 'url',
      description:
        'Private review link, valid for 30 days. Check it is a real CV with no offensive or unrelated content, then approve to publish it (signed-in users only).',
      readOnly: true,
      hidden: ({ parent }) => parent?.kind !== 'cv',
    }),
    defineField({
      name: 'cvId',
      title: 'CV id',
      type: 'string',
      readOnly: true,
      hidden: ({ parent }) => parent?.kind !== 'cv',
    }),
    defineField({
      name: 'cvField',
      title: 'Field',
      type: 'string',
      options: { list: cvStudioOptions(CV_FIELDS) },
      readOnly: true,
      hidden: ({ parent }) => parent?.kind !== 'cv',
    }),
    defineField({
      name: 'cvSeniority',
      title: 'Seniority',
      type: 'string',
      options: { list: cvStudioOptions(CV_SENIORITIES) },
      readOnly: true,
      hidden: ({ parent }) => parent?.kind !== 'cv',
    }),
    defineField({
      name: 'cvLanguage',
      title: 'CV language',
      type: 'string',
      options: { list: cvStudioOptions(CV_LANGUAGES) },
      readOnly: true,
      hidden: ({ parent }) => parent?.kind !== 'cv',
    }),
    defineField({
      name: 'cvTechnologies',
      title: 'Technologies',
      type: 'array',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      readOnly: true,
      hidden: ({ parent }) => parent?.kind !== 'cv',
    }),
    defineField({
      name: 'name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'url',
      type: 'url',
      validation: (rule) =>
        rule.uri({ scheme: ['http', 'https'] }).custom((value, ctx) =>
          value || ['company', 'companyEdit', 'cv'].includes((ctx.parent as { kind?: string })?.kind ?? '')
            ? true
            : 'Required',
        ),
      hidden: ({ parent }) => parent?.kind === 'cv',
    }),
    defineField({
      name: 'suggestedCategory',
      type: 'string',
      // Only a new resource suggests these three.
      hidden: ({ parent }) => !isNewResource(parent),
    }),
    defineField({
      name: 'pricing',
      type: 'string',
      options: {
        list: [
          { title: 'Free', value: 'free' },
          { title: 'Freemium', value: 'freemium' },
          { title: 'Paid', value: 'paid' },
        ],
        layout: 'radio',
      },
      description: 'Suggested pricing — the submitter’s hint for the editor.',
      hidden: ({ parent }) => !isNewResource(parent),
    }),
    defineField({
      name: 'tags',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Free-text tag suggestions; matched to existing tags on approval.',
      options: { layout: 'tags' },
      hidden: ({ parent }) => !isNewResource(parent),
    }),
    defineField({ name: 'note', type: 'text', rows: 3 }),
    defineField({ name: 'email', type: 'string' }),
    defineField({
      name: 'submittedBy',
      title: 'Submitted by (user id)',
      type: 'string',
      description:
        'Set automatically when a signed-in user submits. Used to notify them on approval.',
      readOnly: true,
    }),
    defineField({
      name: 'status',
      type: 'string',
      options: {
        list: [
          { title: 'Pending', value: 'pending' },
          { title: 'Approved', value: 'approved' },
          { title: 'Rejected', value: 'rejected' },
        ],
        layout: 'radio',
      },
      initialValue: 'pending',
    }),
    defineField({
      name: 'rejectionReason',
      title: 'Rejection reason',
      type: 'text',
      rows: 2,
      description: 'Shown to the submitter so they can fix and resubmit.',
      hidden: ({ parent }) => parent?.status !== 'rejected',
      // A rejection without a reason leaves the submitter guessing.
      validation: (rule) =>
        rule.custom((value, ctx) =>
          (ctx.parent as { status?: string })?.status === 'rejected' && !String(value ?? '').trim()
            ? 'Add a reason when rejecting'
            : true,
        ),
    }),
    defineField({
      name: 'createdAt',
      type: 'datetime',
      readOnly: true,
    }),
  ],
  orderings: [
    {
      title: 'Newest',
      name: 'createdDesc',
      by: [{ field: 'createdAt', direction: 'desc' }],
    },
  ],
  preview: {
    select: { title: 'name', url: 'url', status: 'status' },
    prepare({ title, url, status }) {
      return { title, subtitle: `[${status}] ${url ?? ''}` }
    },
  },
})
