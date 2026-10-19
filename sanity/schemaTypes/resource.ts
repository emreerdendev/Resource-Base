import { defineField, defineType } from 'sanity'

/**
 * The core document: a single resource link.
 * Multi-category + multi-tag via references. Two grouped concerns the editor
 * cares about day-to-day: link health (fix a broken URL in seconds) and
 * moderation status.
 */
export const resource = defineType({
  name: 'resource',
  title: 'Resource',
  type: 'document',
  groups: [
    { name: 'content', title: 'Content', default: true },
    { name: 'taxonomy', title: 'Taxonomy' },
    { name: 'health', title: 'Link health' },
    { name: 'moderation', title: 'Moderation' },
  ],
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      group: 'content',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      group: 'content',
      options: { source: 'name', maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'url',
      type: 'url',
      group: 'content',
      validation: (rule) =>
        rule.required().uri({ scheme: ['http', 'https'] }),
    }),
    defineField({
      name: 'description',
      type: 'text',
      rows: 3,
      group: 'content',
    }),
    defineField({
      name: 'author',
      title: 'Author / source',
      type: 'string',
      group: 'content',
      description: 'e.g. the GitHub owner for a repo resource.',
    }),
    defineField({
      name: 'categories',
      type: 'array',
      group: 'taxonomy',
      of: [{ type: 'reference', to: [{ type: 'category' }] }],
      validation: (rule) => rule.min(1).unique(),
    }),
    defineField({
      name: 'tags',
      type: 'array',
      group: 'taxonomy',
      of: [{ type: 'reference', to: [{ type: 'tag' }] }],
      validation: (rule) => rule.unique(),
    }),
    defineField({
      name: 'language',
      type: 'array',
      group: 'taxonomy',
      of: [{ type: 'string' }],
      options: {
        list: [
          { title: 'English', value: 'en' },
          { title: 'Turkish', value: 'tr' },
        ],
      },
      initialValue: ['en'],
    }),
    defineField({
      name: 'pricing',
      type: 'string',
      group: 'content',
      options: {
        list: [
          { title: 'Free', value: 'free' },
          { title: 'Free option', value: 'freemium' },
          { title: 'Paid', value: 'paid' },
        ],
        layout: 'radio',
      },
      initialValue: 'free',
    }),
    defineField({
      name: 'featured',
      type: 'boolean',
      group: 'content',
      initialValue: false,
    }),
    defineField({
      name: 'addedAt',
      type: 'datetime',
      group: 'content',
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: 'clicks',
      type: 'number',
      group: 'content',
      readOnly: true,
      initialValue: 0,
    }),

    // --- Link health (cron writes here; editors fix broken URLs fast) ---
    defineField({
      name: 'linkStatus',
      type: 'string',
      group: 'health',
      options: {
        list: [
          { title: 'OK', value: 'ok' },
          { title: 'Broken', value: 'broken' },
          { title: 'Redirect', value: 'redirect' },
          { title: 'Suspect (403/429)', value: 'suspect' },
          { title: 'Unchecked', value: 'unchecked' },
        ],
        layout: 'radio',
      },
      initialValue: 'unchecked',
    }),
    defineField({ name: 'lastCheckedAt', type: 'datetime', group: 'health' }),
    defineField({ name: 'httpStatus', type: 'number', group: 'health' }),
    defineField({
      name: 'linkFailures',
      title: 'Failed checks in a row',
      type: 'number',
      group: 'health',
      readOnly: true,
      description: 'Set by the daily link checker; the link is marked broken at 2.',
    }),
    defineField({
      name: 'manualOverride',
      title: 'Manual override (skip auto-checker)',
      type: 'boolean',
      group: 'health',
      description:
        'Turn on for known false-positives (bot-blocked sites). The cron will skip this resource.',
      initialValue: false,
    }),

    // --- Moderation ---
    defineField({
      name: 'submissionStatus',
      type: 'string',
      group: 'moderation',
      options: {
        list: [
          { title: 'Published', value: 'published' },
          { title: 'Pending', value: 'pending' },
          { title: 'Rejected', value: 'rejected' },
          // Reported as gone and confirmed; hidden but kept so it can be restored.
          { title: 'Removed', value: 'removed' },
        ],
        layout: 'radio',
      },
      initialValue: 'published',
    }),
    defineField({
      name: 'submittedBy',
      type: 'string',
      group: 'moderation',
    }),
    defineField({
      name: 'contributorNote',
      title: 'Contributor note (public)',
      type: 'text',
      rows: 3,
      group: 'moderation',
      description:
        'What the contributor wrote when suggesting it, shown on its page under “Contributor Note”. Copied from the suggestion on approval; edit or clear it to change or hide it.',
      validation: (rule) => rule.max(1000),
    }),
    defineField({
      name: 'internalNotes',
      type: 'text',
      rows: 2,
      group: 'moderation',
    }),
  ],
  orderings: [
    {
      title: 'Recently added',
      name: 'addedDesc',
      by: [{ field: 'addedAt', direction: 'desc' }],
    },
    {
      title: 'Name A→Z',
      name: 'nameAsc',
      by: [{ field: 'name', direction: 'asc' }],
    },
  ],
  preview: {
    select: {
      title: 'name',
      url: 'url',
      status: 'linkStatus',
      moderation: 'submissionStatus',
    },
    prepare({ title, url, status, moderation }) {
      const flags = [
        status === 'broken' && '🔴 broken',
        status === 'suspect' && '🟡 suspect',
        moderation === 'pending' && '⏳ pending',
      ].filter(Boolean)
      return {
        title,
        subtitle: [url, ...flags].filter(Boolean).join('  ·  '),
      }
    },
  },
})
