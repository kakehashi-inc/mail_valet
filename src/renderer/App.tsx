import React from 'react';
import { CssBaseline, Box } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import './i18n/config';
import TitleBar from './components/TitleBar';
import MainScreen from './components/MainScreen';
import DetailWindow from './components/DetailWindow';
import TrashWindow from './components/TrashWindow';
import SettingsDialog from './components/SettingsDialog';
import ProgressDialogs from './components/ProgressDialogs';
import { useAppStore } from './stores/useAppStore';
import { useAccountStore } from './stores/useAccountStore';
import { useEmailStore } from './stores/useEmailStore';

export default function App() {
    const { i18n } = useTranslation();
    const { info, isDetailView, isTrashView, settingsOpen, setSettingsOpen, initialize } = useAppStore();
    const { activeAccountId, loadAccounts, checkConnection } = useAccountStore();
    const { loadCachedResult, loadGroupMode } = useEmailStore();

    React.useEffect(() => {
        initialize().then(() => {
            const appInfo = useAppStore.getState().info;
            if (appInfo) {
                i18n.changeLanguage(appInfo.language);
            }
            if (!useAppStore.getState().isDetailView) {
                loadAccounts();
            }
        });
    }, [i18n, initialize, loadAccounts]);

    React.useEffect(() => {
        if (activeAccountId && !isDetailView && !isTrashView) {
            checkConnection();
            // Sequential: loadCachedResult first (sets samplingResult + from/subject groups),
            // then loadGroupMode (sets groupMode and loads ruleGroups if needed).
            // Running in parallel causes a race where loadCachedResult's ruleGroups:[] wipes
            // the rule groups that loadGroupMode just loaded.
            loadCachedResult(activeAccountId).then(() => loadGroupMode(activeAccountId));
        }
    }, [activeAccountId, isDetailView, isTrashView, checkConnection, loadGroupMode, loadCachedResult]);

    const muiTheme = React.useMemo(
        () =>
            createTheme({
                palette: {
                    mode: (info?.theme ??
                        (window.matchMedia?.('(prefers-color-scheme: dark)').matches
                            ? 'dark'
                            : 'light')) as 'light' | 'dark',
                },
            }),
        [info?.theme]
    );

    if (isDetailView) {
        return (
            <ThemeProvider theme={muiTheme}>
                <CssBaseline />
                <DetailWindow />
            </ThemeProvider>
        );
    }

    if (isTrashView) {
        return (
            <ThemeProvider theme={muiTheme}>
                <CssBaseline />
                <TrashWindow />
            </ThemeProvider>
        );
    }

    return (
        <ThemeProvider theme={muiTheme}>
            <CssBaseline />
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
                <TitleBar info={info} onOpenSettings={() => setSettingsOpen(true)} />
                <MainScreen />
                <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
                <ProgressDialogs />
            </Box>
        </ThemeProvider>
    );
}
