import { Injectable } from '@angular/core';
import { GoogleTask, TaskStatus } from '../models/task.model';

/**
 * API Google Tasks v1 (cf §F3 du CDC).
 *
 * Utilise `gapi.client.tasks.*` (chargé via le GoogleAuthService au login).
 * Le service :
 * - mappe les dates RFC3339 (string) ↔ Date,
 * - throttle les inserts à 1 req/s (cf §13 garde-fous),
 * - expose les opérations CRUD nécessaires à l'app.
 */
@Injectable({ providedIn: 'root' })
export class GoogleTasksService {
  /** Délai minimum entre deux inserts successifs (anti-429). */
  private static readonly INSERT_THROTTLE_MS = 1000;
  private lastInsertAt = 0;

  // ---------- Task lists ----------

  async listTaskLists(): Promise<TaskListRef[]> {
    const gapi = this.requireGapi();
    const response = await gapi.client.tasks.tasklists.list({});
    const items = (response.result.items ?? []) as GapiTaskList[];
    return items.map((t) => ({ id: t.id, title: t.title }));
  }

  // ---------- Tasks ----------

  async listTasks(taskListId: string): Promise<GoogleTask[]> {
    const gapi = this.requireGapi();
    const response = await gapi.client.tasks.tasks.list({ tasklist: taskListId });
    const items = (response.result.items ?? []) as GapiTask[];
    return items.map((t) => this.mapGapiTask(t, taskListId));
  }

  async insertTask(
    taskListId: string,
    partial: Pick<GoogleTask, 'title' | 'notes'> & Partial<GoogleTask>,
  ): Promise<GoogleTask> {
    await this.throttle();
    const gapi = this.requireGapi();
    const resource = {
      title: partial.title,
      notes: partial.notes,
      status: 'needsAction' as TaskStatus,
      ...(partial.due ? { due: partial.due.toISOString() } : {}),
    };
    const response = await gapi.client.tasks.tasks.insert({
      tasklist: taskListId,
      resource,
    });
    return this.mapGapiTask(response.result as GapiTask, taskListId);
  }

  async patchTask(
    taskListId: string,
    taskId: string,
    patch: Partial<GoogleTask>,
  ): Promise<GoogleTask> {
    const gapi = this.requireGapi();
    const resource: Record<string, unknown> = {};
    if (patch.title !== undefined) resource['title'] = patch.title;
    if (patch.notes !== undefined) resource['notes'] = patch.notes;
    if (patch.status !== undefined) resource['status'] = patch.status;
    if (patch.due !== undefined) resource['due'] = patch.due.toISOString();
    if (patch.completed !== undefined) resource['completed'] = patch.completed.toISOString();
    const response = await gapi.client.tasks.tasks.patch({
      tasklist: taskListId,
      task: taskId,
      resource,
    });
    return this.mapGapiTask(response.result as GapiTask, taskListId);
  }

  async deleteTask(taskListId: string, taskId: string): Promise<void> {
    const gapi = this.requireGapi();
    await gapi.client.tasks.tasks.delete({ tasklist: taskListId, task: taskId });
  }

  // ---------- Helpers ----------

  private requireGapi(): NonNullable<Window['gapi']> {
    if (typeof window === 'undefined' || !window.gapi) {
      throw new Error('gapi SDK non disponible. Connectez-vous d\'abord.');
    }
    return window.gapi;
  }

  /** Mappe un objet GAPI brut vers notre `GoogleTask`. */
  private mapGapiTask(t: GapiTask, taskListId: string): GoogleTask {
    return {
      id: t.id,
      title: t.title ?? '',
      notes: t.notes,
      status: (t.status as TaskStatus) ?? 'needsAction',
      due: t.due ? new Date(t.due) : undefined,
      completed: t.completed ? new Date(t.completed) : undefined,
      parent: t.parent,
      position: t.position ?? '0',
      taskListId,
      updated: t.updated ? new Date(t.updated) : new Date(),
    };
  }

  /** Attend le délai minimum depuis le dernier insert (cf §13). */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastInsertAt;
    if (elapsed < GoogleTasksService.INSERT_THROTTLE_MS) {
      const wait = GoogleTasksService.INSERT_THROTTLE_MS - elapsed;
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    this.lastInsertAt = Date.now();
  }
}

// --- Types GAPI (subset) -------------------------------------------------

export interface TaskListRef {
  id: string;
  title: string;
}

interface GapiTaskList {
  id: string;
  title: string;
}

interface GapiTask {
  id: string;
  title?: string;
  notes?: string;
  status?: string;
  due?: string;
  completed?: string;
  parent?: string;
  position?: string;
  updated?: string;
}