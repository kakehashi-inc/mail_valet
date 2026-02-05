import React from 'react';
import { Box, Typography, Button, Divider, Alert } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../ConfirmDialog';

export default function DataTab() {
    const { t } = useTranslation();
    const [confirmAction, setConfirmAction] = React.useState<string | null>(null);
    const [status, setStatus] = React.useState('');

    const handleClearAICache = async () => {
        await window.mailvalet.clearAICache();
        setStatus(t('data.aiCacheCleared'));
        setConfirmAction(null);
    };

    const handleClearAllCache = async () => {
        await window.mailvalet.clearAllCache();
        setStatus(t('data.allCacheCleared'));
        setConfirmAction(null);
    };

    const handleExport = async () => {
        const json = await window.mailvalet.exportSettings();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mailvalet-settings.json';
        a.click();
        URL.revokeObjectURL(url);
        setStatus(t('data.exported'));
    };

    const handleImport = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            const text = await file.text();
            await window.mailvalet.importSettings(text);
            setStatus(t('data.imported'));
        };
        input.click();
    };

    const handleResetAll = async () => {
        await window.mailvalet.resetAllData();
        setStatus(t('data.resetComplete'));
        setConfirmAction(null);
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h6">{t('settings.dataTitle')}</Typography>

            <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {t('data.cache')}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        startIcon={<DeleteIcon />}
                        onClick={() => setConfirmAction('aiCache')}
                    >
                        {t('data.clearAICache')}
                    </Button>
                    <Button
                        variant="outlined"
                        color="warning"
                        startIcon={<DeleteIcon />}
                        onClick={() => setConfirmAction('allCache')}
                    >
                        {t('data.clearAllCache')}
                    </Button>
                </Box>
            </Box>

            <Divider />

            <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {t('data.settings')}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport}>
                        {t('data.exportSettings')}
                    </Button>
                    <Button variant="outlined" startIcon={<UploadIcon />} onClick={handleImport}>
                        {t('data.importSettings')}
                    </Button>
                </Box>
            </Box>

            <Divider />

            <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {t('data.reset')}
                </Typography>
                <Button
                    variant="contained"
                    color="error"
                    startIcon={<RestartAltIcon />}
                    onClick={() => setConfirmAction('resetAll')}
                >
                    {t('data.resetAll')}
                </Button>
            </Box>

            {status && (
                <Alert severity="success" onClose={() => setStatus('')}>
                    {status}
                </Alert>
            )}

            <ConfirmDialog
                open={confirmAction === 'aiCache'}
                title={t('data.clearAICache')}
                message={t('data.confirmClearAICache')}
                onConfirm={handleClearAICache}
                onCancel={() => setConfirmAction(null)}
            />
            <ConfirmDialog
                open={confirmAction === 'allCache'}
                title={t('data.clearAllCache')}
                message={t('data.confirmClearAllCache')}
                onConfirm={handleClearAllCache}
                onCancel={() => setConfirmAction(null)}
                severity="warning"
            />
            <ConfirmDialog
                open={confirmAction === 'resetAll'}
                title={t('data.resetAll')}
                message={t('data.confirmResetAll')}
                onConfirm={handleResetAll}
                onCancel={() => setConfirmAction(null)}
                severity="error"
            />
        </Box>
    );
}
