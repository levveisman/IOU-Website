import React from 'react';
import { Box } from '@mui/material';
import MonthlyRecurrencePanel from './MonthlyRecurrencePanel';
import WeeklyRecurrencePanel from './WeeklyRecurrencePanel';

/** Debt Recurrence settings tab: monthly and weekly template panels. */
const DebtRecurrenceSettings: React.FC = () => (
  <Box>
    <MonthlyRecurrencePanel />
    <WeeklyRecurrencePanel />
  </Box>
);

export default DebtRecurrenceSettings;
