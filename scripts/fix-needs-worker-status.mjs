import fs from 'node:fs';

const pageFile = 'app/jobs/page.tsx';
let page = fs.readFileSync(pageFile, 'utf8');

page = page.replace(
  "    newJob: 'New job', all: 'All', today: 'Today', active: 'Active', finished: 'Finished', needsWorker: 'Needs worker', filtered: 'Filtered', showAll: 'Show all', missingFinish: 'Finished jobs missing a finish date.', loading: 'Loading…', unableLoad: 'Unable to load jobs.', removeConfirm: 'Remove job \\\"{title}\\\"?', unableRemove: 'Unable to remove job.', noCustomer: 'No customer', photo: 'photo', photos: 'photos', maps: 'Maps', more: 'More', removing: 'Removing…', remove: 'Remove', bookAgain: 'Book again', creating: 'Creating…', date: 'Date', job: 'Job', assignedTo: 'Assigned to', status: 'Status', actions: 'Actions', openJob: 'Open job', unscheduled: 'Unscheduled', unassigned: 'Needs worker'",
  "    newJob: 'New job', all: 'All', today: 'Today', active: 'Active', finished: 'Finished', needsWorker: 'Needs worker', filtered: 'Filtered', showAll: 'Show all', missingFinish: 'Finished jobs missing a finish date.', loading: 'Loading…', unableLoad: 'Unable to load jobs.', removeConfirm: 'Remove job \\\"{title}\\\"?', unableRemove: 'Unable to remove job.', noCustomer: 'No customer', photo: 'photo', photos: 'photos', maps: 'Maps', more: 'More', removing: 'Removing…', remove: 'Remove', bookAgain: 'Book again', creating: 'Creating…', date: 'Date', job: 'Job', assignedTo: 'Assigned to', status: 'Status', actions: 'Actions', openJob: 'Open job', unscheduled: 'Unscheduled', unassigned: 'Unassigned'"
);
page = page.replace("unassigned: 'Necesita trabajador'", "unassigned: 'Sin asignar'");
page = page.replace("unassigned: 'Cần nhân sự'", "unassigned: 'Chưa phân công'");

const oldLogic = `              const assignedName = job.assigned_to ? workerNames[job.assigned_to] : null;\n              const assignment = assignedName || displayPersonName(null, job.assigned_email) || c.unassigned;\n              const needsWorker = !job.assigned_to && !job.assigned_email;`;
const newLogic = `              const assignedName = job.assigned_to ? workerNames[job.assigned_to] : null;\n              const status = String(job.status || '').trim().toLowerCase();\n              const finished = status === 'completed' || status === 'cancelled' || status === 'canceled';\n              const needsWorker = !finished && !job.assigned_to && !job.assigned_email;\n              const assignment = assignedName || displayPersonName(null, job.assigned_email) || (needsWorker ? c.needsWorker : c.unassigned);`;

if (!page.includes(oldLogic)) throw new Error('Jobs assignment display block not found');
page = page.replace(oldLogic, newLogic);
fs.writeFileSync(pageFile, page);

const filtersFile = 'lib/exports/job-filters.ts';
let filters = fs.readFileSync(filtersFile, 'utf8');
const oldFilter = `    if (filters.unassignedOnly && !isUnassignedJob(job)) return false;`;
const newFilter = `    if (filters.unassignedOnly && (!isUnassignedJob(job) || isFinishedJobStatus(job.status))) return false;`;
if (!filters.includes(oldFilter)) throw new Error('Needs worker export filter block not found');
filters = filters.replace(oldFilter, newFilter);
fs.writeFileSync(filtersFile, filters);

console.log('Fixed Needs worker display and filtering.');
