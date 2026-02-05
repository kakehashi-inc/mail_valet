import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useEmailStore } from '../stores/useEmailStore';
import { useAppStore } from '../stores/useAppStore';

export default function StatusBar() {
    const { t } = useTranslation();
    const { samplingResult, fromGroups } = useEmailStore();
    const { statusMessage } = useAppStore();

    const text = statusMessage
        ? statusMessage
        : samplingResult
          ? t('status.loaded', {
                count: samplingResult.totalCount,
                groups: fromGroups.length,
            })
          : t('status.ready');

    return (
        <Box
            sx={{
                px: 2,
                py: 0.5,
                borderTop: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
            }}
        >
            <Typography variant="caption" color="text.secondary">
                {text}
            </Typography>
        </Box>
    );
}
