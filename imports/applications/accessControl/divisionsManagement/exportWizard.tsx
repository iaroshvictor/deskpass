import React, { useState } from 'react';
import { Meteor } from 'meteor/meteor';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Stepper, Step, StepLabel,
    FormControl, FormLabel, RadioGroup, FormControlLabel, Radio,
    List, ListItem, ListItemText, IconButton, CircularProgress,
    Typography, Divider, Stack, Chip,
} from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DownloadIcon from '@mui/icons-material/Download';

type ExportFormat = 'csv' | 'json' | 'xls';

type FieldDef = {
    key: string;
    label: string;
    enabled: boolean;
};

const DEFAULT_FIELDS: FieldDef[] = [
    { key: 'firstName',     label: 'First Name',        enabled: true },
    { key: 'lastName',      label: 'Last Name',         enabled: true },
    { key: 'divisionName',  label: 'Division Name',     enabled: true },
    { key: 'cardNumbers',   label: 'Card Number(s)',     enabled: true },
    { key: 'alertListName', label: 'Alert List Name',   enabled: true },
    { key: 'allowedGates',  label: 'Allowed Gates',     enabled: true },
];

type Props = {
    pageFilter: Record<string, any>;
    onClose: () => void;
};

const ExportWizard = ({ pageFilter, onClose }: Props) => {
    const [activeStep, setActiveStep] = useState(0);
    const [format, setFormat] = useState<ExportFormat>('csv');
    const [fields, setFields] = useState<FieldDef[]>(DEFAULT_FIELDS);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggleField = (key: string) => {
        setFields(prev => prev.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f));
    };

    const moveField = (index: number, direction: -1 | 1) => {
        const next = index + direction;
        if (next < 0 || next >= fields.length) return;
        setFields(prev => {
            const arr = [...prev];
            [arr[index], arr[next]] = [arr[next], arr[index]];
            return arr;
        });
    };

    const handleExport = async () => {
        setLoading(true);
        setError(null);
        try {
            const enabledKeys = fields.filter(f => f.enabled).map(f => f.key);
            const rows: Record<string, string>[] = await Meteor.callAsync(
                'exportPersons',
                pageFilter,
                enabledKeys,
            );
            const headers = fields.filter(f => f.enabled).map(f => f.label);
            downloadFile(rows, headers, enabledKeys, format);
            onClose();
        } catch (e: any) {
            setError(e.message ?? 'Export failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open maxWidth="sm" fullWidth onClose={onClose}>
            <DialogTitle>Export Persons</DialogTitle>
            <DialogContent>
                <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
                    {['Format', 'Fields', 'Export'].map(label => (
                        <Step key={label}><StepLabel>{label}</StepLabel></Step>
                    ))}
                </Stepper>

                {activeStep === 0 && (
                    <FormControl>
                        <FormLabel>Choose export format</FormLabel>
                        <RadioGroup value={format} onChange={(_e, v) => setFormat(v as ExportFormat)}>
                            <FormControlLabel value="csv" control={<Radio />} label="CSV (.csv)" />
                            <FormControlLabel value="xls" control={<Radio />} label="Excel (.xls)" />
                            <FormControlLabel value="json" control={<Radio />} label="JSON (.json)" />
                        </RadioGroup>
                    </FormControl>
                )}

                {activeStep === 1 && (
                    <>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Toggle fields and reorder them. Drag using the arrows.
                        </Typography>
                        <List dense>
                            {fields.map((f, i) => (
                                <React.Fragment key={f.key}>
                                    <ListItem
                                        sx={{ pl: 0 }}
                                        secondaryAction={
                                            <Stack direction="row" spacing={0}>
                                                <IconButton size="small" onClick={() => moveField(i, -1)} disabled={i === 0}>
                                                    <ArrowUpwardIcon fontSize="small" />
                                                </IconButton>
                                                <IconButton size="small" onClick={() => moveField(i, 1)} disabled={i === fields.length - 1}>
                                                    <ArrowDownwardIcon fontSize="small" />
                                                </IconButton>
                                            </Stack>
                                        }
                                    >
                                        <Chip
                                            label={f.label}
                                            onClick={() => toggleField(f.key)}
                                            color={f.enabled ? 'primary' : 'default'}
                                            variant={f.enabled ? 'filled' : 'outlined'}
                                            sx={{ mr: 1 }}
                                        />
                                        <ListItemText
                                            secondary={f.enabled ? 'Included' : 'Excluded'}
                                        />
                                    </ListItem>
                                    {i < fields.length - 1 && <Divider />}
                                </React.Fragment>
                            ))}
                        </List>
                    </>
                )}

                {activeStep === 2 && (
                    <Stack spacing={1}>
                        <Typography><strong>Format:</strong> {format.toUpperCase()}</Typography>
                        <Typography><strong>Fields:</strong> {fields.filter(f => f.enabled).map(f => f.label).join(', ')}</Typography>
                        {error && <Typography color="error">{error}</Typography>}
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={loading}>Cancel</Button>
                {activeStep > 0 && (
                    <Button onClick={() => setActiveStep(s => s - 1)} disabled={loading}>Back</Button>
                )}
                {activeStep < 2 && (
                    <Button variant="contained" onClick={() => setActiveStep(s => s + 1)}>
                        Next
                    </Button>
                )}
                {activeStep === 2 && (
                    <Button
                        variant="contained"
                        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
                        onClick={handleExport}
                        disabled={loading || fields.every(f => !f.enabled)}
                    >
                        Download
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

function downloadFile(
    rows: Record<string, string>[],
    headers: string[],
    keys: string[],
    format: ExportFormat,
) {
    let content: string;
    let mime: string;
    let ext: string;

    if (format === 'json') {
        content = JSON.stringify(
            rows.map(row => {
                const obj: Record<string, string> = {};
                keys.forEach((k, i) => { obj[headers[i]] = row[k] ?? ''; });
                return obj;
            }),
            null,
            2,
        );
        mime = 'application/json';
        ext = 'json';
    } else if (format === 'xls') {
        const table = [
            headers.map(h => `<th>${h}</th>`).join(''),
            ...rows.map(row => keys.map(k => `<td>${escapeHtml(row[k] ?? '')}</td>`).join('')),
        ];
        content = `<html><head><meta charset="utf-8"/></head><body><table>` +
            `<tr>${table[0]}</tr>` +
            table.slice(1).map(r => `<tr>${r}</tr>`).join('') +
            `</table></body></html>`;
        mime = 'application/vnd.ms-excel';
        ext = 'xls';
    } else {
        const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
        content = [
            headers.map(escape).join(','),
            ...rows.map(row => keys.map(k => escape(row[k] ?? '')).join(',')),
        ].join('\r\n');
        mime = 'text/csv';
        ext = 'csv';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `persons_export.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
}

function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default ExportWizard;
