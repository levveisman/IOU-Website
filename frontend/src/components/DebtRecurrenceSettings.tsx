import React, { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import RecurrencePanel from './RecurrencePanel';

/** Debt Recurrence settings tab: monthly and weekly template panels. */
const DebtRecurrenceSettings: React.FC = () => {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Tabs
        value={tab}
        onChange={(_, v: number) => setTab(v)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Monthly" />
        <Tab label="Weekly" />
      </Tabs>
      <RecurrencePanel key={tab === 0 ? 'monthly' : 'weekly'} frequency={tab === 0 ? 'monthly' : 'weekly'} />
    </Box>
  );
};

export default DebtRecurrenceSettings;
