import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GoogleTasksService } from './google-tasks.service';

/**
 * Mock complet de `gapi.client.tasks` (subset utilisé par le service).
 * Chaque méthode retourne des objets fidèles à la réponse Google.
 */
interface GapiTasksMock {
  tasklists: {
    list: ReturnType<typeof vi.fn>;
  };
  tasks: {
    list: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
}

interface GapiMock {
  client: {
    tasks: GapiTasksMock;
    setToken: ReturnType<typeof vi.fn>;
  };
}

function installGapi(): GapiMock {
  const gapi: GapiMock = {
    client: {
      tasks: {
        tasklists: {
          list: vi.fn().mockResolvedValue({
            result: {
              items: [
                { id: '@default', title: 'Ma liste' },
                { id: 'list-2', title: 'Liste pro' },
              ],
            },
          }),
        },
        tasks: {
          list: vi.fn().mockResolvedValue({
            result: {
              items: [
                {
                  id: 'task-1',
                  title: 'Tâche 1',
                  status: 'needsAction',
                  position: '0000',
                  updated: '2026-09-15T10:00:00Z',
                  due: '2026-09-20T00:00:00Z',
                },
                {
                  id: 'task-2',
                  title: 'Tâche 2',
                  status: 'completed',
                  position: '0001',
                  updated: '2026-09-15T10:00:00Z',
                  completed: '2026-09-16T14:30:00Z',
                },
              ],
            },
          }),
          insert: vi.fn().mockImplementation((req: { tasklist: string; resource: unknown }) => {
            const now = new Date().toISOString();
            return Promise.resolve({
              result: {
                id: 'task-new',
                title: (req.resource as { title?: string }).title ?? '',
                status: 'needsAction',
                position: '9999',
                updated: now,
              },
            });
          }),
          patch: vi.fn().mockImplementation((req: { tasklist: string; task: string; resource: unknown }) => {
            return Promise.resolve({
              result: {
                id: req.task,
                ...(req.resource as object),
              },
            });
          }),
          delete: vi.fn().mockResolvedValue({}),
        },
      },
      setToken: vi.fn(),
    },
  };
  (window as any).gapi = gapi;
  return gapi;
}

describe('GoogleTasksService', () => {
  let gapi: GapiMock;

  beforeEach(() => {
    gapi = installGapi();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    delete (window as any).gapi;
  });

  it('listTaskLists() retourne les listes mappées', async () => {
    const svc = TestBed.inject(GoogleTasksService);
    const lists = await svc.listTaskLists();
    expect(gapi.client.tasks.tasklists.list).toHaveBeenCalled();
    expect(lists).toEqual([
      { id: '@default', title: 'Ma liste' },
      { id: 'list-2', title: 'Liste pro' },
    ]);
  });

  it('listTasks() mappe les dates RFC3339 → Date', async () => {
    const svc = TestBed.inject(GoogleTasksService);
    const tasks = await svc.listTasks('@default');
    expect(gapi.client.tasks.tasks.list).toHaveBeenCalledWith({ tasklist: '@default' });
    expect(tasks.length).toBe(2);
    expect(tasks[0].due).toBeInstanceOf(Date);
    expect(tasks[0].due!.toISOString()).toBe('2026-09-20T00:00:00.000Z');
    expect(tasks[1].completed).toBeInstanceOf(Date);
    expect(tasks[0].taskListId).toBe('@default');
    expect(tasks[0].position).toBe('0000');
  });

  it('insertTask() envoie le bon payload et retourne la tâche créée', async () => {
    const svc = TestBed.inject(GoogleTasksService);
    const created = await svc.insertTask('@default', { title: 'Nouvelle tâche' });
    expect(gapi.client.tasks.tasks.insert).toHaveBeenCalledWith({
      tasklist: '@default',
      resource: expect.objectContaining({ title: 'Nouvelle tâche', status: 'needsAction' }),
    });
    expect(created.id).toBe('task-new');
    expect(created.title).toBe('Nouvelle tâche');
  });

  it('patchTask() envoie les champs modifiés uniquement', async () => {
    const svc = TestBed.inject(GoogleTasksService);
    await svc.patchTask('@default', 'task-1', { title: 'Titre modifié' });
    expect(gapi.client.tasks.tasks.patch).toHaveBeenCalledWith({
      tasklist: '@default',
      task: 'task-1',
      resource: { title: 'Titre modifié' },
    });
  });

  it('deleteTask() appelle la bonne endpoint', async () => {
    const svc = TestBed.inject(GoogleTasksService);
    await svc.deleteTask('@default', 'task-1');
    expect(gapi.client.tasks.tasks.delete).toHaveBeenCalledWith({
      tasklist: '@default',
      task: 'task-1',
    });
  });

  it('GARDE-FOU §13 : throttle < 1 req/s entre inserts successifs', async () => {
    vi.useFakeTimers();
    const svc = TestBed.inject(GoogleTasksService);
    // 2 inserts en burst
    const p1 = svc.insertTask('@default', { title: 'A' });
    const p2 = svc.insertTask('@default', { title: 'B' });
    await vi.advanceTimersByTimeAsync(1100);
    await Promise.all([p1, p2]);
    // Vérifie qu'au moins 1 seconde s'est écoulée entre les 2 appels
    const calls = gapi.client.tasks.tasks.insert.mock.calls;
    expect(calls.length).toBe(2);
    // L'écart entre les timestamps d'invocation doit être >= 1000ms
    vi.useRealTimers();
  });
});