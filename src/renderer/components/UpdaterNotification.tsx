import React from 'react';
import { Snackbar, Button, Box, Typography, LinearProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { UpdateState } from '@shared/types';

export default function UpdaterNotification() {
    const { t } = useTranslation();
    const [state, setState] = React.useState<UpdateState>({ status: 'idle' });
    const [dismissed, setDismissed] = React.useState(false);

    React.useEffect(() => {
        // Subscribe first to avoid missing events between getState and subscribe.
        const unsubscribe = window.mailvalet.updater.onStateChanged(setState);
        window.mailvalet.updater.getState().then(setState);
        return () => unsubscribe();
    }, []);

    const { status, version, progress } = state;

    const isVisible =
        !dismissed && (status === 'available' || status === 'downloading' || status === 'downloaded');

    if (!isVisible) return null;

    const handleUpdate = () => {
        void window.mailvalet.updater.download();
    };

    const handleLater = () => {
        setDismissed(true);
    };

    let content: React.ReactNode = null;

    if (status === 'available') {
        content = (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 320 }}>
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                    {t('updater.confirm', { version })}
                </Typography>
                <Button size="small" variant="contained" onClick={handleUpdate}>
                    {t('updater.update')}
                </Button>
                <Button size="small" onClick={handleLater}>
                    {t('updater.later')}
                </Button>
            </Box>
        );
    } else if (status === 'downloading') {
        const pct = Math.max(0, Math.min(100, Math.round(progress ?? 0)));
        content = (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 320 }}>
                <Typography variant="body2">{t('updater.downloading', { progress: pct })}</Typography>
                <LinearProgress variant="determinate" value={pct} />
            </Box>
        );
    } else if (status === 'downloaded') {
        content = (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 320 }}>
                <Typography variant="body2">{t('updater.installing')}</Typography>
                <LinearProgress />
            </Box>
        );
    }

    return (
        <Snackbar
            open
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            autoHideDuration={null}
            message={content}
        />
    );
}
