import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  Paper,
  CircularProgress,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  Collapse,
  IconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { DebtTransaction, deleteDebtTransaction, updateDebtTransaction, CreateDebtTransactionData } from '../api/debtTrackerApi';
import {
  formatEntityName,
  formatCurrency,
  formatTimestamp,
  dateInputToTransactionTimestamp,
  Entity,
} from '../utils/debtTrackerUtils';
import { useScrollPreservation } from '../hooks/useScrollPreservation';
import EntitySelector from './EntitySelector';

interface TransactionHistoryProps {
  transactions: DebtTransaction[];
  loading: boolean;
  error: string | null;
  onTransactionUpdate: () => void;
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transactions,
  loading,
  error,
  onTransactionUpdate,
}) => {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Expanded transaction state
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Edit form state
  const [senderEntity, setSenderEntity] = useState<Entity | null>(null);
  const [receiverEntity, setReceiverEntity] = useState<Entity | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<DebtTransaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Smart search function
  const smartSearch = (transaction: DebtTransaction, query: string): boolean => {
    if (!query.trim()) return true;

    const lowerQuery = query.toLowerCase().trim();
    
    // Check if query is a number
    const isNumeric = /^\d+$/.test(lowerQuery);
    
    if (isNumeric) {
      const queryNum = parseInt(lowerQuery, 10);
      
      // Search in date (day, month, year)
      const date = new Date(transaction.timestamp);
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      
      if (day === queryNum || month === queryNum || year === queryNum) {
        return true;
      }
      
      // Search in amount (exact match or contains)
      const amount = transaction.amount;
      if (amount === queryNum || amount.toString().includes(lowerQuery)) {
        return true;
      }
      
      return false;
    }
    
    // Text search in entity names
    const fromName = formatEntityName(transaction.from).toLowerCase();
    const toName = formatEntityName(transaction.to).toLowerCase();
    
    if (fromName.includes(lowerQuery) || toName.includes(lowerQuery)) {
      return true;
    }
    
    // Search in description
    if (transaction.description?.toLowerCase().includes(lowerQuery)) {
      return true;
    }
    
    // Search in formatted date (DD/MM/YYYY)
    const formattedDate = formatTimestamp(transaction.timestamp).toLowerCase();
    if (formattedDate.includes(lowerQuery)) {
      return true;
    }
    
    // Search in formatted amount
    const formattedAmount = formatCurrency(transaction.amount).toLowerCase();
    if (formattedAmount.includes(lowerQuery)) {
      return true;
    }
    
    return false;
  };

  // Filter transactions based on search
  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => smartSearch(transaction, searchQuery));
  }, [transactions, searchQuery]);

  // Scroll preservation
  const scrollContainerRef = useScrollPreservation([filteredTransactions]);

  const handleTransactionClick = (transaction: DebtTransaction) => {
    if (expandedId === transaction.id) {
      // Collapse if already expanded
      setExpandedId(null);
    } else {
      // Expand and populate form
      setExpandedId(transaction.id);
      setSenderEntity(transaction.from);
      setReceiverEntity(transaction.to);
      setAmount(transaction.amount.toString());
      setDescription(transaction.description || '');
      const transactionDate = new Date(transaction.timestamp);
      setDate(transactionDate.toISOString().split('T')[0]);
      setShowError(false);
    }
  };

  const handleDeleteClick = (transaction: DebtTransaction, e: React.MouseEvent) => {
    e.stopPropagation();
    setTransactionToDelete(transaction);
    setDeleteDialogOpen(true);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setTransactionToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!transactionToDelete) return;

    try {
      setDeleting(true);
      await deleteDebtTransaction(transactionToDelete.id);
      
      setDeleteDialogOpen(false);
      setTransactionToDelete(null);
      setExpandedId(null);
      onTransactionUpdate();
    } catch (err: any) {
      console.error('Error deleting debt transaction:', err);
      alert(err.message || 'Failed to delete debt transaction');
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveEdit = async () => {
    const transaction = transactions.find(t => t.id === expandedId);
    if (!transaction) return;

    // Validate sender entity
    if (!senderEntity) {
      setErrorMessage('Please select a sender entity');
      setShowError(true);
      return;
    }

    // Validate receiver entity
    if (!receiverEntity) {
      setErrorMessage('Please select a receiver entity');
      setShowError(true);
      return;
    }

    // Validate amount
    const amountValue = parseFloat(amount);

    if (isNaN(amountValue) || amountValue <= 0) {
      setErrorMessage('Amount must be a positive number greater than zero');
      setShowError(true);
      return;
    }

    try {
      setSubmitting(true);

      const timestamp = dateInputToTransactionTimestamp(date, transaction.timestamp);

      // Prepare data for API
      const transactionData: CreateDebtTransactionData = {
        from: senderEntity,
        to: receiverEntity,
        amount: amountValue,
        timestamp,
        description: description.trim() || undefined,
      };

      // Update debt transaction
      await updateDebtTransaction(transaction.id, transactionData);

      // Close dropdown and notify parent
      setExpandedId(null);
      onTransactionUpdate();
    } catch (error: any) {
      console.error('Error updating debt transaction:', error);
      setErrorMessage(error.message || 'Failed to update debt transaction');
      setShowError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseError = () => {
    setShowError(false);
  };

  const isFormValid =
    senderEntity !== null &&
    receiverEntity !== null &&
    amount.trim() !== '' &&
    parseFloat(amount) > 0;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography color="error" sx={{ p: 2 }}>
        {error}
      </Typography>
    );
  }

  if (transactions.length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography color="text.secondary" align="center">
          No transactions yet. Create your first transaction above!
        </Typography>
      </Paper>
    );
  }

  return (
    <>
      <Paper sx={{ p: { xs: 1, sm: 2 } }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          mb: 2,
          gap: 2,
          flexWrap: 'wrap'
        }}>
          <Typography 
            variant="h6"
            sx={{ 
              fontSize: { xs: '1.125rem', sm: '1.25rem' }
            }}
          >
            Transaction History
          </Typography>
          
          {/* Search Field */}
          <TextField
            size="small"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ 
              minWidth: { xs: '100%', sm: '250px' },
              maxWidth: { xs: '100%', sm: '350px' }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setSearchQuery('')}
                    edge="end"
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {filteredTransactions.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
            No transactions found matching "{searchQuery}"
          </Typography>
        ) : (
          <Box
            ref={scrollContainerRef}
            sx={{
              maxHeight: '600px',
              overflowY: 'auto',
            }}
          >
            <List sx={{ pt: 0 }}>
            {filteredTransactions.map((transaction, index) => {
            const formattedDate = formatTimestamp(transaction.timestamp);
            const fromName = formatEntityName(transaction.from);
            const toName = formatEntityName(transaction.to);
            const formattedAmount = formatCurrency(transaction.amount);
            const isExpanded = expandedId === transaction.id;

            return (
              <React.Fragment key={transaction.id}>
                <ListItem
                  sx={{
                    display: 'block',
                    py: { xs: 2.5, sm: 2 },
                    px: { xs: 1.5, sm: 2 },
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                  onClick={() => handleTransactionClick(transaction)}
                >
                  {/* Header: Date and Expand Icon */}
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    mb: 1.5,
                    gap: 1
                  }}>
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}
                    >
                      {formattedDate}
                    </Typography>

                    {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </Box>

                  {/* Transaction Details: From -> To */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <Typography 
                      variant="body1" 
                      sx={{ 
                        fontSize: { xs: '0.938rem', sm: '1rem' },
                        lineHeight: 1.5,
                        fontWeight: 'bold'
                      }}
                    >
                      {fromName}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}
                    >
                      →
                    </Typography>
                    <Typography 
                      variant="body1" 
                      sx={{ 
                        fontSize: { xs: '0.938rem', sm: '1rem' },
                        lineHeight: 1.5,
                        fontWeight: 'bold'
                      }}
                    >
                      {toName}
                    </Typography>
                  </Box>

                  {/* Amount */}
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 'bold',
                      color: 'primary.main',
                      mb: transaction.description ? 1.5 : 0,
                      fontSize: { xs: '1.25rem', sm: '1.5rem' }
                    }}
                  >
                    {formattedAmount}
                  </Typography>

                  {/* Description */}
                  {transaction.description && (
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        mt: 1,
                        fontStyle: 'italic',
                        fontSize: { xs: '0.813rem', sm: '0.875rem' },
                        lineHeight: 1.5
                      }}
                    >
                      {transaction.description}
                    </Typography>
                  )}

                  {/* Expanded Edit Form */}
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box 
                      sx={{ 
                        mt: 3, 
                        pt: 3, 
                        borderTop: '1px solid',
                        borderColor: 'divider',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Typography variant="h6" sx={{ mb: 2, fontSize: { xs: '1.125rem', sm: '1.25rem' } }}>
                        Edit Transaction
                      </Typography>

                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <EntitySelector
                          senderEntity={senderEntity}
                          receiverEntity={receiverEntity}
                          onSenderSelect={setSenderEntity}
                          onReceiverSelect={setReceiverEntity}
                        />

                        <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                          <TextField
                            label="Amount ($)"
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            fullWidth
                            inputProps={{ min: 0, step: 0.01 }}
                            required
                          />
                          <TextField
                            label="Date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            fullWidth
                            InputLabelProps={{
                              shrink: true,
                            }}
                            required
                          />
                        </Box>

                        <TextField
                          label="Description (Optional)"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          fullWidth
                          placeholder="e.g., Dinner, Rent, Groceries"
                          multiline
                          rows={2}
                        />

                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 1 }}>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(transaction, e);
                            }}
                            color="error"
                            disabled={submitting}
                          >
                            Delete
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedId(null);
                            }}
                            disabled={submitting}
                            sx={{ color: 'text.secondary' }}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveEdit();
                            }}
                            variant="contained"
                            color="primary"
                            disabled={submitting || !isFormValid}
                          >
                            {submitting ? 'Saving...' : 'Save Changes'}
                          </Button>
                        </Box>
                      </Box>
                    </Box>
                  </Collapse>
                </ListItem>
                {index < filteredTransactions.length - 1 && <Divider />}
              </React.Fragment>
            );
          })}
        </List>
        </Box>
        )}
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>Delete Transaction</DialogTitle>
        <DialogContent>
          <Typography>
            Delete this transaction?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleting} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error Dialog */}
      <Dialog open={showError} onClose={handleCloseError}>
        <DialogTitle>Error</DialogTitle>
        <DialogContent>
          <Typography>{errorMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseError} color="primary">
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TransactionHistory;
