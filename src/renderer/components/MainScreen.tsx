import React from 'react';
import { Box, Button } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import { useTranslation } from 'react-i18next';
import FetchControls from './FetchControls';
import AIFilterBar from './AIFilterBar';
import FromGroupTable from './FromGroupTable';
import StatusBar from './StatusBar';
import ConfirmDialog from './ConfirmDialog';
import { useAccountStore } from '../stores/useAccountStore';
import { useEmailStore } from '../stores/useEmailStore';
import { useAppStore } from '../stores/useAppStore';

export default function MainScreen() {
    const { t } = useTranslation();
    const { activeAccountId } = useAccountStore();
    const { selectedFromAddresses, samplingResult, runAIJudgment, isJudging } = useEmailStore();
    const { setStatusMessage } = useAppStore();
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [ollamaConfigured, setOllamaConfigured] = React.useState(false);

    React.useEffect(() => {
        window.mailvalet.getOllamaSettings().then(s => {
            setOllamaConfigured(!!s.host && !!s.model);
        });
    }, []);

    const handleAIJudgment = async () => {
        if (!activeAccountId) return;
        try {
            await runAIJudgment(activeAccountId);
            setStatusMessage(t('status.aiComplete'));
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setStatusMessage(`AI Error: ${msg}`);
        }
    };

    const handleBulkDelete = async () => {
        if (!activeAccountId || selectedFromAddresses.size === 0) return;
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        setDeleteDialogOpen(false);
        if (!activeAccountId) return;

        const addresses = Array.from(selectedFromAddresses);
        setStatusMessage(t('status.deleting'));

        try {
            const result = await window.mailvalet.bulkDeleteByFrom(activeAccountId, addresses);
            setStatusMessage(
                t('status.deleteResult', {
                    trashed: result.trashed,
                    excluded: result.excluded,
                    errors: result.errors,
                })
            );
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setStatusMessage(`Delete error: ${msg}`);
        }
    };

    const selectedCount = selectedFromAddresses.size;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
            <FetchControls />
            <AIFilterBar />
            <FromGroupTable />
            <Box sx={{ px: 2, py: 1, display: 'flex', gap: 1, borderTop: 1, borderColor: 'divider' }}>
                <Button
                    variant="contained"
                    size="small"
                    startIcon={<SmartToyIcon />}
                    onClick={handleAIJudgment}
                    disabled={!activeAccountId || !samplingResult || isJudging || !ollamaConfigured}
                >
                    {t('action.aiJudge')}
                </Button>
                <Button
                    variant="contained"
                    color="error"
                    size="small"
                    startIcon={<DeleteSweepIcon />}
                    onClick={handleBulkDelete}
                    disabled={!activeAccountId || selectedCount === 0}
                >
                    {t('action.bulkDelete')} ({selectedCount})
                </Button>
            </Box>
            <StatusBar />
            <ConfirmDialog
                open={deleteDialogOpen}
                title={t('delete.confirmTitle')}
                message={t('delete.confirmMessage', { groups: selectedCount })}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteDialogOpen(false)}
                severity="error"
            />
        </Box>
    );
}
