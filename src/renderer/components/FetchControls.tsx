import React from 'react';
import { Box, Button, TextField, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CachedIcon from '@mui/icons-material/Cached';
import { useTranslation } from 'react-i18next';
import { useAccountStore } from '../stores/useAccountStore';
import { useEmailStore } from '../stores/useEmailStore';

export default function FetchControls() {
    const { t } = useTranslation();
    const { activeAccountId } = useAccountStore();
    const { samplingMeta, fetchEmails, isFetching } = useEmailStore();
    const [mode, setMode] = React.useState<'days' | 'range'>('days');
    const [startDate, setStartDate] = React.useState('');
    const [endDate, setEndDate] = React.useState('');

    const handleFetch = async () => {
        if (!activeAccountId) return;
        if (mode === 'range' && startDate && endDate) {
            await fetchEmails(activeAccountId, startDate, endDate, false);
        } else {
            await fetchEmails(activeAccountId, undefined, undefined, true);
        }
    };

    const handleRefresh = async () => {
        if (!activeAccountId) return;
        await fetchEmails(activeAccountId, undefined, undefined, true);
    };

    const periodText = samplingMeta
        ? `${new Date(samplingMeta.startDate).toLocaleDateString()} - ${new Date(samplingMeta.endDate).toLocaleDateString()}`
        : '';

    return (
        <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
            {periodText && (
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    {t('fetch.samplingPeriod')}: {periodText}
                </Typography>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <ToggleButtonGroup size="small" value={mode} exclusive onChange={(_e, v) => v && setMode(v)}>
                    <ToggleButton value="days">{t('fetch.byDays')}</ToggleButton>
                    <ToggleButton value="range">{t('fetch.byRange')}</ToggleButton>
                </ToggleButtonGroup>

                {mode === 'range' && (
                    <>
                        <TextField
                            type="date"
                            size="small"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            sx={{ width: 160 }}
                            slotProps={{ inputLabel: { shrink: true } }}
                        />
                        <Typography variant="body2">~</Typography>
                        <TextField
                            type="date"
                            size="small"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            sx={{ width: 160 }}
                            slotProps={{ inputLabel: { shrink: true } }}
                        />
                    </>
                )}

                <Button
                    variant="contained"
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={handleFetch}
                    disabled={!activeAccountId || isFetching}
                >
                    {t('fetch.fetch')}
                </Button>
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<CachedIcon />}
                    onClick={handleRefresh}
                    disabled={!activeAccountId || isFetching}
                >
                    {t('fetch.refresh')}
                </Button>
            </Box>
        </Box>
    );
}
