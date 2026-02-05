import { Box, FormControl, InputLabel, Select, MenuItem, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { GeneralSettings } from '@shared/types';

interface Props {
    settings: GeneralSettings;
    onChange: (settings: GeneralSettings) => void;
}

export default function GeneralTab({ settings, onChange }: Props) {
    const { t } = useTranslation();

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h6">{t('settings.generalTitle')}</Typography>
            <FormControl size="small" sx={{ width: 250 }}>
                <InputLabel>{t('settings.language')}</InputLabel>
                <Select
                    value={settings.language}
                    label={t('settings.language')}
                    onChange={(e) => onChange({ ...settings, language: e.target.value as GeneralSettings['language'] })}
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
                    onChange={(e) => onChange({ ...settings, theme: e.target.value as GeneralSettings['theme'] })}
                >
                    <MenuItem value="system">{t('settings.system')}</MenuItem>
                    <MenuItem value="light">{t('settings.light')}</MenuItem>
                    <MenuItem value="dark">{t('settings.dark')}</MenuItem>
                </Select>
            </FormControl>
        </Box>
    );
}
