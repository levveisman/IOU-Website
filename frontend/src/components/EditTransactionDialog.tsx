import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Slide,
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import EntitySelector from './EntitySelector';
import { Entity, dateInputToTransactionTimestamp } from '../utils/debtTrackerUtils';
import {
  updateDebtTransaction,
  CreateDebtTransactionData,
  DebtTransaction,
} from '../api/debtTrackerApi';

interface EditTransactionDialogProps {
  open: boolean;
  transaction: DebtTransaction | null;
  onClose: () => void;
  onTransactionUpdated: () => void;
}

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>
) {
  return <Slide direction="down" ref={ref} {...props} />;
});

const EditTransactionDialog: React.FC<EditTransactionDialogProps> = ({
  open,
  transaction,
  onClose,
  onTransactionUpdated,
}) => {
  const [senderEntity, setSenderEntity] = useState<Entity | null>(null);
  const [receiverEntity, setReceiverEntity] = useState<Entity | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [date, setDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Populate form when transaction changes
  useEffect(() => {
    if (transaction && open) {
      setSenderEntity(transaction.from);
      setReceiverEntity(transaction.to);
      setAmount(transaction.amount.toString());
      setDescription(transaction.description || '');
      
      // Convert timestamp to date string
      const transactionDate = new Date(transaction.timestamp);
      setDate(transactionDate.toISOString().split('T')[0]);
    } else if (!open) {
      // Reset form when dialog closes
      setSenderEntity(null);
      setReceiverEntity(null);
      setAmount('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [transaction, open]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent 'e', 'E', '+', and '-' from being entered
    if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
      e.preventDefault();
    }
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDescription(e.target.value);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDate(e.target.value);
  };

  const handleSubmit = async () => {
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

      const timestamp = dateInputToTransactionTimestamp(
        date,
        transaction?.timestamp
      );

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

      // Close dialog and notify parent
      onClose();
      onTransactionUpdated();
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

  const handleClose = () => {
    if (!submitting) {
      onClose();
    }
  };

  const isFormValid =
    senderEntity !== null &&
    receiverEntity !== null &&
    amount.trim() !== '' &&
    parseFloat(amount) > 0;

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Debt Transaction</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 1 }}>
            <EntitySelector
              senderEntity={senderEntity}
              receiverEntity={receiverEntity}
              onSenderSelect={setSenderEntity}
              onReceiverSelect={setReceiverEntity}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Amount ($)"
                type="number"
                value={amount}
                onChange={handleAmountChange}
                onKeyDown={handleAmountKeyDown}
                fullWidth
                inputProps={{ min: 0, step: 0.01 }}
                required
              />
              <TextField
                label="Date"
                type="date"
                value={date}
                onChange={handleDateChange}
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
              onChange={handleDescriptionChange}
              fullWidth
              placeholder="e.g., Dinner, Rent, Groceries"
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleClose}
            disabled={submitting}
            sx={{ color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color="primary"
            disabled={submitting || !isFormValid}
          >
            {submitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error Dialog */}
      <Dialog
        open={showError}
        onClose={handleCloseError}
        TransitionComponent={Transition}
      >
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

export default EditTransactionDialog;
