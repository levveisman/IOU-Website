import React from 'react';
import { CssBaseline, ThemeProvider, createTheme, Box, CircularProgress } from '@mui/material';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enAU } from 'date-fns/locale';
import { store } from './store';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useBirthdayNotifications } from './hooks/useBirthdayNotifications';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import DebtTrackerPage from './pages/DebtTrackerPage';
import LeavePage from './pages/LeavePage';
import SalesPage from './pages/SalesPage';
import SettingsPage from './pages/SettingsPage';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#4caf50', // Green for "owes"
    },
    secondary: {
      main: '#f44336', // Red for "owed"
    },
  },
  components: {
    MuiTextField: {
      defaultProps: {
        InputLabelProps: {
          shrink: undefined, // Let MUI handle shrinking automatically
        },
      },
      styleOverrides: {
        root: {
          // Fix for autofill label overlap
          '& input:-webkit-autofill + label, & input:-webkit-autofill:hover + label, & input:-webkit-autofill:focus + label': {
            transform: 'translate(14px, -9px) scale(0.75)',
          },
        },
      },
    },
  },
});

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  
  // Enable birthday notifications when user is logged in
  useBirthdayNotifications();

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/debt-tracker" element={<DebtTrackerPage />} />
      <Route path="/leave" element={<LeavePage />} />
      <Route path="/sales" element={<SalesPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <Provider store={store}>
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enAU}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <BrowserRouter>
            <AuthProvider>
              <AppContent />
              <PWAInstallPrompt />
              <PWAUpdatePrompt />
            </AuthProvider>
          </BrowserRouter>
        </ThemeProvider>
      </LocalizationProvider>
    </Provider>
  );
}

export default App;
