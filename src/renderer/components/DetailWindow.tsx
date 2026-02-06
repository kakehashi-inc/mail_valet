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
} from '@mui/material';
import MinimizeIcon from '@mui/icons-material/Minimize';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import CloseIcon from '@mui/icons-material/Close';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import StarIcon from '@mui/icons-material/Star';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../stores/useAppStore';
import type { DetailWindowData, EmailMessage, EmailBodyParts } from '@shared/types';

type ViewMode = 'html' | 'htmlText' | 'plain' | 'raw';

export default function DetailWindow() {
    const { t } = useTranslation();
    const info = useAppStore((s) => s.info);
    const isMac = info?.os === 'darwin';
    const [data, setData] = React.useState<DetailWindowData | null>(null);
    const [selectedMessageId, setSelectedMessageId] = React.useState<string | null>(null);
    const [bodyParts, setBodyParts] = React.useState<EmailBodyParts | null>(null);
    const [rawContent, setRawContent] = React.useState('');
    const [viewMode, setViewMode] = React.useState<ViewMode>('html');
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        window.mailvalet.getDetailData().then((d) => setData(d));
    }, []);

    const handleSelectMessage = async (msg: EmailMessage) => {
        if (selectedMessageId === msg.id) return;
        setSelectedMessageId(msg.id);
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
            console.error('[DetailWindow] Failed to load email body:', e);
            setBodyParts({ plain: '', html: '' });
            setRawContent('Failed to load email');
        }
        setLoading(false);
    };

    if (!data) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography>Loading...</Typography>
            </Box>
        );
    }

    const selectedMsg = data.messages.find((m) => m.id === selectedMessageId);

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
            .replace(/&#\d+;/g, (m) => String.fromCharCode(parseInt(m.slice(2, -1))))
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
                        {data.fromAddress} ({data.messages.length}
                        {t('detail.items')})
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {t('list.marketing')}:{' '}
                        {data.aiScoreRange.marketing[0] >= 0
                            ? `${data.aiScoreRange.marketing[0]}-${data.aiScoreRange.marketing[1]}`
                            : '-'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {t('list.spam')}:{' '}
                        {data.aiScoreRange.spam[0] >= 0
                            ? `${data.aiScoreRange.spam[0]}-${data.aiScoreRange.spam[1]}`
                            : '-'}
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

            {/* Content area: left list + right detail */}
            <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
                {/* Left panel - message list */}
                <Box
                    sx={{
                        width: 280,
                        flexShrink: 0,
                        borderRight: 1,
                        borderColor: 'divider',
                        overflowY: 'auto',
                    }}
                >
                    <List disablePadding>
                        {data.messages.map((msg) => (
                            <ListItemButton
                                key={msg.id}
                                selected={msg.id === selectedMessageId}
                                onClick={() => handleSelectMessage(msg)}
                                sx={{ flexDirection: 'column', alignItems: 'stretch', py: 0.75, px: 1.5 }}
                            >
                                {/* Row 1: icons (left) + date (right) */}
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    {msg.isImportant && (
                                        <PriorityHighIcon
                                            sx={{ fontSize: '0.85rem', color: 'warning.main', mr: 0.25 }}
                                        />
                                    )}
                                    {msg.isStarred && (
                                        <StarIcon sx={{ fontSize: '0.85rem', color: 'warning.main', mr: 0.25 }} />
                                    )}
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ textAlign: 'right', fontSize: '0.7rem', flexGrow: 1 }}
                                    >
                                        {new Date(msg.date).toLocaleString()}
                                    </Typography>
                                </Box>
                                {/* Row 2: from (slightly smaller, ellipsis) */}
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
                                {/* Row 3: subject (ellipsis) */}
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                >
                                    {msg.subject}
                                </Typography>
                                {/* Row 4: AI scores (only if judged) */}
                                {msg.aiJudgment && (
                                    <Typography variant="caption" color="text.secondary">
                                        {t('list.marketing')}:{msg.aiJudgment.marketing} {t('list.spam')}:
                                        {msg.aiJudgment.spam}
                                    </Typography>
                                )}
                            </ListItemButton>
                        ))}
                    </List>
                </Box>

                {/* Right panel - email content */}
                <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {!selectedMsg ? (
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
                                    {selectedMsg.subject}
                                </Typography>
                                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                                    {t('detail.from')}: {selectedMsg.from}
                                </Typography>
                                <Typography variant="body2">
                                    {t('detail.date')}: {new Date(selectedMsg.date).toLocaleString()}
                                </Typography>
                                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                                    {t('detail.to')}: {selectedMsg.to}
                                </Typography>
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
        </Box>
    );
}
