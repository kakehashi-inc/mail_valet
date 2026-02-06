import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    Checkbox,
    IconButton,
    Typography,
    Box,
    TextField,
    InputAdornment,
    ToggleButtonGroup,
    ToggleButton,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import { useEmailStore } from '../stores/useEmailStore';
import { useAccountStore } from '../stores/useAccountStore';
import type { FromGroup, SubjectGroup } from '@shared/types';

function ScoreRange({ range }: { range: [number, number] }) {
    if (range[0] < 0) return <Typography variant="body2">-</Typography>;
    if (range[0] === range[1]) return <Typography variant="body2">{range[0]}</Typography>;
    return (
        <Typography variant="body2">
            {range[0]}-{range[1]}
        </Typography>
    );
}

const noWrap = { whiteSpace: 'nowrap' } as const;

export default function FromGroupTable() {
    const { t } = useTranslation();
    const { activeAccountId } = useAccountStore();
    const {
        groupMode,
        setGroupMode,
        sortKey,
        sortAsc,
        searchQuery,
        selectedGroupKeys,
        setSortKey,
        setSearchQuery,
        toggleGroupSelection,
        selectAllGroups,
        getFilteredFromGroups,
        getFilteredSubjectGroups,
    } = useEmailStore();

    const isFromMode = groupMode === 'from';
    const filteredFromGroups = isFromMode ? getFilteredFromGroups() : [];
    const filteredSubjectGroups = !isFromMode ? getFilteredSubjectGroups() : [];
    const groupCount = isFromMode ? filteredFromGroups.length : filteredSubjectGroups.length;
    const allSelected =
        groupCount > 0 &&
        (isFromMode
            ? filteredFromGroups.every(g => selectedGroupKeys.has(g.fromAddress))
            : filteredSubjectGroups.every(g => selectedGroupKeys.has(g.subject)));

    const handleOpenDetailFrom = (group: FromGroup) => {
        if (!activeAccountId) return;
        window.mailvalet.openDetailWindow({
            fromAddress: group.fromAddress,
            fromNames: group.fromNames,
            messages: group.messages,
            aiScoreRange: group.aiScoreRange,
            accountId: activeAccountId,
        });
    };

    const handleOpenDetailSubject = (group: SubjectGroup) => {
        if (!activeAccountId) return;
        window.mailvalet.openDetailWindow({
            fromAddress: group.displaySubject,
            fromNames: [group.fromSummary],
            messages: group.messages,
            aiScoreRange: group.aiScoreRange,
            accountId: activeAccountId,
        });
    };

    const handleGroupModeChange = (_e: React.MouseEvent<HTMLElement>, value: string | null) => {
        if (value === 'from' || value === 'subject') {
            setGroupMode(value, activeAccountId ?? undefined);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                    {t('list.operationMode')}
                </Typography>
                <ToggleButtonGroup value={groupMode} exclusive onChange={handleGroupModeChange} size="small">
                    <ToggleButton value="from">From</ToggleButton>
                    <ToggleButton value="subject">{t('list.subject')}</ToggleButton>
                </ToggleButtonGroup>
                <TextField
                    size="small"
                    placeholder={
                        isFromMode ? t('list.searchPlaceholder') : t('list.searchPlaceholderSubject')
                    }
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" />
                                </InputAdornment>
                            ),
                        },
                    }}
                    sx={{ width: 300 }}
                />
            </Box>
            <TableContainer sx={{ flexGrow: 1, overflowX: 'auto' }}>
                <Table stickyHeader size="small" sx={{ minWidth: 800 }}>
                    <TableHead>
                        <TableRow>
                            <TableCell padding="checkbox">
                                <Checkbox
                                    checked={allSelected}
                                    indeterminate={selectedGroupKeys.size > 0 && selectedGroupKeys.size < groupCount}
                                    onChange={(_e, checked) => selectAllGroups(checked)}
                                />
                            </TableCell>
                            {isFromMode ? (
                                <>
                                    <TableCell sx={noWrap}>
                                        <TableSortLabel
                                            active={sortKey === 'name'}
                                            direction={sortKey === 'name' ? (sortAsc ? 'asc' : 'desc') : 'asc'}
                                            onClick={() => setSortKey('name')}
                                        >
                                            From
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell align="right" sx={{ ...noWrap, width: 80 }}>
                                        <TableSortLabel
                                            active={sortKey === 'count'}
                                            direction={sortKey === 'count' ? (sortAsc ? 'asc' : 'desc') : 'asc'}
                                            onClick={() => setSortKey('count')}
                                        >
                                            {t('list.count')}
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell align="right" sx={{ ...noWrap, width: 100 }}>
                                        <TableSortLabel
                                            active={sortKey === 'frequency'}
                                            direction={
                                                sortKey === 'frequency' ? (sortAsc ? 'asc' : 'desc') : 'asc'
                                            }
                                            onClick={() => setSortKey('frequency')}
                                        >
                                            {t('list.frequency')}
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={noWrap}>{t('list.latestSubject')}</TableCell>
                                </>
                            ) : (
                                <>
                                    <TableCell sx={noWrap}>
                                        <TableSortLabel
                                            active={sortKey === 'name'}
                                            direction={sortKey === 'name' ? (sortAsc ? 'asc' : 'desc') : 'asc'}
                                            onClick={() => setSortKey('name')}
                                        >
                                            {t('list.subject')}
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell align="right" sx={{ ...noWrap, width: 80 }}>
                                        <TableSortLabel
                                            active={sortKey === 'count'}
                                            direction={sortKey === 'count' ? (sortAsc ? 'asc' : 'desc') : 'asc'}
                                            onClick={() => setSortKey('count')}
                                        >
                                            {t('list.count')}
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell align="right" sx={{ ...noWrap, width: 100 }}>
                                        <TableSortLabel
                                            active={sortKey === 'frequency'}
                                            direction={
                                                sortKey === 'frequency' ? (sortAsc ? 'asc' : 'desc') : 'asc'
                                            }
                                            onClick={() => setSortKey('frequency')}
                                        >
                                            {t('list.frequency')}
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={noWrap}>{t('list.refFrom')}</TableCell>
                                </>
                            )}
                            <TableCell align="center" sx={{ ...noWrap, width: 70 }}>
                                {t('list.marketing')}
                            </TableCell>
                            <TableCell align="center" sx={{ ...noWrap, width: 70 }}>
                                {t('list.spam')}
                            </TableCell>
                            <TableCell sx={{ width: 48 }} />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isFromMode &&
                            filteredFromGroups.map(group => (
                                <TableRow
                                    key={group.fromAddress}
                                    hover
                                    selected={selectedGroupKeys.has(group.fromAddress)}
                                >
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            checked={selectedGroupKeys.has(group.fromAddress)}
                                            onChange={() => toggleGroupSelection(group.fromAddress)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Box>
                                            {group.fromNames.map((name, i) => (
                                                <Typography
                                                    key={i}
                                                    variant="body2"
                                                    sx={{
                                                        fontSize: '0.8rem',
                                                        lineHeight: 1.3,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        maxWidth: 350,
                                                    }}
                                                >
                                                    {name}
                                                </Typography>
                                            ))}
                                        </Box>
                                    </TableCell>
                                    <TableCell align="right" sx={noWrap}>
                                        <Typography variant="body2">{group.count}</Typography>
                                    </TableCell>
                                    <TableCell align="right" sx={noWrap}>
                                        <Typography variant="body2">
                                            {group.frequency}
                                            {t('list.perDay')}
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={noWrap}>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                maxWidth: 250,
                                            }}
                                        >
                                            {group.latestSubject}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="center" sx={noWrap}>
                                        <ScoreRange range={group.aiScoreRange.marketing} />
                                    </TableCell>
                                    <TableCell align="center" sx={noWrap}>
                                        <ScoreRange range={group.aiScoreRange.spam} />
                                    </TableCell>
                                    <TableCell>
                                        <IconButton size="small" onClick={() => handleOpenDetailFrom(group)}>
                                            <OpenInNewIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        {!isFromMode &&
                            filteredSubjectGroups.map(group => (
                                <TableRow
                                    key={group.subject}
                                    hover
                                    selected={selectedGroupKeys.has(group.subject)}
                                >
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            checked={selectedGroupKeys.has(group.subject)}
                                            onChange={() => toggleGroupSelection(group.subject)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                maxWidth: 350,
                                            }}
                                        >
                                            {group.displaySubject}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right" sx={noWrap}>
                                        <Typography variant="body2">{group.count}</Typography>
                                    </TableCell>
                                    <TableCell align="right" sx={noWrap}>
                                        <Typography variant="body2">
                                            {group.frequency}
                                            {t('list.perDay')}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontSize: '0.8rem',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                maxWidth: 250,
                                            }}
                                        >
                                            {group.fromSummary}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="center" sx={noWrap}>
                                        <ScoreRange range={group.aiScoreRange.marketing} />
                                    </TableCell>
                                    <TableCell align="center" sx={noWrap}>
                                        <ScoreRange range={group.aiScoreRange.spam} />
                                    </TableCell>
                                    <TableCell>
                                        <IconButton size="small" onClick={() => handleOpenDetailSubject(group)}>
                                            <OpenInNewIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        {groupCount === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} align="center">
                                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                                        {t('list.noData')}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}
