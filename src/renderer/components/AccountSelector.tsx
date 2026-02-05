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
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { useTranslation } from 'react-i18next';
import { useAccountStore } from '../stores/useAccountStore';

export default function AccountSelector() {
    const { t } = useTranslation();
    const { accounts, activeAccountId, isConnected, setActiveAccount, addAccount } = useAccountStore();
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

    const activeAccount = accounts.find(a => a.id === activeAccountId);

    const handleSelect = async (accountId: string) => {
        setAnchorEl(null);
        await setActiveAccount(accountId);
    };

    const handleAdd = async () => {
        setAnchorEl(null);
        await addAccount();
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
                </Button>
                {activeAccountId && (
                    <Chip
                        icon={<FiberManualRecordIcon sx={{ fontSize: 10 }} />}
                        label={isConnected ? t('account.connected') : t('account.disconnected')}
                        size="small"
                        color={isConnected ? 'success' : 'default'}
                        variant="outlined"
                        sx={{ height: 22 }}
                    />
                )}
            </Box>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                {accounts.map(account => (
                    <MenuItem key={account.id} onClick={() => handleSelect(account.id)}>
                        <ListItemIcon>
                            {account.id === activeAccountId ? <CheckIcon fontSize="small" /> : null}
                        </ListItemIcon>
                        <ListItemText>{account.email}</ListItemText>
                    </MenuItem>
                ))}
                {accounts.length > 0 && <Divider />}
                <MenuItem onClick={handleAdd}>
                    <ListItemIcon>
                        <AddIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography variant="body2">{t('account.addAccount')}</Typography>
                    </ListItemText>
                </MenuItem>
            </Menu>
        </>
    );
}
