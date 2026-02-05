import React from 'react';
import { Box, TextField, Typography, Button, Chip, Alert } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useTranslation } from 'react-i18next';
import type { GcpSettings } from '@shared/types';

export default function GcpTab() {
    const { t } = useTranslation();
    const [settings, setSettings] = React.useState<GcpSettings>({
        clientId: '',
        clientSecret: '',
        projectId: '',
    });
    const [error, setError] = React.useState('');

    React.useEffect(() => {
        window.mailvalet.getGcpSettings().then(setSettings);
    }, []);

    const save = async (updated: GcpSettings) => {
        setSettings(updated);
        await window.mailvalet.saveGcpSettings(updated);
    };

    const handleImportJson = async () => {
        setError('');
        try {
            const result = await window.mailvalet.importGcpJson();
            if (result) {
                setSettings(result);
                await window.mailvalet.saveGcpSettings(result);
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    const isConfigured = settings.clientId && settings.clientSecret;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h6">{t('settings.gcpTitle')}</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={handleImportJson}>
                    {t('settings.importGcpJson')}
                </Button>
                {isConfigured && (
                    <Chip
                        icon={<CheckCircleIcon />}
                        label={t('settings.gcpConfigured')}
                        color="success"
                        size="small"
                        variant="outlined"
                    />
                )}
            </Box>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
                label={t('settings.clientId')}
                size="small"
                value={settings.clientId}
                onChange={e => save({ ...settings, clientId: e.target.value })}
                fullWidth
            />
            <TextField
                label={t('settings.clientSecret')}
                size="small"
                type="password"
                value={settings.clientSecret}
                onChange={e => save({ ...settings, clientSecret: e.target.value })}
                fullWidth
            />
            <TextField
                label={t('settings.projectId')}
                size="small"
                value={settings.projectId}
                onChange={e => save({ ...settings, projectId: e.target.value })}
                fullWidth
            />
        </Box>
    );
}
