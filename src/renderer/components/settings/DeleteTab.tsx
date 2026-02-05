import { Box, FormControlLabel, Checkbox, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { DeleteSettings } from '@shared/types';

interface Props {
    settings: DeleteSettings;
    onChange: (settings: DeleteSettings) => void;
}

export default function DeleteTab({ settings, onChange }: Props) {
    const { t } = useTranslation();

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6">{t('settings.deleteTitle')}</Typography>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={settings.excludeImportant}
                        onChange={(e) => onChange({ ...settings, excludeImportant: e.target.checked })}
                    />
                }
                label={t('settings.excludeImportant')}
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={settings.excludeStarred}
                        onChange={(e) => onChange({ ...settings, excludeStarred: e.target.checked })}
                    />
                }
                label={t('settings.excludeStarred')}
            />
        </Box>
    );
}
