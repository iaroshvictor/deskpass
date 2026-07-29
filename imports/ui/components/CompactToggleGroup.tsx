import React from 'react';
import { Box, Stack, ToggleButton, Tooltip, Typography } from '@mui/material';
import Iconify from '/imports/ui/components/iconify/iconify';

export const SX_TB = {
    px: 0.75, py: 0.5,
    '&.Mui-selected': { bgcolor: 'primary.main', color: 'primary.contrastText',
        '&:hover': { bgcolor: 'primary.dark' } },
};

export const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Typography variant="caption" color="text.secondary"
            sx={{ minWidth: 56, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {label}
        </Typography>
        {children}
    </Stack>
);

export function ExclusiveGroup<T extends string>({ value, onChange, options }: {
    value: T | null;
    onChange: (v: T | null) => void;
    options: { v: T; label: string; icon: React.ReactNode }[];
}) {
    return (
        <Stack direction="row" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
            {options.map(({ v, label, icon }) => (
                <Tooltip key={v} title={label}>
                    <ToggleButton size="small" value={v} selected={value === v}
                        onChange={() => onChange(value === v ? null : v)}
                        sx={{ ...SX_TB, border: 'none', borderRadius: 0 }}>
                        {icon}
                    </ToggleButton>
                </Tooltip>
            ))}
        </Stack>
    );
}

export function MultiGroup<T extends string | number>({ values, onChange, options, hint }: {
    values: T[];
    onChange: (next: T[]) => void;
    options: { v: T; label: string; icon: React.ReactNode }[];
    hint?: string;
}) {
    const toggle = (v: T) =>
        onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);
    return (
        <Stack direction="row" spacing={0.5} alignItems="center">
            <Stack direction="row" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                {options.map(({ v, label, icon }) => (
                    <Tooltip key={v} title={label}>
                        <ToggleButton size="small" value={v} selected={values.includes(v)}
                            onChange={() => toggle(v)}
                            sx={{ ...SX_TB, border: 'none', borderRadius: 0 }}>
                            {icon}
                        </ToggleButton>
                    </Tooltip>
                ))}
            </Stack>
            {hint && values.length > 1 && (
                <Tooltip title={hint}>
                    <Box sx={{ display: 'flex', color: 'text.disabled' }}>
                        <Iconify icon="mdi:information-outline" width={14} />
                    </Box>
                </Tooltip>
            )}
        </Stack>
    );
}

export const IconifyIcon = ({ icon, width = 18 }: { icon: string; width?: number }) =>
    <Iconify icon={icon} width={width} />;
