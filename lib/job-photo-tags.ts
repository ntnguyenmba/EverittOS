export const JOB_PHOTO_TAGS = ['before', 'progress', 'after'] as const;

export type JobPhotoTag = (typeof JOB_PHOTO_TAGS)[number];

export function isJobPhotoTag(value: string): value is JobPhotoTag {
  return JOB_PHOTO_TAGS.includes(value as JobPhotoTag);
}

export function photoTagLabel(tag: string): string {
  if (tag === 'before') return 'Before';
  if (tag === 'progress') return 'Progress';
  if (tag === 'after') return 'After';
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

export function normalizePhotoTag(value: string | null | undefined): JobPhotoTag {
  if (value === 'before' || value === 'after') return value;
  return 'progress';
}
