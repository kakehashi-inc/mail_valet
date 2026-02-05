import { Box, Typography, IconButton } from '@mui/material';
import type { AppInfo } from '@shared/types';
import MinimizeIcon from '@mui/icons-material/Minimize';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import AccountSelector from './AccountSelector';

interface Props {
    info: AppInfo | undefined | null;
    onOpenSettings: () => void;
}

export default function TitleBar({ info, onOpenSettings }: Props) {
    const isMac = info?.os === 'darwin';

    return (
        <Box
            sx={{
                WebkitAppRegion: 'drag',
                display: 'flex',
                alignItems: 'center',
                px: 2,
                height: 48,
                bgcolor: 'background.paper',
                borderBottom: 1,
                borderColor: 'divider',
                userSelect: 'none',
            }}
        >
            <Box sx={{ ml: isMac ? 10 : 0, display: 'flex', alignItems: 'baseline', gap: 1, mr: 2 }}>
                <Typography variant="body1" sx={{ fontWeight: 500, fontSize: '0.95rem' }}>
                    Mail Valet
                </Typography>
                {info?.version && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                        v{info.version}
                    </Typography>
                )}
            </Box>

            <Box sx={{ WebkitAppRegion: 'no-drag' }}>
                <AccountSelector />
            </Box>

            <Box sx={{ flexGrow: 1 }} />

            <Box sx={{ display: 'flex', alignItems: 'center', WebkitAppRegion: 'no-drag' }}>
                <IconButton size="small" onClick={onOpenSettings} sx={{ color: 'text.secondary', mr: 1 }}>
                    <SettingsIcon fontSize="small" />
                </IconButton>
                {!isMac && (
                    <>
                        <IconButton
                            size="medium"
                            onClick={() => window.mailvalet.minimize()}
                            sx={{
                                borderRadius: 0,
                                width: 48,
                                height: 48,
                                color: 'text.primary',
                                '&:hover': { bgcolor: 'action.hover' },
                            }}
                        >
                            <MinimizeIcon />
                        </IconButton>
                        <IconButton
                            size="medium"
                            onClick={async () => {
                                await window.mailvalet.maximizeOrRestore();
                            }}
                            sx={{
                                borderRadius: 0,
                                width: 48,
                                height: 48,
                                color: 'text.primary',
                                '&:hover': { bgcolor: 'action.hover' },
                            }}
                        >
                            <CropSquareIcon />
                        </IconButton>
                        <IconButton
                            size="medium"
                            onClick={() => window.mailvalet.close()}
                            sx={{
                                borderRadius: 0,
                                width: 48,
                                height: 48,
                                color: 'text.primary',
                                '&:hover': { bgcolor: 'error.main', color: 'error.contrastText' },
                            }}
                        >
                            <CloseIcon />
                        </IconButton>
                    </>
                )}
            </Box>
        </Box>
    );
}
