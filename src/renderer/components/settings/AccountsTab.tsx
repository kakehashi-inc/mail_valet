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
    Button,
    Chip,
    Alert,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LogoutIcon from '@mui/icons-material/Logout';
import EmailIcon from '@mui/icons-material/Email';
import DnsIcon from '@mui/icons-material/Dns';
import SettingsIcon from '@mui/icons-material/Settings';
import FolderIcon from '@mui/icons-material/Folder';
import { useTranslation } from 'react-i18next';
import { useAccountStore } from '../../stores/useAccountStore';
import LabelTree from '../LabelTree';
import ImapAccountDialog from './ImapAccountDialog';
import type { ImapConnectionSettings } from '@shared/types';

export default function AccountsTab() {
    const { t } = useTranslation();
    const { accounts, addAccount, addImapAccount, removeAccount } = useAccountStore();
    const [connectionStates, setConnectionStates] = React.useState<Record<string, boolean>>({});
    const [addMenuAnchor, setAddMenuAnchor] = React.useState<null | HTMLElement>(null);
    const [imapDialogOpen, setImapDialogOpen] = React.useState(false);
    const [editImapAccountId, setEditImapAccountId] = React.useState<string | null>(null);
    const [labelAccountId, setLabelAccountId] = React.useState<string | null>(null);

    const labelAccount = React.useMemo(
        () => accounts.find(a => a.id === labelAccountId) ?? null,
        [accounts, labelAccountId],
    );

    const sortedAccounts = React.useMemo(() => {
        return [...accounts].sort((a, b) => {
            if (a.provider !== b.provider) return a.provider === 'gmail' ? -1 : 1;
            return a.email.localeCompare(b.email);
        });
    }, [accounts]);

    React.useEffect(() => {
        const checkAll = async () => {
            const states: Record<string, boolean> = {};
            for (const account of accounts) {
                try {
                    states[account.id] = await window.mailvalet.getConnectionStatus(account.id);
                } catch (e) {
                    console.warn('[AccountsTab] Connection check failed for', account.id, e);
                    states[account.id] = false;
                }
            }
            setConnectionStates(states);
        };
        checkAll();
    }, [accounts]);

    const handleAddGmail = async () => {
        setAddMenuAnchor(null);
        await addAccount();
    };

    const handleAddImap = () => {
        setAddMenuAnchor(null);
        setImapDialogOpen(true);
    };

    const handleImapAdd = async (settings: ImapConnectionSettings) => {
        await addImapAccount(settings);
    };

    const handleImapSave = async (accountId: string, settings: ImapConnectionSettings) => {
        await window.mailvalet.updateImapSettings(accountId, settings);
        const { loadAccounts } = useAccountStore.getState();
        await loadAccounts();
    };

    const handleEditImap = (accountId: string) => {
        setEditImapAccountId(accountId);
    };

    const handleRemove = async (accountId: string) => {
        await removeAccount(accountId);
    };

    const hasGmailAccounts = accounts.some(a => a.provider === 'gmail');

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h6">{t('settings.accountsTitle')}</Typography>
            {hasGmailAccounts && <Alert severity="info">{t('settings.gcpRequired')}</Alert>}
            <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={e => setAddMenuAnchor(e.currentTarget)}
                sx={{ alignSelf: 'flex-start' }}
            >
                {t('account.addAccount')}
            </Button>
            <Menu
                anchorEl={addMenuAnchor}
                open={Boolean(addMenuAnchor)}
                onClose={() => setAddMenuAnchor(null)}
            >
                <MenuItem onClick={handleAddGmail}>
                    <ListItemIcon>
                        <EmailIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Gmail</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleAddImap}>
                    <ListItemIcon>
                        <DnsIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>IMAP</ListItemText>
                </MenuItem>
            </Menu>
            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>{t('settings.email')}</TableCell>
                            <TableCell>{t('settings.provider')}</TableCell>
                            <TableCell padding="checkbox" />
                            <TableCell>{t('settings.status')}</TableCell>
                            <TableCell />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {sortedAccounts.map(account => (
                            <TableRow key={account.id} hover>
                                <TableCell>{account.email}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={account.provider === 'gmail' ? 'Gmail' : 'IMAP'}
                                        size="small"
                                        variant="outlined"
                                        color={account.provider === 'gmail' ? 'primary' : 'secondary'}
                                    />
                                </TableCell>
                                <TableCell padding="checkbox">
                                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                                        {account.provider === 'imap' && (
                                            <Tooltip title={t('imap.editTitle')}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleEditImap(account.id)}
                                                >
                                                    <SettingsIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                        <Tooltip title={t('settings.labelSettings')}>
                                            <IconButton
                                                size="small"
                                                onClick={() => setLabelAccountId(account.id)}
                                            >
                                                <FolderIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={
                                            connectionStates[account.id]
                                                ? t('account.active')
                                                : t('account.inactive')
                                        }
                                        size="small"
                                        color={connectionStates[account.id] ? 'success' : 'default'}
                                        variant="outlined"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Button
                                        size="small"
                                        color="error"
                                        startIcon={<LogoutIcon />}
                                        onClick={() => handleRemove(account.id)}
                                    >
                                        {t('account.logout')}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {accounts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} align="center">
                                    <Typography variant="body2" color="text.secondary">
                                        {t('settings.noAccounts')}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
            <Dialog
                open={Boolean(labelAccountId)}
                onClose={() => setLabelAccountId(null)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    {labelAccount?.email} - {t('settings.labelSettings')}
                </DialogTitle>
                <DialogContent>
                    {labelAccountId && <LabelTree accountId={labelAccountId} />}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setLabelAccountId(null)}>{t('common.close')}</Button>
                </DialogActions>
            </Dialog>
            <ImapAccountDialog
                open={imapDialogOpen}
                onClose={() => setImapDialogOpen(false)}
                onAdd={handleImapAdd}
            />
            <ImapAccountDialog
                open={Boolean(editImapAccountId)}
                onClose={() => setEditImapAccountId(null)}
                editAccountId={editImapAccountId}
                onSave={handleImapSave}
            />
        </Box>
    );
}
