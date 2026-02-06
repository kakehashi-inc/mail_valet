import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Alert,
    Box,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { ImapConnectionSettings, ImapSecurity } from '@shared/types';

interface Props {
    open: boolean;
    onClose: () => void;
    onAdd?: (settings: ImapConnectionSettings) => Promise<void>;
    editAccountId?: string | null;
    onSave?: (accountId: string, settings: ImapConnectionSettings) => Promise<void>;
}

export default function ImapAccountDialog({ open, onClose, onAdd, editAccountId, onSave }: Props) {
    const { t } = useTranslation();
    const [host, setHost] = React.useState('');
    const [port, setPort] = React.useState(993);
    const [username, setUsername] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [security, setSecurity] = React.useState<ImapSecurity>('ssl');
    const [testing, setTesting] = React.useState(false);
    const [testResult, setTestResult] = React.useState<'success' | 'failed' | null>(null);
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState('');
    const [loaded, setLoaded] = React.useState(false);

    const isEditMode = Boolean(editAccountId);

    React.useEffect(() => {
        if (!open) return;
        if (editAccountId) {
            window.mailvalet.getImapSettings(editAccountId).then(settings => {
                if (settings) {
                    setHost(settings.host);
                    setPort(settings.port);
                    setUsername(settings.username);
                    setPassword(settings.password);
                    setSecurity(settings.security);
                }
                setLoaded(true);
            });
        } else {
            setLoaded(true);
        }
    }, [open, editAccountId]);

    const resetForm = () => {
        setHost('');
        setPort(993);
        setUsername('');
        setPassword('');
        setSecurity('ssl');
        setTesting(false);
        setTestResult(null);
        setSubmitting(false);
        setError('');
        setLoaded(false);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSecurityChange = (value: ImapSecurity) => {
        setSecurity(value);
        if (value === 'ssl') setPort(993);
        else setPort(143);
    };

    const getSettings = (): ImapConnectionSettings => ({
        host,
        port,
        username,
        password,
        security,
    });

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        setError('');
        try {
            const ok = await window.mailvalet.testImapConnection(getSettings());
            setTestResult(ok ? 'success' : 'failed');
        } catch (e: unknown) {
            setTestResult('failed');
            setError(e instanceof Error ? e.message : String(e));
        }
        setTesting(false);
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setError('');
        try {
            if (isEditMode && editAccountId && onSave) {
                await onSave(editAccountId, getSettings());
            } else if (onAdd) {
                await onAdd(getSettings());
            }
            handleClose();
        } catch (e: unknown) {
            const fallback = isEditMode ? t('imap.saveFailed') : t('imap.addFailed');
            setError(e instanceof Error ? e.message : fallback);
            setSubmitting(false);
        }
    };

    const isValid = host && username && password;

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>{isEditMode ? t('imap.editTitle') : t('imap.addTitle')}</DialogTitle>
            <DialogContent>
                {loaded && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            label={t('imap.host')}
                            size="small"
                            value={host}
                            onChange={e => setHost(e.target.value)}
                            placeholder="imap.example.com"
                            fullWidth
                        />
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <TextField
                                label={t('imap.port')}
                                size="small"
                                type="number"
                                value={port}
                                onChange={e => setPort(parseInt(e.target.value, 10) || 0)}
                                sx={{ width: 120 }}
                            />
                            <FormControl size="small" sx={{ minWidth: 160 }}>
                                <InputLabel>{t('imap.security')}</InputLabel>
                                <Select
                                    value={security}
                                    label={t('imap.security')}
                                    onChange={e => handleSecurityChange(e.target.value as ImapSecurity)}
                                >
                                    <MenuItem value="ssl">SSL/TLS</MenuItem>
                                    <MenuItem value="starttls">STARTTLS</MenuItem>
                                    <MenuItem value="none">{t('imap.securityNone')}</MenuItem>
                                </Select>
                            </FormControl>
                        </Box>
                        <TextField
                            label={t('imap.username')}
                            size="small"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            fullWidth
                        />
                        <TextField
                            label={t('imap.password')}
                            size="small"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            fullWidth
                        />
                        <Button variant="outlined" onClick={handleTest} disabled={!isValid || testing}>
                            {testing ? '...' : t('settings.testConnection')}
                        </Button>
                        {testResult === 'success' && (
                            <Alert severity="success">{t('settings.testSuccess')}</Alert>
                        )}
                        {testResult === 'failed' && (
                            <Alert severity="error">{t('settings.testFailed')}</Alert>
                        )}
                        {error && <Alert severity="error">{error}</Alert>}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>{t('common.cancel')}</Button>
                <Button variant="contained" onClick={handleSubmit} disabled={!isValid || submitting}>
                    {isEditMode ? t('common.save') : t('common.add')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
