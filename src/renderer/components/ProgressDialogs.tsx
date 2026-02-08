import ProgressDialog from './ProgressDialog';
import { useEmailStore } from '../stores/useEmailStore';
import { useProgressStore } from '../stores/useProgressStore';

export default function ProgressDialogs() {
    const isFetching = useEmailStore(s => s.isFetching);
    const isJudging = useEmailStore(s => s.isJudging);
    const fetchProgress = useProgressStore(s => s.fetchProgress);
    const aiProgress = useProgressStore(s => s.aiProgress);

    return (
        <>
            <ProgressDialog
                open={isFetching}
                title="Fetching emails..."
                current={fetchProgress?.current ?? 0}
                total={fetchProgress?.total ?? 0}
                message={fetchProgress?.message ?? ''}
                onCancel={() => useEmailStore.getState().cancelFetch()}
            />
            <ProgressDialog
                open={isJudging}
                title="AI Judgment..."
                current={aiProgress?.current ?? 0}
                total={aiProgress?.total ?? 0}
                message={aiProgress?.message ?? ''}
                onCancel={() => useEmailStore.getState().cancelAIJudgment()}
            />
        </>
    );
}
