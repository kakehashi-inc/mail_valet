import React from 'react';
import { Box, TextField, Typography, Button, Chip, Alert } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useTranslation } from 'react-i18next';
import type { GcpSettings } from '@shared/types';

interface Props {
    settings: GcpSettings;
    onChange: (settings: GcpSettings) => void;
}

export default function GcpTab({ settings, onChange }: Props) {
    const { t } = useTranslation();
    const [error, setError] = React.useState('');

    const handleImportJson = async () => {
        setError('');
        try {
            const result = await window.mailvalet.importGcpJson();
            if (result) {
                onChange(result);
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
                onChange={(e) => onChange({ ...settings, clientId: e.target.value })}
                fullWidth
            />
            <TextField
                label={t('settings.clientSecret')}
                size="small"
                type="password"
                value={settings.clientSecret}
                onChange={(e) => onChange({ ...settings, clientSecret: e.target.value })}
                fullWidth
            />
            <TextField
                label={t('settings.projectId')}
                size="small"
                value={settings.projectId}
                onChange={(e) => onChange({ ...settings, projectId: e.target.value })}
                fullWidth
            />
        </Box>
    );
}
