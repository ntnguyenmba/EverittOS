# Job report implementation notes

The job detail page links to `/jobs/[id]/report`, but the repository does not currently contain that page.

The missing report page should:

1. Load the selected job from the shared workspace.
2. Use the workspace membership role for permissions.
3. Show job title, customer, address, status, dates, notes, and completion status.
4. Include the existing `JobPhotosSection` in read-only mode so before, after, and progress photos appear automatically.
5. Provide a browser print action so the report can be saved as a PDF.
6. Keep activity and internal audit history off the customer-facing report.

This should be implemented as `app/jobs/[id]/report/page.tsx` once the connector allows the new route file write.
