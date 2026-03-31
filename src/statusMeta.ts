export type KnownStatus =
  | 'In-Progress'
  | 'To-Do'
  | 'Ongoing'
  | 'Pending Approval'
  | 'Pending Release'
  | 'Blocked'
  | 'Cancelled'
  | 'Done'
  | 'Bez statusu'
  | 'No Status';

export const STATUS_ORDER: KnownStatus[] = [
  'In-Progress',
  'To-Do',
  'Ongoing',
  'Pending Approval',
  'Pending Release',
  'Blocked',
  'Cancelled',
  'Done',
  'Bez statusu',
];

export const STATUS_COLORS: Record<string, string> = {
  'In-Progress': '#f4b400',    // yellow
  // To-Do: keep high contrast on large screens (dark slate)
  'To-Do': '#4b5563',
  Ongoing: '#e67e22',          // orange
  'Pending Approval': '#e56bb8', // pink
  'Pending Release': '#3b73d9',  // blue
  Blocked: '#d64550',          // red
  Cancelled: '#7f8592',        // dark gray
  Done: '#1f7a3f',             // green
  'Bez statusu': '#c7ccd6',
  'No Status': '#c7ccd6',
};

export const getStatusDisplayName = (status?: string | null): string => {
  if (!status) return 'Bez statusu';
  if (status === 'No Status') return 'Bez statusu';
  return status;
};

export const getStatusIcon = (status?: string) => {
  switch (status) {
    case 'In-Progress':
      return 'I';
    case 'To-Do':
      return 'T';
    case 'Ongoing':
      return 'O';
    case 'Pending Approval':
      return 'P';
    case 'Pending Release':
      return 'P';
    case 'Blocked':
      return 'B';
    case 'Cancelled':
      return 'C';
    case 'Done':
      return 'D';
    default:
      return '•';
  }
}

