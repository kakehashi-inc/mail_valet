import { Box, Typography, Slider, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useEmailStore } from '../stores/useEmailStore';

export default function AIFilterBar() {
    const { t } = useTranslation();
    const { aiFilterMarketing, aiFilterSpam, setAIFilterMarketing, setAIFilterSpam } = useEmailStore();

    return (
        <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                {t('filter.aiFilter')}:
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 200 }}>
                <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>M</Typography>
                <Slider
                    size="small"
                    value={aiFilterMarketing}
                    onChange={(_e, v) => setAIFilterMarketing(v as [number, number])}
                    min={0}
                    max={10}
                    step={1}
                    valueLabelDisplay="auto"
                    sx={{ mx: 1 }}
                />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 200 }}>
                <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>S</Typography>
                <Slider
                    size="small"
                    value={aiFilterSpam}
                    onChange={(_e, v) => setAIFilterSpam(v as [number, number])}
                    min={0}
                    max={10}
                    step={1}
                    valueLabelDisplay="auto"
                    sx={{ mx: 1 }}
                />
            </Box>
            <Button
                size="small"
                variant="text"
                onClick={() => {
                    setAIFilterMarketing([0, 10]);
                    setAIFilterSpam([0, 10]);
                }}
            >
                {t('filter.reset')}
            </Button>
        </Box>
    );
}
