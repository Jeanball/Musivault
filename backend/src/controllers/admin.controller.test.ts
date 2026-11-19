import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runAdminTask } from './admin.controller';
import { startTask, subscribeToTask } from '../services/taskRunner.service';
import { audit } from '../services/audit.service';

vi.mock('../config/logger.config', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../services/adminTasks.service', () => ({ listAdminTasks: vi.fn(), getAdminTaskLogs: vi.fn() }));
vi.mock('../services/taskRunner.service', () => ({ startTask: vi.fn(), subscribeToTask: vi.fn(), isTaskRunning: vi.fn() }));
vi.mock('../services/audit.service', () => ({ audit: vi.fn() }));

describe('runAdminTask auditing', () => {
    beforeEach(() => vi.clearAllMocks());
    const res = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });

    it('records a task an administrator started', async () => {
        vi.mocked(startTask).mockReturnValue(true as never);
        const req = { params: { taskId: 'refresh-prices' } };

        await runAdminTask(req as never, res() as never);

        expect(audit).toHaveBeenCalledWith(req, { action: 'task.run', outcome: 'success', detail: 'refresh-prices' });
    });

    it('records nothing when the task was already running and the caller only follows it', async () => {
        vi.mocked(startTask).mockReturnValue(false as never);
        vi.mocked(subscribeToTask).mockReturnValue(true as never);

        await runAdminTask({ params: { taskId: 'refresh-prices' } } as never, res() as never);

        expect(audit).not.toHaveBeenCalled();
    });
});
