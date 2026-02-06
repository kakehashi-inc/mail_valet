import React from 'react';
import { CssBaseline, Box } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import './i18n/config';
import TitleBar from './components/TitleBar';
import MainScreen from './components/MainScreen';
import DetailWindow from './components/DetailWindow';
import SettingsDialog from './components/SettingsDialog';
import ProgressDialog from './components/ProgressDialog';
import { useAppStore } from './stores/useAppStore';
import { useAccountStore } from './stores/useAccountStore';
import { useEmailStore } from './stores/useEmailStore';

export default function App() {
    const { i18n } = useTranslation();
    const { info, isDetailView, settingsOpen, setSettingsOpen, initialize } = useAppStore();
    const { activeAccountId, loadAccounts } = useAccountStore();
    const { loadCachedResult, loadGroupMode, isFetching, fetchProgress, isJudging, aiProgress } = useEmailStore();

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
        if (activeAccountId && !isDetailView) {
            loadGroupMode(activeAccountId);
            loadCachedResult(activeAccountId);
        }
    }, [activeAccountId, isDetailView, loadGroupMode, loadCachedResult]);

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

    return (
        <ThemeProvider theme={muiTheme}>
            <CssBaseline />
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
                <TitleBar info={info} onOpenSettings={() => setSettingsOpen(true)} />
                <MainScreen />
                <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
                <ProgressDialog
                    open={isFetching}
                    title="Fetching emails..."
                    current={fetchProgress?.current ?? 0}
                    total={fetchProgress?.total ?? 0}
                    message={fetchProgress?.message ?? ''}
                />
                <ProgressDialog
                    open={isJudging}
                    title="AI Judgment..."
                    current={aiProgress?.current ?? 0}
                    total={aiProgress?.total ?? 0}
                    message={aiProgress?.message ?? ''}
                    onCancel={() => useEmailStore.getState().cancelAIJudgment()}
                />
            </Box>
        </ThemeProvider>
    );
}
