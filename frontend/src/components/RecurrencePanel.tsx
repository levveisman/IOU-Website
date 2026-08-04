import React, { useState, useEffect, useCallback, ReactNode } from 'react';
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
  DebtRecurrenceTemplate,
  DebtWeeklyRecurrenceTemplate,
  IsoWeekday,
  listDebtRecurrenceTemplates,
  createDebtRecurrenceTemplate,
  updateDebtRecurrenceTemplate,
  deleteDebtRecurrenceTemplate,
  listDebtWeeklyRecurrenceTemplates,
  createDebtWeeklyRecurrenceTemplate,
  updateDebtWeeklyRecurrenceTemplate,
  deleteDebtWeeklyRecurrenceTemplate,
} from '../api/debtTrackerApi';

type Frequency = 'monthly' | 'weekly';
type Template = DebtRecurrenceTemplate | DebtWeeklyRecurrenceTemplate;

const FIELD_SX = { flex: '1 1 140px', minWidth: 140, maxWidth: 220 };
const todayISO = () => new Date().toISOString().split('T')[0];
const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

const WEEKDAYS: { value: IsoWeekday; label: string }[] = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
];

const weekdayLabel = (day: number) => WEEKDAYS.find((o) => o.value === day)?.label ?? String(day);

const CONFIG = {
  monthly: {
    addTitle: 'Add monthly charge',
    hint: 'Charges on the chosen day each month, starting from the next due date.',
    listTitle: 'Monthly templates',
    editTitle: 'Edit monthly template',
    pauseTooltip: 'Pause or resume future months',
    defaultDay: '1',
  },
  weekly: {
    addTitle: 'Add weekly charge',
    hint: 'Charges on the chosen weekday each week, starting from the next trigger day.',
    listTitle: 'Weekly templates',
    editTitle: 'Edit weekly template',
    pauseTooltip: 'Pause or resume future weeks',
    defaultDay: '1',
  },
} as const;

const dayOfMonthWarning = (day: number): string | null =>
  day > 28 ? 'Days after the 28th are clamped in short months (for example February).' : null;

function formatCadence(frequency: Frequency, t: Template): string {
  if (frequency === 'monthly') return String((t as DebtRecurrenceTemplate).dayOfMonth);
  return weekdayLabel((t as DebtWeeklyRecurrenceTemplate).dayOfWeek);
}

function dayFromTemplate(frequency: Frequency, t: Template): string {
  if (frequency === 'monthly') return String((t as DebtRecurrenceTemplate).dayOfMonth);
  return String((t as DebtWeeklyRecurrenceTemplate).dayOfWeek);
}

function CadenceField({
  frequency,
  value,
  onChange,
}: {
  frequency: Frequency;
  value: string;
  onChange: (v: string) => void;
}) {
  if (frequency === 'monthly') {
    return (
      <TextField
        label="Day of month"
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        sx={FIELD_SX}
        inputProps={{ min: 1, max: 31 }}
      />
    );
  }
  return (
    <TextField
      select
      label="Day of week"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={FIELD_SX}
    >
      {WEEKDAYS.map((opt) => (
        <MenuItem key={opt.value} value={String(opt.value)}>
          {opt.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

interface RecurrencePanelProps {
  frequency: Frequency;
}

const RecurrencePanel: React.FC<RecurrencePanelProps> = ({ frequency }) => {
  const cfg = CONFIG[frequency];

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [sender, setSender] = useState<Entity | null>(null);
  const [receiver, setReceiver] = useState<Entity | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [day, setDay] = useState(cfg.defaultDay);
  const [startDate, setStartDate] = useState(todayISO);
  const [endDate, setEndDate] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [editSender, setEditSender] = useState<Entity | null>(null);
  const [editReceiver, setEditReceiver] = useState<Entity | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDay, setEditDay] = useState(cfg.defaultDay);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editActive, setEditActive] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const list =
        frequency === 'monthly'
          ? await listDebtRecurrenceTemplates()
          : await listDebtWeeklyRecurrenceTemplates();
      setTemplates(list);
    } catch (e: unknown) {
      setLoadError(errMsg(e, 'Failed to load templates'));
    }
  }, [frequency]);

  useEffect(() => {
    void load();
  }, [load]);

  const parseAmount = (raw: string): number | null => {
    const amt = parseFloat(raw);
    return Number.isNaN(amt) || amt <= 0 ? null : amt;
  };

  const parseDay = (raw: string): { ok: true; value: number } | { ok: false; error: string } => {
    const n = parseInt(raw, 10);
    if (frequency === 'monthly') {
      if (!Number.isInteger(n) || n < 1 || n > 31) {
        return { ok: false, error: 'Day of month must be between 1 and 31.' };
      }
      return { ok: true, value: n };
    }
    if (!Number.isInteger(n) || n < 1 || n > 7) {
      return { ok: false, error: 'Day of week must be Monday–Sunday.' };
    }
    return { ok: true, value: n };
  };

  const resetCreateForm = () => {
    setSender(null);
    setReceiver(null);
    setAmount('');
    setDescription('');
    setDay(cfg.defaultDay);
    setEndDate('');
  };

  const handleCreate = async () => {
    if (!sender || !receiver) {
      setWarnings(['Select both sender and receiver.']);
      return;
    }
    const amt = parseAmount(amount);
    if (amt === null) {
      setWarnings(['Amount must be a positive number.']);
      return;
    }
    const dayResult = parseDay(day);
    if (!dayResult.ok) {
      setWarnings([dayResult.error]);
      return;
    }
    try {
      setSubmitting(true);
      setWarnings([]);
      const end = endDate.trim() ? endDate.trim() : null;
      const desc = description.trim() || undefined;
      const { warnings: w } =
        frequency === 'monthly'
          ? await createDebtRecurrenceTemplate({
              from: sender,
              to: receiver,
              amount: amt,
              description: desc,
              dayOfMonth: dayResult.value,
              startDate,
              endDate: end,
            })
          : await createDebtWeeklyRecurrenceTemplate({
              from: sender,
              to: receiver,
              amount: amt,
              description: desc,
              dayOfWeek: dayResult.value as IsoWeekday,
              startDate,
              endDate: end,
            });
      setWarnings(w);
      resetCreateForm();
      await load();
    } catch (e: unknown) {
      setWarnings([errMsg(e, 'Create failed')]);
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (t: Template) => {
    setEditing(t);
    setEditSender(t.from);
    setEditReceiver(t.to);
    setEditAmount(String(t.amount));
    setEditDesc(t.description ?? '');
    setEditDay(dayFromTemplate(frequency, t));
    setEditStart(t.startDate);
    setEditEnd(t.endDate ?? '');
    setEditActive(t.active);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editing || !editSender || !editReceiver) return;
    const amt = parseAmount(editAmount);
    if (amt === null) {
      setWarnings(['Amount must be a positive number.']);
      return;
    }
    const dayResult = parseDay(editDay);
    if (!dayResult.ok) {
      setWarnings([dayResult.error]);
      return;
    }
    try {
      setSubmitting(true);
      setWarnings([]);
      const end = editEnd.trim() ? editEnd.trim() : null;
      const desc = editDesc.trim() || null;
      const { warnings: w } =
        frequency === 'monthly'
          ? await updateDebtRecurrenceTemplate(editing.id, {
              from: editSender,
              to: editReceiver,
              amount: amt,
              description: desc,
              dayOfMonth: dayResult.value,
              startDate: editStart,
              endDate: end,
              active: editActive,
            })
          : await updateDebtWeeklyRecurrenceTemplate(editing.id, {
              from: editSender,
              to: editReceiver,
              amount: amt,
              description: desc,
              dayOfWeek: dayResult.value as IsoWeekday,
              startDate: editStart,
              endDate: end,
              active: editActive,
            });
      setWarnings(w);
      setEditOpen(false);
      setEditing(null);
      await load();
    } catch (e: unknown) {
      setWarnings([errMsg(e, 'Update failed')]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (t: Template) => {
    const cadence = formatCadence(frequency, t);
    if (
      !window.confirm(
        `Delete ${frequency} recurrence (${formatEntityName(t.from)} → ${formatEntityName(t.to)}, ${cadence})?`
      )
    ) {
      return;
    }
    try {
      setWarnings([]);
      if (frequency === 'monthly') await deleteDebtRecurrenceTemplate(t.id);
      else await deleteDebtWeeklyRecurrenceTemplate(t.id);
      await load();
    } catch (e: unknown) {
      setWarnings([errMsg(e, 'Delete failed')]);
    }
  };

  const handleToggleActive = async (t: Template, active: boolean) => {
    try {
      setWarnings([]);
      const { warnings: w } =
        frequency === 'monthly'
          ? await updateDebtRecurrenceTemplate(t.id, { active })
          : await updateDebtWeeklyRecurrenceTemplate(t.id, { active });
      setWarnings(w);
      await load();
    } catch (e: unknown) {
      setWarnings([errMsg(e, 'Update failed')]);
    }
  };

  const formDayNum = parseInt(day, 10);
  const formDayWarning =
    frequency === 'monthly' && !Number.isNaN(formDayNum) ? dayOfMonthWarning(formDayNum) : null;
  const editDayNum = parseInt(editDay, 10);
  const editDayAlert =
    frequency === 'monthly' && !Number.isNaN(editDayNum) && editDayNum > 0
      ? dayOfMonthWarning(editDayNum)
      : null;

  const dateFields = (
    start: string,
    setStart: (v: string) => void,
    end: string,
    setEnd: (v: string) => void
  ): ReactNode => (
    <>
      <TextField
        label="Start date"
        type="date"
        value={start}
        onChange={(e) => setStart(e.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={FIELD_SX}
      />
      <TextField
        label="End date (optional)"
        type="date"
        value={end}
        onChange={(e) => setEnd(e.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={FIELD_SX}
      />
    </>
  );

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {cfg.addTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {cfg.hint}
        </Typography>

        {warnings.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setWarnings([])}>
            {warnings.map((w) => (
              <Box key={w}>{w}</Box>
            ))}
          </Alert>
        )}
        {formDayWarning && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {formDayWarning}
          </Alert>
        )}

        <Box sx={{ mb: 2 }}>
          <EntitySelector
            senderEntity={sender}
            receiverEntity={receiver}
            onSenderSelect={setSender}
            onReceiverSelect={setReceiver}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <TextField
            label="Amount ($)"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            sx={FIELD_SX}
            inputProps={{ min: 0, step: 0.01 }}
          />
          <CadenceField frequency={frequency} value={day} onChange={setDay} />
          {dateFields(startDate, setStartDate, endDate, setEndDate)}
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
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {cfg.listTitle}
        </Typography>

        {loadError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {loadError}
          </Alert>
        )}

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
                    <TableCell>{formatCadence(frequency, t)}</TableCell>
                    <TableCell>{t.startDate}</TableCell>
                    <TableCell>{t.endDate ?? '—'}</TableCell>
                    <TableCell>
                      <Tooltip title={cfg.pauseTooltip}>
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
      </Paper>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{cfg.editTitle}</DialogTitle>
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
                sx={FIELD_SX}
              />
              <CadenceField frequency={frequency} value={editDay} onChange={setEditDay} />
              {dateFields(editStart, setEditStart, editEnd, setEditEnd)}
            </Box>
            {editDayAlert && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {editDayAlert}
              </Alert>
            )}
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
    </Box>
  );
};

export default RecurrencePanel;
