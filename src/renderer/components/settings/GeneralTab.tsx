import React from 'react';
import { Box, FormControl, InputLabel, Select, MenuItem, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { AppLanguage, AppTheme, GeneralSettings } from '@shared/types';

export default function GeneralTab() {
    const { t, i18n } = useTranslation();
    const [settings, setSettings] = React.useState<GeneralSettings | null>(null);

    React.useEffect(() => {
        window.mailvalet.getGeneralSettings().then(setSettings);
    }, []);

    const handleChange = async (field: keyof GeneralSettings, value: string) => {
        if (!settings) return;
        const updated = { ...settings, [field]: value } as GeneralSettings;
        setSettings(updated);
        await window.mailvalet.saveGeneralSettings(updated);

        if (field === 'language') {
            i18n.changeLanguage(value as AppLanguage);
        }
        if (field === 'theme') {
            await window.mailvalet.setTheme(value as AppTheme);
        }
    };

    if (!settings) return null;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h6">{t('settings.generalTitle')}</Typography>
            <FormControl size="small" sx={{ width: 250 }}>
                <InputLabel>{t('settings.language')}</InputLabel>
                <Select
                    value={settings.language}
                    label={t('settings.language')}
                    onChange={e => handleChange('language', e.target.value)}
                >
                    <MenuItem value="ja">{t('settings.japanese')}</MenuItem>
                    <MenuItem value="en">{t('settings.english')}</MenuItem>
                </Select>
            </FormControl>
            <FormControl size="small" sx={{ width: 250 }}>
                <InputLabel>{t('settings.theme')}</InputLabel>
                <Select
                    value={settings.theme}
                    label={t('settings.theme')}
                    onChange={e => handleChange('theme', e.target.value)}
                >
                    <MenuItem value="system">{t('settings.system')}</MenuItem>
                    <MenuItem value="light">{t('settings.light')}</MenuItem>
                    <MenuItem value="dark">{t('settings.dark')}</MenuItem>
                </Select>
            </FormControl>
        </Box>
    );
}
