import React from 'react';
import { Box, Typography, Button, Divider, Alert } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../ConfirmDialog';

export default function DataTab() {
    const { t } = useTranslation();
    const [confirmAction, setConfirmAction] = React.useState<string | null>(null);
    const [status, setStatus] = React.useState<{ message: string; severity: 'success' | 'error' | 'warning' } | null>(
        null
    );

    const handleClearAICache = async () => {
        await window.mailvalet.clearAICache();
        setStatus({ message: t('data.aiCacheCleared'), severity: 'success' });
        setConfirmAction(null);
    };

    const handleClearAllCache = async () => {
        await window.mailvalet.clearAllCache();
        setStatus({ message: t('data.allCacheCleared'), severity: 'success' });
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
        setStatus({ message: t('data.exported'), severity: 'success' });
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
            setStatus({ message: t('data.imported'), severity: 'success' });
        };
        input.click();
    };

    const handleExportAccountData = async () => {
        const json = await window.mailvalet.exportAccountData();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mailvalet-accounts.json';
        a.click();
        URL.revokeObjectURL(url);
        setStatus({ message: t('data.accountExported'), severity: 'success' });
    };

    const handleImportAccountData = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            const text = await file.text();
            const result = await window.mailvalet.importAccountData(text);
            if (result.errors.length > 0) {
                setStatus({
                    message: t('data.accountImportedWithErrors', {
                        imported: result.imported,
                        errors: result.errors.length,
                    }),
                    severity: 'warning',
                });
            } else {
                setStatus({
                    message: t('data.accountImported', { count: result.imported }),
                    severity: 'success',
                });
            }
        };
        input.click();
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
                    {t('data.accountData')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    {t('data.accountDataHelp')}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        startIcon={<AccountCircleIcon />}
                        endIcon={<DownloadIcon />}
                        onClick={handleExportAccountData}
                    >
                        {t('data.exportAccountData')}
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<AccountCircleIcon />}
                        endIcon={<UploadIcon />}
                        onClick={handleImportAccountData}
                    >
                        {t('data.importAccountData')}
                    </Button>
                </Box>
            </Box>

            {status && (
                <Alert severity={status.severity} onClose={() => setStatus(null)}>
                    {status.message}
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
        </Box>
    );
}
