import type { StructureResolver } from 'sanity/structure'

/**
 * Custom desk: the day-to-day maintenance workflow first — broken links, then
 * each kind of pending submission in its own list — then what was hidden by
 * removal reports (to undo), then everything by type. Approving a submission
 * applies it automatically (see /api/notify).
 */
export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      S.listItem()
        .title('🔴 Broken links')
        .child(
          S.documentList()
            .title('Broken links')
            .filter(
              '_type == "resource" && linkStatus == "broken" && manualOverride != true'
            )
            .defaultOrdering([{ field: 'lastCheckedAt', direction: 'desc' }])
        ),
      S.listItem()
        .title('🟡 Suspect links')
        .child(
          S.documentList()
            .title('Suspect links (403/429)')
            .filter('_type == "resource" && linkStatus == "suspect"')
        ),
      S.listItem()
        .title('⏳ Pending: new resources')
        .child(
          S.documentList()
            .title('Pending new resources')
            .filter('_type == "submission" && (!defined(kind) || kind == "new") && status == "pending"')
            .defaultOrdering([{ field: 'createdAt', direction: 'desc' }])
        ),
      S.listItem()
        .title('🔧 Pending: fixes & edit suggestions')
        .child(
          S.documentList()
            .title('Pending fixes, edits & removal reports')
            .filter('_type == "submission" && kind in ["fix", "taxonomy"] && status == "pending"')
            .defaultOrdering([{ field: 'createdAt', direction: 'desc' }])
        ),
      S.listItem()
        .title('🏢 Pending: companies & company edits')
        .child(
          S.documentList()
            .title('Pending companies & company edits')
            .filter(
              '(_type == "company" && status == "pending") || (_type == "submission" && kind in ["company", "companyEdit"] && status == "pending")'
            )
            .defaultOrdering([{ field: 'createdAt', direction: 'desc' }])
        ),
      S.listItem()
        .title('📄 Pending: CVs')
        .child(
          S.documentList()
            .title('Pending CVs')
            .filter('_type == "submission" && kind == "cv" && status == "pending"')
            .defaultOrdering([{ field: 'createdAt', direction: 'desc' }])
        ),
      S.listItem()
        .title('🔓 Pending: account reactivations')
        .child(
          S.documentList()
            .title('Account reactivation requests')
            .filter('_type == "accountRequest" && status == "pending"')
            .defaultOrdering([{ field: 'createdAt', direction: 'desc' }])
        ),
      S.divider(),
      // Hidden by an approved removal report: set back to Published to undo.
      S.listItem()
        .title('🙈 Removed resources')
        .child(
          S.documentList()
            .title('Removed resources')
            .filter('_type == "resource" && submissionStatus == "removed"')
        ),
      S.listItem()
        .title('🙈 Hidden companies')
        .child(
          S.documentList()
            .title('Hidden companies')
            .filter('_type == "company" && status == "hidden"')
        ),
      S.divider(),
      S.documentTypeListItem('resource').title('All resources'),
      S.documentTypeListItem('category').title('Categories'),
      S.documentTypeListItem('tag').title('Tags'),
      S.documentTypeListItem('company').title('All companies'),
      S.documentTypeListItem('submission').title('All submissions'),
    ])
