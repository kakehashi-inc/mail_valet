import React from 'react';
import {
    Box,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Typography,
    Button,
    Chip,
    CircularProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { useTranslation } from 'react-i18next';
import type { OllamaSettings } from '@shared/types';

interface Props {
    settings: OllamaSettings;
    onChange: (settings: OllamaSettings) => void;
}

export default function OllamaTab({ settings, onChange }: Props) {
    const { t } = useTranslation();
    const [models, setModels] = React.useState<string[]>([]);
    const [testResult, setTestResult] = React.useState<boolean | null>(null);
    const [testing, setTesting] = React.useState(false);

    React.useEffect(() => {
        if (settings.host) {
            window.mailvalet.getOllamaModels(settings.host).then(setModels);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleTestConnection = async () => {
        setTesting(true);
        setTestResult(null);
        const result = await window.mailvalet.testOllamaConnection(settings.host);
        setTestResult(result);
        if (result) {
            const modelList = await window.mailvalet.getOllamaModels(settings.host);
            setModels(modelList);
        }
        setTesting(false);
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h6">{t('settings.ollamaTitle')}</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                <TextField
                    label={t('settings.ollamaHost')}
                    size="small"
                    value={settings.host}
                    onChange={(e) => onChange({ ...settings, host: e.target.value })}
                    sx={{ width: 350 }}
                />
                <Button variant="outlined" size="small" onClick={handleTestConnection} disabled={testing}>
                    {testing ? <CircularProgress size={20} /> : t('settings.testConnection')}
                </Button>
                {testResult !== null && (
                    <Chip
                        icon={testResult ? <CheckCircleIcon /> : <ErrorIcon />}
                        label={testResult ? t('settings.connected') : t('settings.connectionFailed')}
                        color={testResult ? 'success' : 'error'}
                        size="small"
                        variant="outlined"
                    />
                )}
            </Box>
            <FormControl size="small" sx={{ width: 350 }}>
                <InputLabel>{t('settings.ollamaModel')}</InputLabel>
                <Select
                    value={settings.model}
                    label={t('settings.ollamaModel')}
                    onChange={(e) => onChange({ ...settings, model: e.target.value })}
                >
                    {models.map((m) => (
                        <MenuItem key={m} value={m}>
                            {m}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            <TextField
                label={t('settings.ollamaTimeout')}
                type="number"
                size="small"
                value={settings.timeout}
                onChange={(e) => onChange({ ...settings, timeout: Math.max(0, Number(e.target.value)) })}
                helperText={t('settings.ollamaTimeoutHelp')}
                sx={{ width: 250 }}
            />
            <TextField
                label={t('settings.ollamaConcurrency')}
                type="number"
                size="small"
                value={settings.concurrency}
                onChange={(e) => onChange({ ...settings, concurrency: Math.max(1, Number(e.target.value)) })}
                sx={{ width: 250 }}
            />
        </Box>
    );
}
