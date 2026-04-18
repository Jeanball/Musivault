import { Request, Response } from 'express';
import { listAdminTasks, getAdminTaskLogs } from '../services/adminTasks.service';
import { startTask, subscribeToTask, isTaskRunning } from '../services/taskRunner.service';

export async function getAdminTasks(req: Request, res: Response) {
    try {
        const tasks = await listAdminTasks((taskId) => isTaskRunning(taskId));
        res.status(200).json(tasks);
    } catch (error) {
        console.error('Error fetching admin tasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

export async function runAdminTask(req: Request, res: Response) {
    const { taskId } = req.params;

    const started = startTask(taskId, { forceRefresh: true, trigger: 'manual' });

    if (!started) {
        // Task might already be running — subscribe to it instead
        const subscribed = subscribeToTask(taskId, res);
        if (subscribed) return;

        res.status(404).json({ message: 'Admin task not found or could not be started.' });
        return;
    }

    // Subscribe the client to the task's SSE stream
    subscribeToTask(taskId, res);
}

export async function subscribeAdminTask(req: Request, res: Response) {
    const { taskId } = req.params;

    const subscribed = subscribeToTask(taskId, res);
    if (!subscribed) {
        res.status(404).json({ message: 'No running task to subscribe to.' });
    }
}

export async function getTaskLogs(req: Request, res: Response) {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const taskId = req.query.taskId as string | undefined;

        const logs = await getAdminTaskLogs(limit, taskId);
        res.status(200).json(logs);
    } catch (error) {
        console.error('Error fetching task logs:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}
