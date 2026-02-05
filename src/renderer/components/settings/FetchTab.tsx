import { Box, TextField, FormControl, InputLabel, Select, MenuItem, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { FetchSettings } from '@shared/types';

interface Props {
    settings: FetchSettings;
    onChange: (settings: FetchSettings) => void;
}

export default function FetchTab({ settings, onChange }: Props) {
    const { t } = useTranslation();

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h6">{t('settings.fetchTitle')}</Typography>
            <TextField
                label={t('settings.samplingDays')}
                type="number"
                size="small"
                value={settings.samplingDays}
                onChange={(e) => onChange({ ...settings, samplingDays: Math.max(1, Number(e.target.value)) })}
                sx={{ width: 250 }}
            />
            <TextField
                label={t('settings.maxFetchCount')}
                type="number"
                size="small"
                value={settings.maxFetchCount}
                onChange={(e) => onChange({ ...settings, maxFetchCount: Math.max(1, Number(e.target.value)) })}
                sx={{ width: 250 }}
            />
            <FormControl size="small" sx={{ width: 250 }}>
                <InputLabel>{t('settings.readFilter')}</InputLabel>
                <Select
                    value={settings.readFilter}
                    label={t('settings.readFilter')}
                    onChange={(e) =>
                        onChange({ ...settings, readFilter: e.target.value as 'all' | 'unread' | 'read' })
                    }
                >
                    <MenuItem value="all">{t('settings.all')}</MenuItem>
                    <MenuItem value="unread">{t('settings.unread')}</MenuItem>
                    <MenuItem value="read">{t('settings.read')}</MenuItem>
                </Select>
            </FormControl>
        </Box>
    );
}
