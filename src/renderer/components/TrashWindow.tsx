import React from 'react';
import {
    Box,
    Typography,
    List,
    ListItemButton,
    Paper,
    ToggleButtonGroup,
    ToggleButton,
    Divider,
    IconButton,
    Button,
    Checkbox,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
} from '@mui/material';
import MinimizeIcon from '@mui/icons-material/Minimize';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import CloseIcon from '@mui/icons-material/Close';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import DeselectIcon from '@mui/icons-material/Deselect';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../stores/useAppStore';
import type { TrashWindowData, EmailMessage, EmailBodyParts, EmailAttachmentInfo } from '@shared/types';
import { parseAttachmentsFromRaw } from '@shared/mime-utils';

type ViewMode = 'html' | 'htmlText' | 'plain' | 'raw';

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TrashWindow() {
    const { t } = useTranslation();
    const info = useAppStore(s => s.info);
    const isMac = info?.os === 'darwin';
    const [data, setData] = React.useState<TrashWindowData | null>(null);
    const [messages, setMessages] = React.useState<EmailMessage[]>([]);
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
    const [activeMessageId, setActiveMessageId] = React.useState<string | null>(null);
    const [bodyParts, setBodyParts] = React.useState<EmailBodyParts | null>(null);
    const [rawContent, setRawContent] = React.useState('');
    const [viewMode, setViewMode] = React.useState<ViewMode>('html');
    const [loading, setLoading] = React.useState(false);
    const [fetchingTrash, setFetchingTrash] = React.useState(false);
    const [confirmDialog, setConfirmDialog] = React.useState<'selected' | 'empty' | null>(null);
    const [deleting, setDeleting] = React.useState(false);
    const attachments: EmailAttachmentInfo[] = React.useMemo(
        () => parseAttachmentsFromRaw(rawContent),
        [rawContent]
    );

    React.useEffect(() => {
        window.mailvalet.getTrashData().then(d => {
            setData(d);
            if (d) {
                setFetchingTrash(true);
                window.mailvalet
                    .fetchTrash(d.accountId)
                    .then(msgs => {
                        setMessages(msgs);
                    })
                    .catch(e => {
                        console.error('[TrashWindow] Failed to fetch trash:', e);
                    })
                    .finally(() => {
                        setFetchingTrash(false);
                    });
            }
        });
    }, []);

    const handleSelectMessage = async (msg: EmailMessage) => {
        if (activeMessageId === msg.id) return;
        setActiveMessageId(msg.id);
        setLoading(true);
        try {
            const [parts, raw] = await Promise.all([
                window.mailvalet.getEmailBodyParts(data!.accountId, msg.id),
                window.mailvalet.getEmailRaw(data!.accountId, msg.id),
            ]);
            setBodyParts(parts);
            setRawContent(raw);
            if (parts.html) {
                setViewMode('html');
            } else if (parts.plain) {
                setViewMode('plain');
            } else {
                setViewMode('raw');
            }
        } catch (e) {
            console.error('[TrashWindow] Failed to load email body:', e);
            setBodyParts({ plain: '', html: '' });
            setRawContent('Failed to load email');
        }
        setLoading(false);
    };

    const handleToggleCheck = (msgId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(msgId)) {
                next.delete(msgId);
            } else {
                next.add(msgId);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        setSelectedIds(new Set(messages.map(m => m.id)));
    };

    const handleDeselectAll = () => {
        setSelectedIds(new Set());
    };

    const handleDeleteSelected = async () => {
        if (!data || selectedIds.size === 0) return;
        setDeleting(true);
        try {
            const ids = Array.from(selectedIds);
            await window.mailvalet.deleteTrashMessages(data.accountId, ids);
            setMessages(prev => prev.filter(m => !selectedIds.has(m.id)));
            setSelectedIds(new Set());
            if (activeMessageId && selectedIds.has(activeMessageId)) {
                setActiveMessageId(null);
                setBodyParts(null);
                setRawContent('');
            }
        } catch (e) {
            console.error('[TrashWindow] Failed to delete selected:', e);
        }
        setDeleting(false);
        setConfirmDialog(null);
    };

    const handleEmptyTrash = async () => {
        if (!data) return;
        setDeleting(true);
        try {
            await window.mailvalet.emptyTrash(data.accountId);
            setMessages([]);
            setSelectedIds(new Set());
            setActiveMessageId(null);
            setBodyParts(null);
            setRawContent('');
        } catch (e) {
            console.error('[TrashWindow] Failed to empty trash:', e);
        }
        setDeleting(false);
        setConfirmDialog(null);
    };

    if (!data) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography>Loading...</Typography>
            </Box>
        );
    }

    const activeMsg = messages.find(m => m.id === activeMessageId);

    const htmlToText = (html: string): string => {
        const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
        const body = bodyMatch ? bodyMatch[1] : html;
        return body
            .replace(/\r\n?/g, '\n')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<\/tr>/gi, '\n')
            .replace(/<\/li>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&#\d+;/g, m => String.fromCharCode(parseInt(m.slice(2, -1))))
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/\u00a0/g, ' ')
            .replace(/[ \t]+/g, ' ')
            .replace(/^ +| +$/gm, '')
            .replace(/(\s*\n){3,}/g, '\n\n')
            .trim();
    };

    const textContent = (): string => {
        if (loading) return 'Loading...';
        if (!bodyParts) return '';
        if (viewMode === 'html') return bodyParts.html || '';
        if (viewMode === 'htmlText') return htmlToText(bodyParts.html || '');
        if (viewMode === 'plain') return bodyParts.plain || '';
        if (viewMode === 'raw') return rawContent;
        return '';
    };

    const hasHtml = !!bodyParts?.html;
    const hasPlain = !!bodyParts?.plain;

    const windowButtonSx = {
        borderRadius: 0,
        width: 40,
        height: 36,
        color: 'text.primary',
        '&:hover': { bgcolor: 'action.hover' },
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            {/* Title bar (drag region) */}
            <Box
                sx={{
                    WebkitAppRegion: 'drag',
                    display: 'flex',
                    alignItems: 'center',
                    px: 2,
                    height: 36,
                    bgcolor: 'background.paper',
                    borderBottom: 1,
                    borderColor: 'divider',
                    userSelect: 'none',
                    flexShrink: 0,
                }}
            >
                <Box sx={{ ml: isMac ? 10 : 0, display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1 }}>
                    <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        {t('trash.title')} ({messages.length} {t('detail.items')})
                    </Typography>
                </Box>
                {!isMac && (
                    <Box sx={{ display: 'flex', alignItems: 'center', WebkitAppRegion: 'no-drag' }}>
                        <IconButton size="small" onClick={() => window.mailvalet.minimize()} sx={windowButtonSx}>
                            <MinimizeIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                            size="small"
                            onClick={() => window.mailvalet.maximizeOrRestore()}
                            sx={windowButtonSx}
                        >
                            <CropSquareIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                            size="small"
                            onClick={() => window.mailvalet.close()}
                            sx={{
                                ...windowButtonSx,
                                '&:hover': { bgcolor: 'error.main', color: 'error.contrastText' },
                            }}
                        >
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Box>
                )}
            </Box>

            {/* Action buttons */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 2,
                    py: 1,
                    borderBottom: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                }}
            >
                <Button
                    size="small"
                    startIcon={<SelectAllIcon />}
                    onClick={handleSelectAll}
                    disabled={messages.length === 0}
                >
                    {t('trash.selectAll')}
                </Button>
                <Button
                    size="small"
                    startIcon={<DeselectIcon />}
                    onClick={handleDeselectAll}
                    disabled={selectedIds.size === 0}
                >
                    {t('trash.deselectAll')}
                </Button>
                <Button
                    size="small"
                    color="warning"
                    startIcon={<DeleteForeverIcon />}
                    onClick={() => setConfirmDialog('selected')}
                    disabled={selectedIds.size === 0 || deleting}
                >
                    {t('trash.deleteSelected')} ({selectedIds.size})
                </Button>
                <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteForeverIcon />}
                    onClick={() => setConfirmDialog('empty')}
                    disabled={messages.length === 0 || deleting}
                >
                    {t('trash.emptyTrash')}
                </Button>
            </Box>

            {/* Content area: left list + right detail */}
            <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
                {/* Left panel - message list */}
                <Box
                    sx={{
                        width: 320,
                        flexShrink: 0,
                        borderRight: 1,
                        borderColor: 'divider',
                        overflowY: 'auto',
                    }}
                >
                    {fetchingTrash ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                            <CircularProgress size={24} />
                            <Typography variant="body2" sx={{ ml: 1 }}>
                                {t('trash.loading')}
                            </Typography>
                        </Box>
                    ) : messages.length === 0 ? (
                        <Box sx={{ p: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                                {t('trash.empty')}
                            </Typography>
                        </Box>
                    ) : (
                        <List disablePadding>
                            {messages.map(msg => (
                                <ListItemButton
                                    key={msg.id}
                                    selected={msg.id === activeMessageId}
                                    onClick={() => handleSelectMessage(msg)}
                                    sx={{ py: 0.75, px: 1 }}
                                >
                                    <Checkbox
                                        checked={selectedIds.has(msg.id)}
                                        onClick={e => handleToggleCheck(msg.id, e)}
                                        size="small"
                                        sx={{ mr: 1, p: 0.5 }}
                                    />
                                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                        {/* Row 1: date */}
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ fontSize: '0.7rem', display: 'block', textAlign: 'right' }}
                                        >
                                            {new Date(msg.date).toLocaleString()}
                                        </Typography>
                                        {/* Row 2: from */}
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                fontSize: '0.8rem',
                                            }}
                                        >
                                            {msg.from}
                                        </Typography>
                                        {/* Row 3: subject */}
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {msg.subject}
                                        </Typography>
                                    </Box>
                                </ListItemButton>
                            ))}
                        </List>
                    )}
                </Box>

                {/* Right panel - email content */}
                <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {!activeMsg ? (
                        <Box
                            sx={{
                                flexGrow: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Typography color="text.secondary">{t('detail.selectMessage')}</Typography>
                        </Box>
                    ) : (
                        <>
                            {/* Email header */}
                            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', wordBreak: 'break-word' }}>
                                    {activeMsg.subject}
                                </Typography>
                                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                                    {t('detail.from')}: {activeMsg.from}
                                </Typography>
                                <Typography variant="body2">
                                    {t('detail.date')}: {new Date(activeMsg.date).toLocaleString()}
                                </Typography>
                                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                                    {t('detail.to')}: {activeMsg.to}
                                </Typography>
                                {attachments.length > 0 && (
                                    <Box sx={{ mt: 0.5 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                                            <AttachFileIcon sx={{ fontSize: '0.9rem', color: 'text.secondary' }} />
                                            <Typography variant="body2" color="text.secondary">
                                                {t('detail.attachments')} ({attachments.length})
                                            </Typography>
                                        </Box>
                                        {attachments.map((att, i) => (
                                            <Typography
                                                key={i}
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{ display: 'block', pl: 2.5 }}
                                            >
                                                {att.filename} ({formatFileSize(att.size)}, {att.mimeType})
                                            </Typography>
                                        ))}
                                    </Box>
                                )}
                                <Divider sx={{ my: 1 }} />
                                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <ToggleButtonGroup
                                        value={viewMode}
                                        exclusive
                                        onChange={(_e, v) => v && setViewMode(v)}
                                        size="small"
                                    >
                                        {hasHtml && <ToggleButton value="html">HTML</ToggleButton>}
                                        {hasHtml && (
                                            <ToggleButton value="htmlText">{t('detail.htmlText')}</ToggleButton>
                                        )}
                                        {hasPlain && <ToggleButton value="plain">PLAIN</ToggleButton>}
                                        <ToggleButton value="raw">RAW</ToggleButton>
                                    </ToggleButtonGroup>
                                </Box>
                            </Box>

                            {/* Body content */}
                            <Paper
                                variant="outlined"
                                sx={{
                                    flexGrow: 1,
                                    m: 1,
                                    p: 2,
                                    overflow: 'auto',
                                    whiteSpace: 'pre-wrap',
                                    fontFamily: 'monospace',
                                    fontSize: '0.85rem',
                                    wordBreak: 'break-word',
                                }}
                            >
                                {textContent()}
                            </Paper>
                        </>
                    )}
                </Box>
            </Box>

            {/* Confirmation Dialog */}
            <Dialog open={confirmDialog !== null} onClose={() => setConfirmDialog(null)}>
                <DialogTitle>
                    {confirmDialog === 'selected' ? t('trash.confirmDeleteSelected') : t('trash.confirmEmptyTrash')}
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        {confirmDialog === 'selected'
                            ? t('trash.confirmDeleteSelectedDesc', { count: selectedIds.size })
                            : t('trash.confirmEmptyTrashDesc', { count: messages.length })}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDialog(null)} disabled={deleting}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        onClick={confirmDialog === 'selected' ? handleDeleteSelected : handleEmptyTrash}
                        color="error"
                        variant="contained"
                        disabled={deleting}
                    >
                        {deleting ? <CircularProgress size={20} /> : t('common.delete')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
