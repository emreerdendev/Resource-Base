import type { StructureResolver } from 'sanity/structure'

/**
 * Custom desk. The top two panes are the day-to-day maintenance workflow:
 * fix broken links and triage community submissions in a couple of clicks.
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
        .title('⏳ Pending submissions')
        .child(
          S.documentList()
            .title('Pending submissions')
            .filter('_type == "submission" && status == "pending"')
            .defaultOrdering([{ field: 'createdAt', direction: 'desc' }])
        ),
      S.listItem()
        .title('🏢 Pending companies')
        .child(
          S.documentList()
            .title('Pending companies')
            .filter(
              '(_type == "company" && status == "pending") || (_type == "submission" && kind == "company" && status == "pending")'
            )
        ),
      S.divider(),
      S.documentTypeListItem('company').title('All companies'),
      S.documentTypeListItem('resource').title('All resources'),
      S.documentTypeListItem('category').title('Categories'),
      S.documentTypeListItem('tag').title('Tags'),
      S.documentTypeListItem('submission').title('All submissions'),
    ])
