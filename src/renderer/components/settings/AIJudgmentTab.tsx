import React from 'react';
import { Box, FormControlLabel, Checkbox, Typography, Grid } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { AIJudgmentSettings } from '@shared/types';

const LANGUAGE_CODES = ['ja', 'en', 'zh', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'ar', 'it', 'th', 'vi'] as const;
const LANG_KEYS: Record<string, string> = {
    ja: 'settings.langJa',
    en: 'settings.langEn',
    zh: 'settings.langZh',
    ko: 'settings.langKo',
    es: 'settings.langEs',
    fr: 'settings.langFr',
    de: 'settings.langDe',
    pt: 'settings.langPt',
    ru: 'settings.langRu',
    ar: 'settings.langAr',
    it: 'settings.langIt',
    th: 'settings.langTh',
    vi: 'settings.langVi',
};

export default function AIJudgmentTab() {
    const { t } = useTranslation();
    const [settings, setSettings] = React.useState<AIJudgmentSettings>({ allowedLanguages: [] });

    React.useEffect(() => {
        window.mailvalet.getAIJudgmentSettings().then(setSettings);
    }, []);

    const save = async (updated: AIJudgmentSettings) => {
        setSettings(updated);
        await window.mailvalet.saveAIJudgmentSettings(updated);
    };

    const isAll = settings.allowedLanguages.length === 0;

    const handleAllChange = (checked: boolean) => {
        if (checked) {
            save({ allowedLanguages: [] });
        }
    };

    const handleLangChange = (code: string, checked: boolean) => {
        const current = settings.allowedLanguages;
        const updated = checked ? [...current, code] : current.filter(c => c !== code);
        save({ allowedLanguages: updated });
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6">{t('settings.aiJudgmentTitle')}</Typography>
            <Typography variant="body2" color="text.secondary">
                {t('settings.allowedLanguagesHelp')}
            </Typography>
            <Typography variant="subtitle2">{t('settings.allowedLanguages')}</Typography>
            <FormControlLabel
                control={<Checkbox checked={isAll} onChange={(_e, checked) => handleAllChange(checked)} />}
                label={t('settings.langAll')}
            />
            <Grid container spacing={1} sx={{ pl: 1 }}>
                {LANGUAGE_CODES.map(code => (
                    <Grid size={{ xs: 6 }} key={code}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={settings.allowedLanguages.includes(code)}
                                    onChange={(_e, checked) => handleLangChange(code, checked)}
                                    disabled={isAll}
                                />
                            }
                            label={t(LANG_KEYS[code])}
                        />
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
}
