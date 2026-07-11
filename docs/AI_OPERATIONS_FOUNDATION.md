# EverittOS AI Operations Foundation

## Product promise

EverittOS should act as an operations manager for property-service businesses, not merely store records. It should continuously turn job, customer, crew, schedule, payment, photo, report, and workflow data into a prioritized list of actions.

## First product surface: Operations Inbox

Create one place where owners and managers can see what needs attention today.

Each inbox item should include:

- a clear title
- why it matters
- the related customer, job, worker, or invoice
- urgency and due date
- a recommended next action
- a direct action button
- resolved, dismissed, and snoozed states

## Initial rule-based signals

Start with deterministic rules before adding generated recommendations.

1. Job starts within 24 hours and no worker is assigned.
2. Job is overdue and not completed.
3. Required before photos are missing after a job starts.
4. Required after photos or report are missing after completion.
5. Customer has not received a report after job completion.
6. Payment is overdue or subscription status is past due.
7. Contractor payment information is incomplete.
8. Schedule conflict exists for a worker or crew.
9. Workflow step is blocked or overdue.
10. Client or contractor portal invitation is pending too long.

## Data model

Add an `operations_items` table with:

- `id`
- `organization_id`
- `type`
- `title`
- `summary`
- `priority`
- `status`
- `source_type`
- `source_id`
- `recommended_action`
- `action_href`
- `due_at`
- `snoozed_until`
- `resolved_at`
- `created_at`
- `updated_at`

Use organization-scoped RLS and preserve the source record so recommendations remain explainable.

## Generation approach

Phase 1 should generate items through database queries and server-side rules when the inbox loads or relevant records change. Avoid an autonomous background agent until the product has enough usage data to prove which signals are useful.

Phase 2 may use AI to:

- summarize why an item matters
- draft customer or worker messages
- suggest schedule changes
- identify repeated operational problems
- answer questions using organization data

AI should never send messages, change schedules, issue refunds, or alter payments without explicit user approval.

## First release scope

Build:

- `/operations` inbox page
- priority filters
- open, snoozed, resolved, and dismissed states
- server-side signal generation
- direct links to affected records
- dashboard card showing urgent item count
- tests for organization isolation and each initial rule

Do not build yet:

- autonomous actions
- open-ended chat
- vector search
- multi-agent orchestration
- external tool execution

## Success criteria

The first release is useful when a business owner can open EverittOS each morning and immediately understand:

1. what is wrong or at risk
2. why it matters
3. what action to take
4. where to complete that action

Track item creation, opens, action clicks, dismissals, snoozes, and resolution time to learn which signals deserve deeper automation.