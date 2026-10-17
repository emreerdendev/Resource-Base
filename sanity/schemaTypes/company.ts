import { defineArrayMember, defineField, defineType } from 'sanity'

import {
  APPLICATION_CHANNELS,
  CITIES,
  SECTORS,
  WORK_MODELS,
  studioOptions,
} from '../../lib/company-taxonomy'

/**
 * A company in the job-application directory: who they are, where they work
 * and — most importantly — how to apply (emails, career pages, LinkedIn).
 * Only company-level, public contact info belongs here; never personal
 * employee contacts.
 */
export const company = defineType({
  name: 'company',
  title: 'Company',
  type: 'document',
  groups: [
    { name: 'content', title: 'Content', default: true },
    { name: 'apply', title: 'How to apply' },
    { name: 'taxonomy', title: 'Taxonomy' },
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
      name: 'website',
      type: 'url',
      group: 'content',
      validation: (rule) => rule.uri({ scheme: ['http', 'https'] }),
    }),
    defineField({
      name: 'description',
      type: 'text',
      rows: 3,
      group: 'content',
    }),

    // --- How to apply ---
    defineField({
      name: 'emails',
      title: 'Application emails',
      type: 'array',
      group: 'apply',
      of: [defineArrayMember({ type: 'string', validation: (rule) => rule.email() })],
      description: 'Generic company inboxes only (hr@, careers@, info@ …).',
      validation: (rule) => rule.unique(),
    }),
    defineField({
      name: 'careerLinks',
      title: 'Career pages / job boards',
      type: 'array',
      group: 'apply',
      of: [defineArrayMember({ type: 'url' })],
      validation: (rule) => rule.unique(),
    }),
    defineField({
      name: 'linkedin',
      title: 'LinkedIn (company or jobs page)',
      type: 'url',
      group: 'apply',
    }),
    defineField({
      name: 'channels',
      title: 'Application channels',
      type: 'array',
      group: 'apply',
      of: [defineArrayMember({ type: 'string' })],
      options: { list: studioOptions(APPLICATION_CHANNELS), layout: 'grid' },
    }),

    // --- Taxonomy ---
    defineField({
      name: 'cities',
      type: 'array',
      group: 'taxonomy',
      of: [defineArrayMember({ type: 'string' })],
      options: { list: studioOptions(CITIES), layout: 'grid' },
    }),
    defineField({
      name: 'otherLocations',
      title: 'Other locations',
      type: 'array',
      group: 'taxonomy',
      of: [defineArrayMember({ type: 'string' })],
      options: { layout: 'tags' },
      description:
        'Places outside the city list above, as "City, Country" (e.g. "Berlin, Germany"). Shown as-is and offered as a filter.',
    }),
    defineField({
      name: 'workModels',
      title: 'Work models',
      type: 'array',
      group: 'taxonomy',
      of: [defineArrayMember({ type: 'string' })],
      options: { list: studioOptions(WORK_MODELS), layout: 'grid' },
    }),
    defineField({
      name: 'sectors',
      type: 'array',
      group: 'taxonomy',
      of: [defineArrayMember({ type: 'string' })],
      options: { list: studioOptions(SECTORS), layout: 'grid' },
    }),
    defineField({
      name: 'clients',
      title: 'Known clients / projects',
      type: 'array',
      group: 'taxonomy',
      of: [defineArrayMember({ type: 'string' })],
      options: { layout: 'tags' },
      description: 'e.g. the banks an outsourcing firm places engineers at.',
    }),

    // --- Moderation ---
    defineField({
      name: 'status',
      type: 'string',
      group: 'moderation',
      options: {
        list: [
          { title: 'Published', value: 'published' },
          { title: 'Pending', value: 'pending' },
          { title: 'Hidden', value: 'hidden' },
        ],
        layout: 'radio',
      },
      initialValue: 'published',
    }),
    defineField({
      name: 'addedAt',
      type: 'datetime',
      group: 'moderation',
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: 'submittedBy',
      title: 'Suggested by (user id)',
      type: 'string',
      description: 'Set when the company came from an approved community suggestion; shown as “Added by @username”. Clear it to hide the credit.',
      group: 'moderation',
      readOnly: true,
    }),
    defineField({
      name: 'internalNotes',
      type: 'text',
      rows: 2,
      group: 'moderation',
    }),
  ],
  orderings: [
    { title: 'Name A→Z', name: 'nameAsc', by: [{ field: 'name', direction: 'asc' }] },
    {
      title: 'Recently added',
      name: 'addedDesc',
      by: [{ field: 'addedAt', direction: 'desc' }],
    },
  ],
  preview: {
    select: { title: 'name', website: 'website', status: 'status' },
    prepare({ title, website, status }) {
      return {
        title,
        subtitle: [website, status !== 'published' && `⏳ ${status}`]
          .filter(Boolean)
          .join('  ·  '),
      }
    },
  },
})
