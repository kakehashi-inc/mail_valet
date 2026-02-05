import React from 'react';
import {
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Button,
    Chip,
    Collapse,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import { useTranslation } from 'react-i18next';
import type { DetailWindowData, EmailMessage } from '@shared/types';

export default function DetailWindow() {
    const { t } = useTranslation();
    const [data, setData] = React.useState<DetailWindowData | null>(null);
    const [selectedMessageId, setSelectedMessageId] = React.useState<string | null>(null);
    const [bodyContent, setBodyContent] = React.useState('');
    const [showRaw, setShowRaw] = React.useState(false);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        window.mailvalet.getDetailData().then(d => setData(d));
    }, []);

    const handleSelectMessage = async (msg: EmailMessage) => {
        if (selectedMessageId === msg.id) {
            setSelectedMessageId(null);
            return;
        }
        setSelectedMessageId(msg.id);
        setShowRaw(false);
        setLoading(true);
        try {
            const body = await window.mailvalet.getEmailBody(data!.accountId, msg.id);
            setBodyContent(body);
        } catch {
            setBodyContent('Failed to load email body');
        }
        setLoading(false);
    };

    const handleToggleRaw = async () => {
        if (!selectedMessageId || !data) return;
        if (!showRaw) {
            setLoading(true);
            try {
                const raw = await window.mailvalet.getEmailRaw(data.accountId, selectedMessageId);
                setBodyContent(raw);
            } catch {
                setBodyContent('Failed to load raw data');
            }
            setLoading(false);
        } else {
            try {
                const body = await window.mailvalet.getEmailBody(data.accountId, selectedMessageId);
                setBodyContent(body);
            } catch {
                setBodyContent('');
            }
        }
        setShowRaw(!showRaw);
    };

    if (!data) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography>Loading...</Typography>
            </Box>
        );
    }

    const selectedMsg = data.messages.find(m => m.id === selectedMessageId);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <Box sx={{ px: 2, py: 1, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                    {data.fromAddress} ({data.messages.length}{t('detail.items')})
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                    <Typography variant="caption">
                        {t('list.marketing')}: {data.aiScoreRange.marketing[0] >= 0
                            ? `${data.aiScoreRange.marketing[0]}-${data.aiScoreRange.marketing[1]}`
                            : '-'}
                    </Typography>
                    <Typography variant="caption">
                        {t('list.spam')}: {data.aiScoreRange.spam[0] >= 0
                            ? `${data.aiScoreRange.spam[0]}-${data.aiScoreRange.spam[1]}`
                            : '-'}
                    </Typography>
                </Box>
            </Box>

            <TableContainer sx={{ flexGrow: 1, overflow: 'auto' }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>{t('detail.date')}</TableCell>
                            <TableCell>{t('detail.subject')}</TableCell>
                            <TableCell align="center" sx={{ width: 50, whiteSpace: 'nowrap' }}>{t('list.marketing')}</TableCell>
                            <TableCell align="center" sx={{ width: 50, whiteSpace: 'nowrap' }}>{t('list.spam')}</TableCell>
                            <TableCell align="center" sx={{ width: 60 }} />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {data.messages.map(msg => (
                            <React.Fragment key={msg.id}>
                                <TableRow
                                    hover
                                    selected={msg.id === selectedMessageId}
                                    onClick={() => handleSelectMessage(msg)}
                                    sx={{ cursor: 'pointer' }}
                                >
                                    <TableCell sx={{ whiteSpace: 'nowrap', width: 160 }}>
                                        {new Date(msg.date).toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                        <Typography
                                            variant="body2"
                                            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 350 }}
                                        >
                                            {msg.subject}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Typography variant="body2">{msg.aiJudgment?.marketing ?? '-'}</Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Typography variant="body2">{msg.aiJudgment?.spam ?? '-'}</Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                                            {msg.isImportant && <PriorityHighIcon fontSize="small" color="warning" />}
                                            {msg.isStarred ? (
                                                <StarIcon fontSize="small" color="warning" />
                                            ) : (
                                                <StarBorderIcon fontSize="small" color="disabled" />
                                            )}
                                        </Box>
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell colSpan={5} sx={{ p: 0, borderBottom: msg.id === selectedMessageId ? 1 : 0 }}>
                                        <Collapse in={msg.id === selectedMessageId} timeout="auto" unmountOnExit>
                                            <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                                                    <Chip
                                                        label={msg.isImportant ? t('detail.important') : t('detail.notImportant')}
                                                        size="small"
                                                        color={msg.isImportant ? 'warning' : 'default'}
                                                        variant="outlined"
                                                    />
                                                    <Chip
                                                        icon={msg.isStarred ? <StarIcon /> : <StarBorderIcon />}
                                                        label={msg.isStarred ? t('detail.starred') : t('detail.notStarred')}
                                                        size="small"
                                                        color={msg.isStarred ? 'warning' : 'default'}
                                                        variant="outlined"
                                                    />
                                                    {selectedMsg?.aiJudgment && (
                                                        <>
                                                            <Typography variant="caption">
                                                                {t('list.marketing')}: {selectedMsg.aiJudgment.marketing}/10
                                                            </Typography>
                                                            <Typography variant="caption">
                                                                {t('list.spam')}: {selectedMsg.aiJudgment.spam}/10
                                                            </Typography>
                                                        </>
                                                    )}
                                                    <Box sx={{ flexGrow: 1 }} />
                                                    <Button size="small" variant="outlined" onClick={handleToggleRaw}>
                                                        {showRaw ? t('detail.showBody') : t('detail.showRaw')}
                                                    </Button>
                                                </Box>
                                                <Paper
                                                    variant="outlined"
                                                    sx={{
                                                        p: 2,
                                                        maxHeight: 400,
                                                        overflow: 'auto',
                                                        whiteSpace: 'pre-wrap',
                                                        fontFamily: showRaw ? 'monospace' : 'inherit',
                                                        fontSize: '0.85rem',
                                                    }}
                                                >
                                                    {loading ? 'Loading...' : bodyContent}
                                                </Paper>
                                            </Box>
                                        </Collapse>
                                    </TableCell>
                                </TableRow>
                            </React.Fragment>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}
