import React from 'react';
import {
    Box,
    Typography,
    Checkbox,
    FormControlLabel,
    Button,
    Collapse,
    IconButton,
    CircularProgress,
    Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';
import type { GmailLabel, LabelTreeNode } from '@shared/types';

interface Props {
    accountId: string;
}

function buildTree(labels: GmailLabel[]): LabelTreeNode[] {
    const rootNodes: LabelTreeNode[] = [];
    const nodeMap = new Map<string, LabelTreeNode>();

    // Sort labels by name
    const sorted = [...labels].sort((a, b) => a.name.localeCompare(b.name));

    for (const label of sorted) {
        const parts = label.name.split('/');
        let currentPath = '';
        let parent: LabelTreeNode[] = rootNodes;

        for (let i = 0; i < parts.length; i++) {
            currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
            let node = nodeMap.get(currentPath);
            if (!node) {
                node = {
                    id: currentPath,
                    name: parts[i],
                    fullPath: currentPath,
                    children: [],
                    labelId: i === parts.length - 1 ? label.id : undefined,
                };
                nodeMap.set(currentPath, node);
                parent.push(node);
            }
            if (i === parts.length - 1) {
                node.labelId = label.id;
            }
            parent = node.children;
        }
    }

    return rootNodes;
}

function getAllLabelIds(node: LabelTreeNode): string[] {
    const ids: string[] = [];
    if (node.labelId) ids.push(node.labelId);
    for (const child of node.children) {
        ids.push(...getAllLabelIds(child));
    }
    return ids;
}

function TreeNodeComponent({
    node,
    selected,
    onToggle,
}: {
    node: LabelTreeNode;
    selected: Set<string>;
    onToggle: (labelId: string) => void;
}) {
    const [expanded, setExpanded] = React.useState(false);
    const hasChildren = node.children.length > 0;

    const allChildIds = getAllLabelIds(node);
    const checkedCount = allChildIds.filter(id => selected.has(id)).length;
    const isIndeterminate = checkedCount > 0 && checkedCount < allChildIds.length;
    const isChecked = allChildIds.length > 0 && checkedCount === allChildIds.length;

    const handleToggle = () => {
        if (node.labelId) {
            onToggle(node.labelId);
        }
    };

    return (
        <Box sx={{ ml: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {hasChildren ? (
                    <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                        {expanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                    </IconButton>
                ) : (
                    <Box sx={{ width: 28 }} />
                )}
                <FormControlLabel
                    control={
                        <Checkbox
                            size="small"
                            checked={isChecked}
                            indeterminate={isIndeterminate}
                            onChange={handleToggle}
                        />
                    }
                    label={<Typography variant="body2">{node.name}</Typography>}
                />
            </Box>
            {hasChildren && (
                <Collapse in={expanded}>
                    {node.children.map(child => (
                        <TreeNodeComponent key={child.id} node={child} selected={selected} onToggle={onToggle} />
                    ))}
                </Collapse>
            )}
        </Box>
    );
}

export default function LabelTree({ accountId }: Props) {
    const { t } = useTranslation();
    const [labels, setLabels] = React.useState<GmailLabel[]>([]);
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
    const [loading, setLoading] = React.useState(false);

    const loadLabels = React.useCallback(async () => {
        setLoading(true);
        try {
            const [fetchedLabels, selection] = await Promise.all([
                window.mailvalet.getLabels(accountId),
                window.mailvalet.getSelectedLabels(accountId),
            ]);
            setLabels(fetchedLabels);
            setSelectedIds(new Set(selection.selectedLabelIds));
        } catch {
            setLabels([]);
        }
        setLoading(false);
    }, [accountId]);

    React.useEffect(() => {
        loadLabels();
    }, [loadLabels]);

    const handleRefresh = async () => {
        setLoading(true);
        try {
            const refreshed = await window.mailvalet.refreshLabels(accountId);
            setLabels(refreshed);
        } catch {
            // ignore
        }
        setLoading(false);
    };

    const handleToggle = async (labelId: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(labelId)) {
            newSet.delete(labelId);
        } else {
            newSet.add(labelId);
        }
        setSelectedIds(newSet);
        await window.mailvalet.saveSelectedLabels(accountId, { selectedLabelIds: Array.from(newSet) });
    };

    const tree = React.useMemo(() => buildTree(labels), [labels]);
    const selectedList = Array.from(selectedIds).join(', ');

    if (loading) {
        return <CircularProgress size={24} />;
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="subtitle2">{t('label.targetLabels')}</Typography>
                <Button size="small" startIcon={<RefreshIcon />} onClick={handleRefresh}>
                    {t('label.refresh')}
                </Button>
            </Box>
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1, maxHeight: 300, overflow: 'auto' }}>
                {tree.map(node => (
                    <TreeNodeComponent key={node.id} node={node} selected={selectedIds} onToggle={handleToggle} />
                ))}
                {tree.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                        {t('label.noLabels')}
                    </Typography>
                )}
            </Box>
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" color="text.secondary">
                {t('label.selected')}: {selectedList || '-'}
            </Typography>
        </Box>
    );
}
