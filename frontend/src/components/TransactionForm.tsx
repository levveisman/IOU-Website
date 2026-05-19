import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slide,
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import EntitySelector from './EntitySelector';
import {
  Entity,
  localDateInputString,
  dateInputToTransactionTimestamp,
} from '../utils/debtTrackerUtils';
import {
  createDebtTransaction,
  CreateDebtTransactionData,
} from '../api/debtTrackerApi';

interface TransactionFormProps {
  onTransactionCreated: () => void;
}

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>
) {
  return <Slide direction="down" ref={ref} {...props} />;
});

const TransactionForm: React.FC<TransactionFormProps> = ({
  onTransactionCreated,
}) => {
  const [senderEntity, setSenderEntity] = useState<Entity | null>(null);
  const [receiverEntity, setReceiverEntity] = useState<Entity | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [date, setDate] = useState<string>(localDateInputString());
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

      const timestamp = dateInputToTransactionTimestamp(date);

      // Prepare data for API
      const transactionData: CreateDebtTransactionData = {
        from: senderEntity,
        to: receiverEntity,
        amount: amountValue,
        timestamp,
        description: description.trim() || undefined,
      };

      // Create debt transaction
      await createDebtTransaction(transactionData);

      // Clear form after successful submission
      setSenderEntity(null);
      setReceiverEntity(null);
      setAmount('');
      setDescription('');
      setDate(localDateInputString());

      // Notify parent to trigger refresh
      onTransactionCreated();
    } catch (error: any) {
      console.error('Error creating debt transaction:', error);
      setErrorMessage(error.message || 'Failed to create debt transaction');
      setShowError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseError = () => {
    setShowError(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (
      e.key === 'Enter' &&
      !submitting &&
      senderEntity &&
      receiverEntity &&
      amount
    ) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isFormValid =
    senderEntity !== null &&
    receiverEntity !== null &&
    amount.trim() !== '' &&
    parseFloat(amount) > 0;

  return (
    <>
      <Paper
        elevation={3}
        sx={{
          p: 3,
          animation: 'slideDown 0.3s ease-out',
          '@keyframes slideDown': {
            from: {
              opacity: 0,
              transform: 'translateY(-20px)',
            },
            to: {
              opacity: 1,
              transform: 'translateY(0)',
            },
          },
        }}
        onKeyPress={handleKeyPress}
      >
        <Typography variant="h6" gutterBottom>
          Add Debt Transaction
        </Typography>

        <Box sx={{ mb: 3 }}>
          <EntitySelector
            senderEntity={senderEntity}
            receiverEntity={receiverEntity}
            onSenderSelect={setSenderEntity}
            onReceiverSelect={setReceiverEntity}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
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
          sx={{ mb: 2 }}
          placeholder="e.g., Dinner, Rent, Groceries"
          multiline
          rows={2}
          InputLabelProps={{
            shrink: true,
          }}
        />

        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit}
          disabled={submitting || !isFormValid}
          fullWidth
        >
          {submitting ? 'Saving...' : 'Add Transaction'}
        </Button>
      </Paper>

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

export default TransactionForm;
