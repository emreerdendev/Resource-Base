import { defineField, defineType } from 'sanity'

/**
 * A suspended account (email not verified within 7 days) asking to be
 * reactivated. Approve to give it another 7 days to verify; the app lifts the
 * suspension (/api/notify). Created by /api/account/reactivate.
 */
export const accountRequest = defineType({
  name: 'accountRequest',
  title: 'Account request',
  type: 'document',
  fields: [
    defineField({ name: 'email', type: 'string', readOnly: true }),
    defineField({ name: 'username', type: 'string', readOnly: true }),
    defineField({ name: 'userId', title: 'User id', type: 'string', readOnly: true }),
    defineField({ name: 'message', type: 'text', rows: 3, readOnly: true }),
    defineField({
      name: 'status',
      type: 'string',
      description: 'Approve to reactivate the account for another 7 days.',
      options: {
        list: [
          { title: 'Pending', value: 'pending' },
          { title: 'Approved (reactivate)', value: 'approved' },
          { title: 'Rejected', value: 'rejected' },
        ],
        layout: 'radio',
      },
      initialValue: 'pending',
    }),
    defineField({ name: 'createdAt', type: 'datetime', readOnly: true }),
  ],
  preview: {
    select: { title: 'email', subtitle: 'status' },
  },
})
