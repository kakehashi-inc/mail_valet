import React from 'react';
import { Box, Button } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DateRangeIcon from '@mui/icons-material/DateRange';
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
    const {
        selectedGroupKeys,
        samplingResult,
        runAIJudgment,
        isJudging,
        groupMode,
        getFilteredFromGroups,
        getFilteredSubjectGroups,
    } = useEmailStore();
    const { setStatusMessage } = useAppStore();
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [periodDeleteDialogOpen, setPeriodDeleteDialogOpen] = React.useState(false);
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

    const handleBulkDelete = () => {
        if (!activeAccountId || selectedGroupKeys.size === 0) return;
        setDeleteDialogOpen(true);
    };

    const handlePeriodDelete = () => {
        if (!activeAccountId || selectedGroupKeys.size === 0) return;
        setPeriodDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        setDeleteDialogOpen(false);
        if (!activeAccountId) return;

        setStatusMessage(t('status.deleting'));

        try {
            let result;
            if (groupMode === 'from') {
                result = await window.mailvalet.bulkDeleteByFrom(activeAccountId, Array.from(selectedGroupKeys));
            } else {
                const groups = getFilteredSubjectGroups();
                const subjects = groups
                    .filter(g => selectedGroupKeys.has(g.subject))
                    .map(g => g.displaySubject);
                result = await window.mailvalet.bulkDeleteBySubject(activeAccountId, subjects);
            }
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

    const confirmPeriodDelete = async () => {
        setPeriodDeleteDialogOpen(false);
        if (!activeAccountId) return;

        setStatusMessage(t('status.deleting'));

        try {
            const deleteSettings = await window.mailvalet.getDeleteSettings();

            // Collect messages from selected groups
            let selectedMessages;
            if (groupMode === 'from') {
                const groups = getFilteredFromGroups();
                selectedMessages = groups
                    .filter(g => selectedGroupKeys.has(g.fromAddress))
                    .flatMap(g => g.messages);
            } else {
                const groups = getFilteredSubjectGroups();
                selectedMessages = groups
                    .filter(g => selectedGroupKeys.has(g.subject))
                    .flatMap(g => g.messages);
            }

            // Apply exclusion filters
            const filteredMessages = selectedMessages.filter(msg => {
                if (deleteSettings.excludeImportant && msg.isImportant) return false;
                if (deleteSettings.excludeStarred && msg.isStarred) return false;
                return true;
            });

            if (filteredMessages.length === 0) {
                setStatusMessage(t('status.periodDeleteNoMessages'));
                return;
            }

            const messageIds = filteredMessages.map(msg => msg.id);
            const excluded = selectedMessages.length - filteredMessages.length;
            const result = await window.mailvalet.deleteByMessageIds(activeAccountId, messageIds);
            setStatusMessage(
                t('status.deleteResult', {
                    trashed: result.trashed,
                    excluded: excluded + result.excluded,
                    errors: result.errors,
                })
            );
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setStatusMessage(`Delete error: ${msg}`);
        }
    };

    const selectedCount = selectedGroupKeys.size;
    const bulkDeleteMessage =
        groupMode === 'from'
            ? t('delete.confirmMessage', { groups: selectedCount })
            : t('delete.bulkConfirmMessageSubject', { groups: selectedCount });

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
                    color="warning"
                    size="small"
                    startIcon={<DateRangeIcon />}
                    onClick={handlePeriodDelete}
                    disabled={!activeAccountId || selectedCount === 0}
                >
                    {t('action.periodDelete')} ({selectedCount})
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
                message={bulkDeleteMessage}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteDialogOpen(false)}
                severity="error"
            />
            <ConfirmDialog
                open={periodDeleteDialogOpen}
                title={t('delete.periodConfirmTitle')}
                message={t('delete.periodConfirmMessage', { groups: selectedCount })}
                onConfirm={confirmPeriodDelete}
                onCancel={() => setPeriodDeleteDialogOpen(false)}
                severity="warning"
            />
        </Box>
    );
}
