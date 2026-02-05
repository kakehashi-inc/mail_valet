import React from 'react';
import { Box, Button, TextField, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';
import { useAccountStore } from '../stores/useAccountStore';
import { useEmailStore } from '../stores/useEmailStore';
import type { FetchMode } from '@shared/types';

export default function FetchControls() {
    const { t } = useTranslation();
    const { activeAccountId } = useAccountStore();
    const { samplingMeta, fetchMode, setFetchMode, loadCachedResult, fetchEmails, isFetching } = useEmailStore();
    const [startDate, setStartDate] = React.useState('');
    const [endDate, setEndDate] = React.useState('');

    const handleModeChange = async (newMode: FetchMode) => {
        setFetchMode(newMode);
        if (!activeAccountId) return;
        const cached = await window.mailvalet.getCachedResult(activeAccountId, newMode);
        if (cached) {
            await loadCachedResult(activeAccountId, newMode);
            // Restore date inputs from cached meta for range mode
            if (newMode === 'range' && cached.meta) {
                setStartDate(cached.meta.startDate.split('T')[0]);
                setEndDate(cached.meta.endDate.split('T')[0]);
            }
        } else {
            await loadCachedResult(activeAccountId, newMode);
        }
    };

    const handleFetch = async () => {
        if (!activeAccountId) return;
        if (fetchMode === 'range' && startDate && endDate) {
            await fetchEmails(activeAccountId, startDate, endDate, false);
        } else {
            await fetchEmails(activeAccountId, undefined, undefined, true);
        }
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
                <ToggleButtonGroup
                    size="small"
                    value={fetchMode}
                    exclusive
                    onChange={(_e, v) => v && handleModeChange(v as FetchMode)}
                >
                    <ToggleButton value="days">{t('fetch.byDays')}</ToggleButton>
                    <ToggleButton value="range">{t('fetch.byRange')}</ToggleButton>
                </ToggleButtonGroup>

                {fetchMode === 'range' && (
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
            </Box>
        </Box>
    );
}
