import { Request, Response } from 'express';
import { getAdminTaskDefinition, listAdminTasks, recordAdminTaskExecution } from '../services/adminTasks.service';

export async function getAdminTasks(req: Request, res: Response) {
    try {
        const tasks = await listAdminTasks();
        res.status(200).json(tasks);
    } catch (error) {
        console.error('Error fetching admin tasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

export async function runAdminTask(req: Request, res: Response) {
    const { taskId } = req.params;
    const task = getAdminTaskDefinition(taskId);

    if (!task) {
        res.status(404).json({ message: 'Admin task not found' });
        return;
    }

    const startedAt = Date.now();

    try {
        const details = await task.run(res);
        try {
            await recordAdminTaskExecution({
                taskId,
                durationMs: Date.now() - startedAt,
                status: 'success',
                details,
            });
        } catch (recordError) {
            console.error(`Failed to record admin task "${taskId}" success:`, recordError);
        }
    } catch (error) {
        console.error(`Error running admin task "${taskId}":`, error);
        try {
            await recordAdminTaskExecution({
                taskId,
                durationMs: Date.now() - startedAt,
                status: 'failed',
                details: error instanceof Error ? error.message : 'Internal server error',
            });
        } catch (recordError) {
            console.error(`Failed to record admin task "${taskId}" failure:`, recordError);
        }

        if (res.headersSent) {
            res.write(`data: ${JSON.stringify({ type: 'error', message: 'Internal server error' })}\n\n`);
            res.end();
        } else {
            res.status(500).json({ message: 'Internal server error' });
        }
    }
}
