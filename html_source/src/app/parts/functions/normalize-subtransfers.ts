import { Subtransfers, SubtransfersByPID, Transaction } from '@api/models/transaction.model';

/**
 * PDC daemon currently serializes flat `subtransfers`, while the UI (ported from newer Zano)
 * reads `subtransfers_by_pid`. Normalize so History amounts and Received/Sent status work.
 */
export const normalizeSubtransfersByPid = (transaction: Transaction): Transaction => {
    const hasByPid = Array.isArray(transaction.subtransfers_by_pid) && transaction.subtransfers_by_pid.length > 0;
    if (hasByPid) {
        return transaction;
    }

    const flat: Subtransfers | undefined = (transaction as Transaction & { subtransfers?: Subtransfers }).subtransfers;
    if (!Array.isArray(flat) || flat.length === 0) {
        return transaction;
    }

    const subtransfers_by_pid: SubtransfersByPID = [
        {
            payment_id: '',
            subtransfers: flat,
        },
    ];

    transaction.subtransfers_by_pid = subtransfers_by_pid;
    return transaction;
};

export const normalizeHistorySubtransfers = (items: Transaction[]): Transaction[] => {
    for (const item of items) {
        normalizeSubtransfersByPid(item);
    }
    return items;
};
