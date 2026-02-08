import React from 'react';
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
    Button,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import { useTranslation } from 'react-i18next';
import { useEmailStore } from '../stores/useEmailStore';
import { useAccountStore } from '../stores/useAccountStore';
import type { FromGroup, SubjectGroup, RuleGroup } from '@shared/types';
import RuleEditorDialog from './RuleEditorDialog';

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
        getFilteredRuleGroups,
        loadRuleGroups,
    } = useEmailStore();

    const [ruleDialogOpen, setRuleDialogOpen] = React.useState(false);

    const isFromMode = groupMode === 'from';
    const isSubjectMode = groupMode === 'subject';
    const isRuleMode = groupMode === 'rule';
    const filteredFromGroups = isFromMode ? getFilteredFromGroups() : [];
    const filteredSubjectGroups = isSubjectMode ? getFilteredSubjectGroups() : [];
    const filteredRuleGroups = isRuleMode ? getFilteredRuleGroups() : [];
    const groupCount = isFromMode
        ? filteredFromGroups.length
        : isSubjectMode
          ? filteredSubjectGroups.length
          : filteredRuleGroups.length;
    const allSelected =
        groupCount > 0 &&
        (isFromMode
            ? filteredFromGroups.every(g => selectedGroupKeys.has(g.fromAddress))
            : isSubjectMode
              ? filteredSubjectGroups.every(g => selectedGroupKeys.has(g.subject))
              : filteredRuleGroups.every(g => selectedGroupKeys.has(g.ruleKey)));

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

    const handleOpenDetailRule = (group: RuleGroup) => {
        if (!activeAccountId) return;
        window.mailvalet.openDetailWindow({
            fromAddress: group.ruleText,
            fromNames: [group.refFrom],
            messages: group.messages,
            aiScoreRange: group.aiScoreRange,
            accountId: activeAccountId,
        });
    };

    const handleGroupModeChange = (_e: React.MouseEvent<HTMLElement>, value: string | null) => {
        if (value === 'from' || value === 'subject' || value === 'rule') {
            setGroupMode(value, activeAccountId ?? undefined);
        }
    };

    const handleRuleSave = () => {
        if (activeAccountId) {
            loadRuleGroups(activeAccountId);
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
                    <ToggleButton value="rule">{t('rule.mode')}</ToggleButton>
                </ToggleButtonGroup>
                {isRuleMode && (
                    <Button
                        size="small"
                        startIcon={<SettingsIcon />}
                        onClick={() => setRuleDialogOpen(true)}
                    >
                        {t('rule.settings')}
                    </Button>
                )}
                <TextField
                    size="small"
                    placeholder={
                        isFromMode
                            ? t('list.searchPlaceholder')
                            : isSubjectMode
                              ? t('list.searchPlaceholderSubject')
                              : t('list.searchPlaceholderRule')
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
                            ) : isSubjectMode ? (
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
                            ) : (
                                <>
                                    <TableCell sx={noWrap}>
                                        <TableSortLabel
                                            active={sortKey === 'name'}
                                            direction={sortKey === 'name' ? (sortAsc ? 'asc' : 'desc') : 'asc'}
                                            onClick={() => setSortKey('name')}
                                        >
                                            {t('rule.rule')}
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
                                    <TableCell sx={noWrap}>{t('list.refSubject')}</TableCell>
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
                        {isSubjectMode &&
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
                        {isRuleMode &&
                            filteredRuleGroups.map(group => (
                                <TableRow
                                    key={group.ruleKey}
                                    hover
                                    selected={selectedGroupKeys.has(group.ruleKey)}
                                >
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            checked={selectedGroupKeys.has(group.ruleKey)}
                                            onChange={() => toggleGroupSelection(group.ruleKey)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontFamily: 'monospace',
                                                fontSize: '0.75rem',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                maxWidth: 300,
                                            }}
                                        >
                                            {group.ruleText}
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
                                                maxWidth: 200,
                                            }}
                                        >
                                            {group.refFrom}
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
                                                maxWidth: 200,
                                            }}
                                        >
                                            {group.refSubject}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="center" sx={noWrap}>
                                        <ScoreRange range={group.aiScoreRange.marketing} />
                                    </TableCell>
                                    <TableCell align="center" sx={noWrap}>
                                        <ScoreRange range={group.aiScoreRange.spam} />
                                    </TableCell>
                                    <TableCell>
                                        <IconButton size="small" onClick={() => handleOpenDetailRule(group)}>
                                            <OpenInNewIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        {groupCount === 0 && (
                            <TableRow>
                                <TableCell colSpan={isRuleMode ? 9 : 8} align="center">
                                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                                        {t('list.noData')}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
            <RuleEditorDialog
                open={ruleDialogOpen}
                accountId={activeAccountId}
                onClose={() => setRuleDialogOpen(false)}
                onSave={handleRuleSave}
            />
        </Box>
    );
}
