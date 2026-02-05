import { Dialog, DialogTitle, DialogContent, DialogActions, Button, LinearProgress, Typography, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface Props {
    open: boolean;
    title: string;
    current: number;
    total: number;
    message: string;
    onCancel?: () => void;
}

export default function ProgressDialog({ open, title, current, total, message, onCancel }: Props) {
    const { t } = useTranslation();
    const progress = total > 0 ? (current / total) * 100 : 0;

    return (
        <Dialog open={open} maxWidth="sm" fullWidth disableEscapeKeyDown>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <Box sx={{ mb: 2 }}>
                    <LinearProgress variant={total > 0 ? 'determinate' : 'indeterminate'} value={progress} />
                </Box>
                <Typography variant="body2" color="text.secondary">
                    {message}
                </Typography>
                {total > 0 && (
                    <Typography variant="caption" color="text.secondary">
                        {current} / {total}
                    </Typography>
                )}
            </DialogContent>
            {onCancel && (
                <DialogActions>
                    <Button onClick={onCancel}>{t('common.cancel')}</Button>
                </DialogActions>
            )}
        </Dialog>
    );
}
