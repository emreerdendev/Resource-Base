import { defineField, defineType } from 'sanity'

import { CITIES, WORK_MODELS, studioOptions } from '../../lib/company-taxonomy'

/**
 * Community-suggested resource or company. Kept separate from `resource` /
 * `company` so the public submit endpoint only needs create access on this one
 * type and can never touch live content. An editor reviews, then approves.
 */
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
        ],
        layout: 'radio',
      },
      initialValue: 'new',
      readOnly: true,
    }),
    defineField({
      name: 'targetResourceId',
      title: 'Target resource (_id) — for fixes',
      type: 'string',
      description:
        'The resource this fix corrects. On approval the relevant fields are updated automatically.',
      readOnly: true,
      hidden: ({ parent }) => parent?.kind === 'new' || parent?.kind === 'company',
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
      hidden: ({ parent }) => parent?.kind !== 'company',
    }),
    defineField({
      name: 'companyCareerUrl',
      title: 'Career page / job board',
      type: 'url',
      hidden: ({ parent }) => parent?.kind !== 'company',
    }),
    defineField({
      name: 'companyLinkedin',
      title: 'LinkedIn',
      type: 'url',
      hidden: ({ parent }) => parent?.kind !== 'company',
    }),
    defineField({
      name: 'companyEmails',
      title: 'Application emails',
      type: 'array',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      description: 'Generic inboxes only — remove personal employee addresses before approving.',
      hidden: ({ parent }) => parent?.kind !== 'company',
    }),
    defineField({
      name: 'companyCities',
      title: 'Cities',
      type: 'array',
      of: [{ type: 'string' }],
      options: { list: studioOptions(CITIES), layout: 'grid' },
      hidden: ({ parent }) => parent?.kind !== 'company',
    }),
    defineField({
      name: 'companyOtherLocations',
      title: 'Other locations',
      type: 'array',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      description: 'Free-text places outside the quick-pick cities, e.g. "Berlin, Germany".',
      hidden: ({ parent }) => parent?.kind !== 'company',
    }),
    defineField({
      name: 'companyWorkModels',
      title: 'Work models',
      type: 'array',
      of: [{ type: 'string' }],
      options: { list: studioOptions(WORK_MODELS), layout: 'grid' },
      hidden: ({ parent }) => parent?.kind !== 'company',
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
          value || (ctx.parent as { kind?: string })?.kind === 'company'
            ? true
            : 'Required',
        ),
    }),
    defineField({ name: 'suggestedCategory', type: 'string' }),
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
    }),
    defineField({
      name: 'tags',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Free-text tag suggestions; editor maps them to real tags.',
      options: { layout: 'tags' },
    }),
    defineField({ name: 'note', type: 'text', rows: 3 }),
    defineField({ name: 'email', type: 'string' }),
    defineField({
      name: 'submittedBy',
      title: 'Submitted by (Supabase user id)',
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
      description:
        'Shown to the submitter so they can fix and resubmit. Only fill this when rejecting.',
      hidden: ({ parent }) => parent?.status !== 'rejected',
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
      return { title, subtitle: `[${status}] ${url}` }
    },
  },
})
