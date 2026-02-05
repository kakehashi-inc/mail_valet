import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Tabs, Tab, Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import GeneralTab from './settings/GeneralTab';
import FetchTab from './settings/FetchTab';
import DeleteTab from './settings/DeleteTab';
import OllamaTab from './settings/OllamaTab';
import AIJudgmentTab from './settings/AIJudgmentTab';
import GcpTab from './settings/GcpTab';
import AccountsTab from './settings/AccountsTab';
import DataTab from './settings/DataTab';
import { useAppStore } from '../stores/useAppStore';
import type {
    GeneralSettings,
    FetchSettings,
    DeleteSettings,
    OllamaSettings,
    AIJudgmentSettings,
    GcpSettings,
} from '@shared/types';

type SettingsDraft = {
    general: GeneralSettings;
    fetch: FetchSettings;
    delete: DeleteSettings;
    ollama: OllamaSettings;
    aiJudgment: AIJudgmentSettings;
    gcp: GcpSettings;
};

interface Props {
    open: boolean;
    onClose: () => void;
}

export default function SettingsDialog({ open, onClose }: Props) {
    const { t, i18n } = useTranslation();
    const [tab, setTab] = React.useState(0);
    const [draft, setDraft] = React.useState<SettingsDraft | null>(null);

    React.useEffect(() => {
        if (open) {
            Promise.all([
                window.mailvalet.getGeneralSettings(),
                window.mailvalet.getFetchSettings(),
                window.mailvalet.getDeleteSettings(),
                window.mailvalet.getOllamaSettings(),
                window.mailvalet.getAIJudgmentSettings(),
                window.mailvalet.getGcpSettings(),
            ]).then(([general, fetch, del, ollama, aiJudgment, gcp]) => {
                setDraft({ general, fetch, delete: del, ollama, aiJudgment, gcp });
            });
        } else {
            setDraft(null);
            setTab(0);
        }
    }, [open]);

    const handleSave = async () => {
        if (!draft) return;
        await Promise.all([
            window.mailvalet.saveGeneralSettings(draft.general),
            window.mailvalet.saveFetchSettings(draft.fetch),
            window.mailvalet.saveDeleteSettings(draft.delete),
            window.mailvalet.saveOllamaSettings(draft.ollama),
            window.mailvalet.saveAIJudgmentSettings(draft.aiJudgment),
            window.mailvalet.saveGcpSettings(draft.gcp),
        ]);
        const resolved = await window.mailvalet.setTheme(draft.general.theme);
        useAppStore.getState().updateInfo({ theme: resolved });
        i18n.changeLanguage(draft.general.language);
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{ sx: { height: '80vh' } }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
                {t('settings.title')}
                <Box sx={{ flexGrow: 1 }} />
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <Tabs
                value={tab}
                onChange={(_e, v) => setTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
            >
                <Tab label={t('settings.general')} />
                <Tab label={t('settings.fetch')} />
                <Tab label={t('settings.delete')} />
                <Tab label={t('settings.ollama')} />
                <Tab label={t('settings.aiJudgment')} />
                <Tab label={t('settings.gcp')} />
                <Tab label={t('settings.accounts')} />
                <Tab label={t('settings.data')} />
            </Tabs>
            <DialogContent sx={{ p: 0 }}>
                <Box sx={{ p: 3 }}>
                    {draft && tab === 0 && (
                        <GeneralTab
                            settings={draft.general}
                            onChange={(s) => setDraft((d) => (d ? { ...d, general: s } : d))}
                        />
                    )}
                    {draft && tab === 1 && (
                        <FetchTab
                            settings={draft.fetch}
                            onChange={(s) => setDraft((d) => (d ? { ...d, fetch: s } : d))}
                        />
                    )}
                    {draft && tab === 2 && (
                        <DeleteTab
                            settings={draft.delete}
                            onChange={(s) => setDraft((d) => (d ? { ...d, delete: s } : d))}
                        />
                    )}
                    {draft && tab === 3 && (
                        <OllamaTab
                            settings={draft.ollama}
                            onChange={(s) => setDraft((d) => (d ? { ...d, ollama: s } : d))}
                        />
                    )}
                    {draft && tab === 4 && (
                        <AIJudgmentTab
                            settings={draft.aiJudgment}
                            onChange={(s) => setDraft((d) => (d ? { ...d, aiJudgment: s } : d))}
                        />
                    )}
                    {draft && tab === 5 && (
                        <GcpTab
                            settings={draft.gcp}
                            onChange={(s) => setDraft((d) => (d ? { ...d, gcp: s } : d))}
                        />
                    )}
                    {tab === 6 && <AccountsTab />}
                    {tab === 7 && <DataTab />}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button variant="contained" onClick={handleSave}>
                    {t('common.apply')}
                </Button>
                <Button onClick={onClose}>{t('common.cancel')}</Button>
            </DialogActions>
        </Dialog>
    );
}
