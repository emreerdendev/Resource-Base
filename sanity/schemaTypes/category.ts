import { defineField, defineType } from 'sanity'

/**
 * Self-referential, hierarchical taxonomy spine.
 * A category with no `parent` is top-level; otherwise it nests under its parent.
 * One model, arbitrary depth — so the directory can grow from
 * "Resources > Courses" today to back-end / devops / AI trees later without a
 * schema change.
 */
export const category = defineType({
  name: 'category',
  title: 'Category',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'parent',
      title: 'Parent category',
      type: 'reference',
      to: [{ type: 'category' }],
      description: 'Leave empty for a top-level category. Only two levels are shown.',
      options: {
        // Top-level categories other than this one.
        filter: ({ document }) => ({
          filter: '!defined(parent) && _id != $id && _id != $draftId',
          params: {
            id: String(document._id).replace(/^drafts\./, ''),
            draftId: `drafts.${String(document._id).replace(/^drafts\./, '')}`,
          },
        }),
      },
    }),
    defineField({
      name: 'icon',
      title: 'Icon (lucide name)',
      type: 'string',
      description: 'A lucide-react icon name, e.g. "palette", "code", "wrench".',
    }),
    defineField({ name: 'description', type: 'text', rows: 2 }),
    defineField({
      name: 'order',
      title: 'Sort order',
      type: 'number',
      initialValue: 100,
    }),
    defineField({
      name: 'domain',
      type: 'string',
      description: 'High-level grouping used to scope the launch.',
      options: {
        list: [
          { title: 'Developer', value: 'developer' },
          { title: 'Designer', value: 'designer' },
          { title: 'General', value: 'general' },
        ],
        layout: 'radio',
      },
      initialValue: 'developer',
    }),
  ],
  orderings: [
    {
      title: 'Manual order',
      name: 'orderAsc',
      by: [{ field: 'order', direction: 'asc' }],
    },
  ],
  preview: {
    select: { title: 'title', parentTitle: 'parent.title', domain: 'domain' },
    prepare({ title, parentTitle, domain }) {
      return {
        title,
        subtitle: [parentTitle && `↳ ${parentTitle}`, domain]
          .filter(Boolean)
          .join('  ·  '),
      }
    },
  },
})
