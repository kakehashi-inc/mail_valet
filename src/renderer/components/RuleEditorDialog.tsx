import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Typography,
    Box,
    Alert,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { AccountRules } from '@shared/types';

interface RuleEditorDialogProps {
    open: boolean;
    accountId: string | null;
    onClose: () => void;
    onSave: () => void;
}

export default function RuleEditorDialog({ open, accountId, onClose, onSave }: RuleEditorDialogProps) {
    const { t } = useTranslation();
    const [ruleText, setRuleText] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (open && accountId) {
            setLoading(true);
            setError(null);
            window.mailvalet
                .getAccountRules(accountId)
                .then((rules: AccountRules) => {
                    setRuleText(rules.ruleText);
                })
                .catch((e: Error) => {
                    setError(e.message);
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [open, accountId]);

    const handleSave = async () => {
        if (!accountId) return;
        setLoading(true);
        setError(null);
        try {
            await window.mailvalet.saveAccountRules(accountId, { ruleText, lines: [] });
            onSave();
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{t('rule.editorTitle')}</DialogTitle>
            <DialogContent>
                <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        {t('rule.syntaxHelp')}
                    </Typography>
                </Box>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}
                <TextField
                    multiline
                    fullWidth
                    minRows={10}
                    maxRows={20}
                    value={ruleText}
                    onChange={e => setRuleText(e.target.value)}
                    disabled={loading}
                    placeholder={`subject:".*Undelivered.*Mail.*"
subject:".*Undeliverable:.*"
subject:".*Delayed Mail.*" subject:".*retried.*"
body:".*UQUD12W.*"
".*keyword.*"`}
                    sx={{
                        fontFamily: 'monospace',
                        '& .MuiInputBase-input': {
                            fontFamily: 'monospace',
                            fontSize: '0.875rem',
                        },
                    }}
                />
                <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                        {t('rule.syntaxExample')}
                    </Typography>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={loading}>
                    {t('common.cancel')}
                </Button>
                <Button onClick={handleSave} variant="contained" disabled={loading}>
                    {t('common.save')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
