import React from 'react';
import { Box, FormControlLabel, Checkbox, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { DeleteSettings } from '@shared/types';

export default function DeleteTab() {
    const { t } = useTranslation();
    const [settings, setSettings] = React.useState<DeleteSettings>({
        excludeImportant: true,
        excludeStarred: true,
    });

    React.useEffect(() => {
        window.mailvalet.getDeleteSettings().then(setSettings);
    }, []);

    const save = async (updated: DeleteSettings) => {
        setSettings(updated);
        await window.mailvalet.saveDeleteSettings(updated);
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6">{t('settings.deleteTitle')}</Typography>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={settings.excludeImportant}
                        onChange={e => save({ ...settings, excludeImportant: e.target.checked })}
                    />
                }
                label={t('settings.excludeImportant')}
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={settings.excludeStarred}
                        onChange={e => save({ ...settings, excludeStarred: e.target.checked })}
                    />
                }
                label={t('settings.excludeStarred')}
            />
        </Box>
    );
}
