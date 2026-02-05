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

interface Props {
    open: boolean;
    onClose: () => void;
}

export default function SettingsDialog({ open, onClose }: Props) {
    const { t } = useTranslation();
    const [tab, setTab] = React.useState(0);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { height: '80vh' } }}>
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
                    {tab === 0 && <GeneralTab />}
                    {tab === 1 && <FetchTab />}
                    {tab === 2 && <DeleteTab />}
                    {tab === 3 && <OllamaTab />}
                    {tab === 4 && <AIJudgmentTab />}
                    {tab === 5 && <GcpTab />}
                    {tab === 6 && <AccountsTab />}
                    {tab === 7 && <DataTab />}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('common.close')}</Button>
            </DialogActions>
        </Dialog>
    );
}
