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
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import { useEmailStore } from '../stores/useEmailStore';
import { useAccountStore } from '../stores/useAccountStore';
import type { FromGroup } from '@shared/types';

function ScoreRange({ range }: { range: [number, number] }) {
    if (range[0] < 0) return <Typography variant="body2">-</Typography>;
    if (range[0] === range[1]) return <Typography variant="body2">{range[0]}</Typography>;
    return (
        <Typography variant="body2">
            {range[0]}-{range[1]}
        </Typography>
    );
}

export default function FromGroupTable() {
    const { t } = useTranslation();
    const { activeAccountId } = useAccountStore();
    const {
        sortKey,
        sortAsc,
        searchQuery,
        selectedFromAddresses,
        setSortKey,
        setSearchQuery,
        toggleFromSelection,
        selectAllFrom,
        getFilteredGroups,
    } = useEmailStore();

    const filteredGroups = getFilteredGroups();
    const allSelected = filteredGroups.length > 0 && filteredGroups.every(g => selectedFromAddresses.has(g.fromAddress));

    const handleOpenDetail = (group: FromGroup) => {
        if (!activeAccountId) return;
        window.mailvalet.openDetailWindow({
            fromAddress: group.fromAddress,
            fromNames: group.fromNames,
            messages: group.messages,
            aiScoreRange: group.aiScoreRange,
            accountId: activeAccountId,
        });
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1 }}>
                <TextField
                    size="small"
                    placeholder={t('list.searchPlaceholder')}
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
            <TableContainer sx={{ flexGrow: 1 }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell padding="checkbox">
                                <Checkbox
                                    checked={allSelected}
                                    indeterminate={
                                        selectedFromAddresses.size > 0 &&
                                        selectedFromAddresses.size < filteredGroups.length
                                    }
                                    onChange={(_e, checked) => selectAllFrom(checked)}
                                />
                            </TableCell>
                            <TableCell>
                                <TableSortLabel
                                    active={sortKey === 'name'}
                                    direction={sortKey === 'name' ? (sortAsc ? 'asc' : 'desc') : 'asc'}
                                    onClick={() => setSortKey('name')}
                                >
                                    From
                                </TableSortLabel>
                            </TableCell>
                            <TableCell align="right" sx={{ width: 80 }}>
                                <TableSortLabel
                                    active={sortKey === 'count'}
                                    direction={sortKey === 'count' ? (sortAsc ? 'asc' : 'desc') : 'asc'}
                                    onClick={() => setSortKey('count')}
                                >
                                    {t('list.count')}
                                </TableSortLabel>
                            </TableCell>
                            <TableCell align="right" sx={{ width: 100 }}>
                                <TableSortLabel
                                    active={sortKey === 'frequency'}
                                    direction={sortKey === 'frequency' ? (sortAsc ? 'asc' : 'desc') : 'asc'}
                                    onClick={() => setSortKey('frequency')}
                                >
                                    {t('list.frequency')}
                                </TableSortLabel>
                            </TableCell>
                            <TableCell>{t('list.subject')}</TableCell>
                            <TableCell align="center" sx={{ width: 70 }}>
                                M
                            </TableCell>
                            <TableCell align="center" sx={{ width: 70 }}>
                                S
                            </TableCell>
                            <TableCell sx={{ width: 48 }} />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredGroups.map(group => (
                            <TableRow
                                key={group.fromAddress}
                                hover
                                selected={selectedFromAddresses.has(group.fromAddress)}
                            >
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        checked={selectedFromAddresses.has(group.fromAddress)}
                                        onChange={() => toggleFromSelection(group.fromAddress)}
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
                                <TableCell align="right">
                                    <Typography variant="body2">{group.count}</Typography>
                                </TableCell>
                                <TableCell align="right">
                                    <Typography variant="body2">
                                        {group.frequency}
                                        {t('list.perDay')}
                                    </Typography>
                                </TableCell>
                                <TableCell>
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
                                <TableCell align="center">
                                    <ScoreRange range={group.aiScoreRange.marketing} />
                                </TableCell>
                                <TableCell align="center">
                                    <ScoreRange range={group.aiScoreRange.spam} />
                                </TableCell>
                                <TableCell>
                                    <IconButton size="small" onClick={() => handleOpenDetail(group)}>
                                        <OpenInNewIcon fontSize="small" />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                        {filteredGroups.length === 0 && (
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
