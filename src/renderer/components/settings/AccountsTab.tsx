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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LogoutIcon from '@mui/icons-material/Logout';
import { useTranslation } from 'react-i18next';
import { useAccountStore } from '../../stores/useAccountStore';
import LabelTree from '../LabelTree';
import type { Account } from '@shared/types';

export default function AccountsTab() {
    const { t } = useTranslation();
    const { accounts, addAccount, removeAccount } = useAccountStore();
    const [selectedAccount, setSelectedAccount] = React.useState<Account | null>(null);
    const [connectionStates, setConnectionStates] = React.useState<Record<string, boolean>>({});

    React.useEffect(() => {
        const checkAll = async () => {
            const states: Record<string, boolean> = {};
            for (const account of accounts) {
                try {
                    states[account.id] = await window.mailvalet.getConnectionStatus(account.id);
                } catch {
                    states[account.id] = false;
                }
            }
            setConnectionStates(states);
        };
        checkAll();
    }, [accounts]);

    const handleAdd = async () => {
        await addAccount();
    };

    const handleRemove = async (accountId: string) => {
        await removeAccount(accountId);
        if (selectedAccount?.id === accountId) {
            setSelectedAccount(null);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h6">{t('settings.accountsTitle')}</Typography>
            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>{t('settings.email')}</TableCell>
                            <TableCell>{t('settings.status')}</TableCell>
                            <TableCell />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {accounts.map(account => (
                            <TableRow
                                key={account.id}
                                hover
                                selected={selectedAccount?.id === account.id}
                                onClick={() => setSelectedAccount(account)}
                                sx={{ cursor: 'pointer' }}
                            >
                                <TableCell>{account.email}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={
                                            connectionStates[account.id]
                                                ? t('account.connected')
                                                : t('account.disconnected')
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
                                        onClick={e => {
                                            e.stopPropagation();
                                            handleRemove(account.id);
                                        }}
                                    >
                                        {t('account.logout')}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {accounts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={3} align="center">
                                    <Typography variant="body2" color="text.secondary">
                                        {t('settings.noAccounts')}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAdd}>
                {t('account.addAccount')}
            </Button>
            <Alert severity="info">{t('settings.gcpRequired')}</Alert>
            {selectedAccount && (
                <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        {selectedAccount.email} - {t('settings.labelSettings')}
                    </Typography>
                    <LabelTree accountId={selectedAccount.id} />
                </Box>
            )}
        </Box>
    );
}
