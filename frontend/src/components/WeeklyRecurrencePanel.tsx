import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  MenuItem,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EntitySelector from './EntitySelector';
import { Entity, formatEntityName, formatCurrency } from '../utils/debtTrackerUtils';
import {
  DebtWeeklyRecurrenceTemplate,
  IsoWeekday,
  listDebtWeeklyRecurrenceTemplates,
  createDebtWeeklyRecurrenceTemplate,
  updateDebtWeeklyRecurrenceTemplate,
  deleteDebtWeeklyRecurrenceTemplate,
} from '../api/debtTrackerApi';

const WEEKDAY_OPTIONS: { value: IsoWeekday; label: string }[] = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
];

const weekdayLabel = (day: number): string =>
  WEEKDAY_OPTIONS.find((o) => o.value === day)?.label ?? String(day);

const WeeklyRecurrencePanel: React.FC = () => {
  const [templates, setTemplates] = useState<DebtWeeklyRecurrenceTemplate[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [senderEntity, setSenderEntity] = useState<Entity | null>(null);
  const [receiverEntity, setReceiverEntity] = useState<Entity | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<IsoWeekday>(1);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<DebtWeeklyRecurrenceTemplate | null>(null);
  const [editDay, setEditDay] = useState<IsoWeekday>(1);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editSender, setEditSender] = useState<Entity | null>(null);
  const [editReceiver, setEditReceiver] = useState<Entity | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const list = await listDebtWeeklyRecurrenceTemplates();
      setTemplates(list);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load templates');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    if (!senderEntity || !receiverEntity) {
      setWarnings(['Select both sender and receiver.']);
      return;
    }
    const amt = parseFloat(amount);
    if (Number.isNaN(amt) || amt <= 0) {
      setWarnings(['Amount must be a positive number.']);
      return;
    }
    try {
      setSubmitting(true);
      setWarnings([]);
      const { warnings: w } = await createDebtWeeklyRecurrenceTemplate({
        from: senderEntity,
        to: receiverEntity,
        amount: amt,
        description: description.trim() || undefined,
        dayOfWeek,
        startDate,
        endDate: endDate.trim() ? endDate.trim() : null,
      });
      setWarnings(w);
      setSenderEntity(null);
      setReceiverEntity(null);
      setAmount('');
      setDescription('');
      setDayOfWeek(1);
      setEndDate('');
      await load();
    } catch (e: unknown) {
      setWarnings([e instanceof Error ? e.message : 'Create failed']);
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (t: DebtWeeklyRecurrenceTemplate) => {
    setEditing(t);
    setEditSender(t.from);
    setEditReceiver(t.to);
    setEditAmount(String(t.amount));
    setEditDesc(t.description ?? '');
    setEditDay(t.dayOfWeek);
    setEditStart(t.startDate);
    setEditEnd(t.endDate ?? '');
    setEditActive(t.active);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editing || !editSender || !editReceiver) return;
    const amt = parseFloat(editAmount);
    if (Number.isNaN(amt) || amt <= 0) {
      setWarnings(['Amount must be a positive number.']);
      return;
    }
    try {
      setSubmitting(true);
      setWarnings([]);
      const { warnings: w } = await updateDebtWeeklyRecurrenceTemplate(editing.id, {
        from: editSender,
        to: editReceiver,
        amount: amt,
        description: editDesc.trim() || null,
        dayOfWeek: editDay,
        startDate: editStart,
        endDate: editEnd.trim() ? editEnd.trim() : null,
        active: editActive,
      });
      setWarnings(w);
      setEditOpen(false);
      setEditing(null);
      await load();
    } catch (e: unknown) {
      setWarnings([e instanceof Error ? e.message : 'Update failed']);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (t: DebtWeeklyRecurrenceTemplate) => {
    if (
      !window.confirm(
        `Delete weekly recurrence (${formatEntityName(t.from)} → ${formatEntityName(t.to)}, ${weekdayLabel(t.dayOfWeek)})?`
      )
    ) {
      return;
    }
    try {
      setWarnings([]);
      await deleteDebtWeeklyRecurrenceTemplate(t.id);
      await load();
    } catch (e: unknown) {
      setWarnings([e instanceof Error ? e.message : 'Delete failed']);
    }
  };

  const handleToggleActive = async (t: DebtWeeklyRecurrenceTemplate, active: boolean) => {
    try {
      setWarnings([]);
      const { warnings: w } = await updateDebtWeeklyRecurrenceTemplate(t.id, { active });
      setWarnings(w);
      await load();
    } catch (e: unknown) {
      setWarnings([e instanceof Error ? e.message : 'Update failed']);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Weekly recurring charges
      </Typography>

      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      )}
      {warnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setWarnings([])}>
          {warnings.map((w) => (
            <Box key={w}>{w}</Box>
          ))}
        </Alert>
      )}

      <Typography variant="subtitle2" gutterBottom>
        New template
      </Typography>
      <Box sx={{ mb: 2 }}>
        <EntitySelector
          senderEntity={senderEntity}
          receiverEntity={receiverEntity}
          onSenderSelect={setSenderEntity}
          onReceiverSelect={setReceiverEntity}
        />
      </Box>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <TextField
          label="Amount ($)"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          sx={{ minWidth: 140 }}
          inputProps={{ min: 0, step: 0.01 }}
        />
        <TextField
          select
          label="Day of week"
          value={dayOfWeek}
          onChange={(e) => setDayOfWeek(Number(e.target.value) as IsoWeekday)}
          sx={{ minWidth: 160 }}
        >
          {WEEKDAY_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Start date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="End date (optional)"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </Box>
      <TextField
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        fullWidth
        sx={{ mb: 2 }}
        multiline
        rows={2}
      />
      <Button variant="contained" onClick={() => void handleCreate()} disabled={submitting}>
        {submitting ? 'Saving…' : 'Create template'}
      </Button>

      <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
        Existing templates
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>From → To</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Day</TableCell>
              <TableCell>Start</TableCell>
              <TableCell>End</TableCell>
              <TableCell>Active</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary">
                    No templates yet.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        {formatEntityName(t.from)} → {formatEntityName(t.to)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t.description?.trim() ? t.description.trim() : '—'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">{formatCurrency(t.amount)}</TableCell>
                  <TableCell>{weekdayLabel(t.dayOfWeek)}</TableCell>
                  <TableCell>{t.startDate}</TableCell>
                  <TableCell>{t.endDate ?? '—'}</TableCell>
                  <TableCell>
                    <Tooltip title="Pause or resume future weeks">
                      <Switch
                        size="small"
                        checked={t.active}
                        onChange={(_, v) => void handleToggleActive(t, v)}
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit (future runs only)">
                      <IconButton size="small" onClick={() => openEdit(t)} aria-label="edit">
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete template">
                      <IconButton size="small" onClick={() => void handleDelete(t)} aria-label="delete">
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit weekly template</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <EntitySelector
              senderEntity={editSender}
              receiverEntity={editReceiver}
              onSenderSelect={setEditSender}
              onReceiverSelect={setEditReceiver}
            />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
              <TextField
                label="Amount ($)"
                type="number"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                inputProps={{ min: 0, step: 0.01 }}
              />
              <TextField
                select
                label="Day of week"
                value={editDay}
                onChange={(e) => setEditDay(Number(e.target.value) as IsoWeekday)}
                sx={{ minWidth: 160 }}
              >
                {WEEKDAY_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Start date"
                type="date"
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="End date (optional)"
                type="date"
                value={editEnd}
                onChange={(e) => setEditEnd(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <TextField
              label="Description"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              fullWidth
              sx={{ mt: 2 }}
              multiline
              rows={2}
            />
            <FormControlLabel
              control={<Switch checked={editActive} onChange={(_, v) => setEditActive(v)} />}
              label="Active"
              sx={{ mt: 1 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleSaveEdit()} disabled={submitting}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default WeeklyRecurrencePanel;
