import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface Props {
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    severity?: 'warning' | 'error' | 'info';
}

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, severity = 'warning' }: Props) {
    const { t } = useTranslation();
    const color = severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : 'primary';

    return (
        <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
            <DialogTitle color={`${color}.main`}>{title}</DialogTitle>
            <DialogContent>
                <Typography>{message}</Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel}>{t('common.cancel')}</Button>
                <Button onClick={onConfirm} color={color} variant="contained">
                    {t('common.confirm')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
