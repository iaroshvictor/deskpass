/**
 * Light / dark switch.
 *
 * Deliberately a three-way control rather than a boolean: "system" is the
 * default so an operator who never touches it follows the workstation, while
 * a control room that is always dim can pin dark and a daylit desk can pin
 * light. MUI persists the choice itself (localStorage), so it survives a
 * reload without any state of ours.
 */
import * as React from 'react';
import { useColorScheme } from '@mui/material/styles';
import { IconButton, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';

type Mode = 'light' | 'dark' | 'system';

const OPTIONS: { value: Mode; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <LightModeIcon fontSize="small" /> },
  { value: 'dark', label: 'Dark', icon: <DarkModeIcon fontSize="small" /> },
  { value: 'system', label: 'Follow system', icon: <SettingsBrightnessIcon fontSize="small" /> },
];

export default function ThemeToggle() {
  const { mode, setMode } = useColorScheme();
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);

  // Before hydration useColorScheme has no mode yet; render nothing rather
  // than flash the wrong icon.
  if (!mode) return null;

  const current = OPTIONS.find((o) => o.value === mode) ?? OPTIONS[2];

  return (
    <>
      <Tooltip title={`Theme: ${current.label.toLowerCase()}`}>
        <IconButton
          size="small"
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
          aria-label="change theme"
        >
          {current.icon}
        </IconButton>
      </Tooltip>

      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {OPTIONS.map((option) => (
          <MenuItem
            key={option.value}
            selected={option.value === mode}
            onClick={() => { setMode(option.value); setAnchor(null); }}
          >
            <ListItemIcon>{option.icon}</ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 13 }}>{option.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
