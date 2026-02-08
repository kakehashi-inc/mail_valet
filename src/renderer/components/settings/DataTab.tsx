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
    const [status, setStatus] = React.useState<{
        message: string;
        severity: 'success' | 'error' | 'warning';
        section: 'cache' | 'settings' | 'account';
    } | null>(null);

    const handleClearAICache = async () => {
        await window.mailvalet.clearAICache();
        setStatus({ message: t('data.aiCacheCleared'), severity: 'success', section: 'cache' });
        setConfirmAction(null);
    };

    const handleClearAllCache = async () => {
        await window.mailvalet.clearAllCache();
        setStatus({ message: t('data.allCacheCleared'), severity: 'success', section: 'cache' });
        setConfirmAction(null);
    };

    const handleExport = async () => {
        const json = await window.mailvalet.exportSettings();
        const saved = await window.mailvalet.saveFile(json, 'mailvalet-settings.json');
        if (saved) {
            setStatus({ message: t('data.exported'), severity: 'success', section: 'settings' });
        }
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
            setStatus({ message: t('data.imported'), severity: 'success', section: 'settings' });
        };
        input.click();
    };

    const handleExportAccountData = async () => {
        const json = await window.mailvalet.exportAccountData();
        const saved = await window.mailvalet.saveFile(json, 'mailvalet-accounts.json');
        if (saved) {
            setStatus({ message: t('data.accountExported'), severity: 'success', section: 'account' });
        }
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
                    section: 'account',
                });
            } else {
                setStatus({
                    message: t('data.accountImported', { count: result.imported }),
                    severity: 'success',
                    section: 'account',
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
                {status?.section === 'cache' && (
                    <Alert severity={status.severity} onClose={() => setStatus(null)} sx={{ mt: 1 }}>
                        {status.message}
                    </Alert>
                )}
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
                {status?.section === 'settings' && (
                    <Alert severity={status.severity} onClose={() => setStatus(null)} sx={{ mt: 1 }}>
                        {status.message}
                    </Alert>
                )}
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
                {status?.section === 'account' && (
                    <Alert severity={status.severity} onClose={() => setStatus(null)} sx={{ mt: 1 }}>
                        {status.message}
                    </Alert>
                )}
            </Box>

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
