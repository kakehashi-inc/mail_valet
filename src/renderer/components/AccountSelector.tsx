import React from 'react';
import {
    Button,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Divider,
    Typography,
    Box,
    Chip,
} from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CheckIcon from '@mui/icons-material/Check';
import AddIcon from '@mui/icons-material/Add';
import EmailIcon from '@mui/icons-material/Email';
import DnsIcon from '@mui/icons-material/Dns';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { useTranslation } from 'react-i18next';
import { useAccountStore } from '../stores/useAccountStore';
import ImapAccountDialog from './settings/ImapAccountDialog';
import type { ImapConnectionSettings } from '@shared/types';

export default function AccountSelector() {
    const { t } = useTranslation();
    const { accounts, activeAccountId, isConnected, setActiveAccount, addAccount, addImapAccount } =
        useAccountStore();
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const [addMenuAnchor, setAddMenuAnchor] = React.useState<null | HTMLElement>(null);
    const [imapDialogOpen, setImapDialogOpen] = React.useState(false);

    const activeAccount = accounts.find(a => a.id === activeAccountId);

    const sortedAccounts = React.useMemo(() => {
        return [...accounts].sort((a, b) => {
            if (a.provider !== b.provider) return a.provider === 'gmail' ? -1 : 1;
            return a.email.localeCompare(b.email);
        });
    }, [accounts]);

    const handleSelect = async (accountId: string) => {
        setAnchorEl(null);
        await setActiveAccount(accountId);
    };

    const handleAddGmail = async () => {
        setAddMenuAnchor(null);
        setAnchorEl(null);
        await addAccount();
    };

    const handleAddImap = () => {
        setAddMenuAnchor(null);
        setAnchorEl(null);
        setImapDialogOpen(true);
    };

    const handleImapAdd = async (settings: ImapConnectionSettings) => {
        await addImapAccount(settings);
    };

    return (
        <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button
                    size="small"
                    onClick={e => setAnchorEl(e.currentTarget)}
                    endIcon={<ArrowDropDownIcon />}
                    sx={{ textTransform: 'none', color: 'text.primary' }}
                >
                    {activeAccount?.email || t('account.noAccount')}
                    {activeAccount && (
                        <Chip
                            label={activeAccount.provider === 'gmail' ? 'Gmail' : 'IMAP'}
                            size="small"
                            variant="outlined"
                            color={activeAccount.provider === 'gmail' ? 'primary' : 'secondary'}
                            sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                        />
                    )}
                </Button>
                {activeAccountId && (
                    <Chip
                        icon={<FiberManualRecordIcon sx={{ fontSize: 10 }} />}
                        label={isConnected ? t('account.active') : t('account.inactive')}
                        size="small"
                        color={isConnected ? 'success' : 'default'}
                        variant="outlined"
                        sx={{ height: 22 }}
                    />
                )}
            </Box>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                {sortedAccounts.map(account => (
                    <MenuItem key={account.id} onClick={() => handleSelect(account.id)}>
                        <ListItemIcon>
                            {account.id === activeAccountId ? <CheckIcon fontSize="small" /> : null}
                        </ListItemIcon>
                        <ListItemText>{account.email}</ListItemText>
                        <Chip
                            label={account.provider === 'gmail' ? 'Gmail' : 'IMAP'}
                            size="small"
                            variant="outlined"
                            color={account.provider === 'gmail' ? 'primary' : 'secondary'}
                            sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                        />
                    </MenuItem>
                ))}
                {accounts.length > 0 && <Divider />}
                <MenuItem onClick={e => setAddMenuAnchor(e.currentTarget)}>
                    <ListItemIcon>
                        <AddIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography variant="body2">{t('account.addAccount')}</Typography>
                    </ListItemText>
                </MenuItem>
            </Menu>
            <Menu
                anchorEl={addMenuAnchor}
                open={Boolean(addMenuAnchor)}
                onClose={() => setAddMenuAnchor(null)}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
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
            <ImapAccountDialog
                open={imapDialogOpen}
                onClose={() => setImapDialogOpen(false)}
                onAdd={handleImapAdd}
            />
        </>
    );
}
