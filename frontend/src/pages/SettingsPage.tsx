import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AccountSettings from '../components/AccountSettings';
import ClosedDatesManager from '../components/ClosedDatesManager';
import PublicHolidaysManager from '../components/PublicHolidaysManager';
import BirthdaysManager from '../components/BirthdaysManager';
import NotificationSettings from '../components/NotificationSettings';
import SalesItemsManager from '../components/SalesItemsManager';
import DebtRecurrenceSettings from '../components/DebtRecurrenceSettings';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

interface SettingsTab {
  id: string;
  label: string;
  component: React.ReactNode;
}

interface SortableTabProps {
  id: string;
  label: string;
  index: number;
  isActive: boolean;
  onClick: () => void;
}

const SortableTab: React.FC<SortableTabProps> = ({ id, label, index, isActive, onClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Handle click separately from drag
  const handleClick = (e: React.MouseEvent) => {
    if (!isDragging) {
      onClick();
    }
  };

  return (
    <Tab
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      label={label}
      id={`settings-tab-${index}`}
      value={index}
      onClick={handleClick}
      sx={{
        cursor: isDragging ? 'grabbing' : 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    />
  );
};

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Default tab configuration
  const defaultTabs: SettingsTab[] = [
    { id: 'account', label: 'Account', component: <AccountSettings /> },
    { id: 'closed-dates', label: 'Closed Dates', component: <ClosedDatesManager /> },
    { id: 'public-holidays', label: 'Public Holidays', component: <PublicHolidaysManager /> },
    { id: 'birthdays', label: 'Birthdays', component: <BirthdaysManager /> },
    { id: 'notifications', label: 'Notifications', component: <NotificationSettings /> },
    { id: 'sales-items', label: 'Sales Items', component: <SalesItemsManager /> },
    { id: 'debt-recurrence', label: 'Debt Recurrence', component: <DebtRecurrenceSettings /> },
  ];

  // Load tab order from localStorage or use default
  const [tabs, setTabs] = useState<SettingsTab[]>(() => {
    const savedOrder = localStorage.getItem('settingsTabOrder');
    if (savedOrder) {
      try {
        const orderIds = JSON.parse(savedOrder);
        // Reorder tabs based on saved order
        const orderedTabs = orderIds
          .map((id: string) => defaultTabs.find(tab => tab.id === id))
          .filter((tab: SettingsTab | undefined): tab is SettingsTab => tab !== undefined);
        
        // Add any new tabs that weren't in saved order
        const newTabs = defaultTabs.filter(tab => !orderIds.includes(tab.id));
        return [...orderedTabs, ...newTabs];
      } catch {
        return defaultTabs;
      }
    }
    return defaultTabs;
  });
  
  // Check if we should open a specific tab (e.g., from birthday banner)
  const initialTab = location.state?.openTab || 0;
  const [currentTab, setCurrentTab] = useState(initialTab);

  // Setup drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10, // 10px movement required before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 500, // 500ms hold before drag starts on touch devices (longer delay)
        tolerance: 8, // Allow 8px movement during hold (for scrolling)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setTabs((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        // Save new order to localStorage
        localStorage.setItem('settingsTabOrder', JSON.stringify(newOrder.map(tab => tab.id)));
        
        // Adjust current tab index if needed
        if (currentTab === oldIndex) {
          setCurrentTab(newIndex);
        } else if (currentTab > oldIndex && currentTab <= newIndex) {
          setCurrentTab(currentTab - 1);
        } else if (currentTab < oldIndex && currentTab >= newIndex) {
          setCurrentTab(currentTab + 1);
        }
        
        return newOrder;
      });
    }
  };

  const handleTabClick = (index: number) => {
    setCurrentTab(index);
  };

  const handleBack = () => {
    navigate(-1); // Go back to previous page
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* Top bar */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="back"
            onClick={handleBack}
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Settings - {user?.username}
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Tabs with drag and drop */}
      <Paper square elevation={0}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={tabs.map(tab => tab.id)}
            strategy={horizontalListSortingStrategy}
          >
            <Tabs
              value={currentTab}
              indicatorColor="primary"
              textColor="primary"
              variant="scrollable"
              scrollButtons="auto"
            >
              {tabs.map((tab, index) => (
                <SortableTab
                  key={tab.id}
                  id={tab.id}
                  label={tab.label}
                  index={index}
                  isActive={currentTab === index}
                  onClick={() => handleTabClick(index)}
                />
              ))}
            </Tabs>
          </SortableContext>
        </DndContext>
      </Paper>

      {/* Tab Panels */}
      {tabs.map((tab, index) => (
        <TabPanel key={tab.id} value={currentTab} index={index}>
          {tab.component}
        </TabPanel>
      ))}
    </Box>
  );
};

export default SettingsPage;
