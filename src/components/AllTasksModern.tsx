import React from 'react';
import { YouTrackIssue } from '../types';
import { AllTasks } from './AllTasks';

interface AllTasksModernProps {
  issues: YouTrackIssue[];
}

export const AllTasksModern: React.FC<AllTasksModernProps> = ({ issues }) => {
  return (
    <div className="all-tasks-modern-shell">
      <AllTasks issues={issues} />
    </div>
  );
};

